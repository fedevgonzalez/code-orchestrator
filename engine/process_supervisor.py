"""Claude Code process lifecycle management.

Handles spawning, health checks, respawning with context restoration,
and graceful shutdown.
"""

import logging
import os
import shutil
import sys
import time
import threading
from pathlib import Path

from pty_adapter import create_pty, BasePTY
from jsonl_watcher import JSONLWatcher, AgentState
from config import OrchestratorConfig
from models import ProjectState, TaskStatus

logger = logging.getLogger(__name__)


def find_claude_binary() -> str:
    """Find the claude CLI binary."""
    claude_path = shutil.which("claude")
    if claude_path:
        return claude_path

    if sys.platform == "win32":
        home = os.path.expanduser("~")
        for candidate in [
            os.path.join(home, ".claude", "local", "claude.exe"),
            os.path.join(home, "AppData", "Local", "Programs", "claude", "claude.exe"),
        ]:
            if os.path.isfile(candidate):
                return candidate

    raise FileNotFoundError(
        "Could not find 'claude' CLI. Make sure Claude Code is installed and on PATH."
    )


class ProcessSupervisor:
    """Manages the Claude Code builder process lifecycle."""

    def __init__(self, cwd: str, config: OrchestratorConfig):
        self.cwd = cwd
        self.config = config
        self.pty: BasePTY | None = None
        self.watcher: JSONLWatcher | None = None
        self._health_thread: threading.Thread | None = None
        self._running = False
        self._last_activity: float = 0
        self._respawn_count = 0
        self._on_health_fail: callable = None

    @property
    def is_alive(self) -> bool:
        return self.pty is not None and self.pty.is_alive()

    def spawn(self, on_health_fail: callable = None) -> bool:
        """Spawn Claude Code and wait for it to be ready.

        Returns True if successfully spawned and ready.
        """
        self._on_health_fail = on_health_fail
        claude_bin = find_claude_binary()
        cmd = f"{claude_bin} --dangerously-skip-permissions"

        self.pty = create_pty()
        self.watcher = JSONLWatcher(self.cwd)

        logger.info("Spawning builder: %s (cwd: %s)", cmd, self.cwd)
        self.pty.spawn(cmd, cwd=self.cwd)

        time.sleep(self.config.initial_settle_time)

        # Wait for JSONL to appear
        logger.info("Waiting for JSONL transcript...")
        jsonl_path = self.watcher.locate_file(
            wait=True, timeout=self.config.jsonl_appear_timeout
        )
        if jsonl_path is None:
            logger.error("JSONL file did not appear")
            return False

        logger.info("JSONL found: %s", jsonl_path)

        # Wait for idle
        logger.info("Waiting for builder to be ready...")
        ready = self.watcher.wait_for_idle(timeout=self.config.jsonl_appear_timeout)
        if not ready:
            logger.warning("Builder didn't reach idle state. Proceeding anyway.")

        self._last_activity = time.time()
        self._running = True

        # Start health check thread
        self._health_thread = threading.Thread(target=self._health_loop, daemon=True)
        self._health_thread.start()

        return True

    def respawn(self, state: ProjectState | None = None) -> bool:
        """Kill current process and respawn with context restoration."""
        self._respawn_count += 1
        logger.warning(
            "Respawning builder (attempt #%d)...", self._respawn_count
        )

        self.shutdown(graceful=False)

        success = self.spawn()
        if not success:
            return False

        # Context restoration
        if state:
            self._restore_context(state)

        return True

    def _restore_context(self, state: ProjectState) -> None:
        """Send context restoration prompt to the newly spawned builder."""
        completed = [
            t for t in state.all_tasks if t.status == TaskStatus.DONE
        ]
        current_phase = state.current_phase

        ctx_lines = [
            f"You are working on the project '{state.project}'.",
            f"Working directory: {state.cwd}",
            "",
        ]

        if completed:
            ctx_lines.append(
                f"The following {len(completed)} tasks are already complete:"
            )
            for t in completed[-10:]:  # Last 10 to avoid context overflow
                ctx_lines.append(f"  - [{t.id}] {t.prompt[:80]}")
            ctx_lines.append("")

        if current_phase:
            ctx_lines.append(
                f"Current phase: {current_phase.name}"
            )

        ctx_lines.append(
            "Please familiarize yourself with the existing code by looking "
            "at the project structure. Then wait for the next task."
        )

        context_prompt = "\n".join(ctx_lines)
        self.send(context_prompt)

        logger.info("Sent context restoration prompt (%d chars)", len(context_prompt))

        # Wait for Claude to process the context
        if self.watcher:
            self.watcher.wait_for_idle(timeout=120)

    def send(self, text: str) -> None:
        """Send text to the builder."""
        if self.pty is None:
            raise RuntimeError("Builder not spawned")
        self.pty.send(text + "\n")
        self._last_activity = time.time()

    def send_exit(self) -> None:
        """Send /exit to the builder."""
        if self.pty and self.pty.is_alive():
            self.pty.send("/exit\n")
            logger.info("Sent /exit to builder")

    def read_output(self, timeout: float = 0.5) -> str:
        """Read recent PTY output."""
        if self.pty is None:
            return ""
        return self.pty.read(timeout=timeout)

    def wait_for_idle(self, timeout: float | None = None) -> bool:
        """Wait for the builder to finish its current turn."""
        if self.watcher is None:
            return False
        t = timeout or self.config.turn_timeout
        result = self.watcher.wait_for_idle(timeout=t)
        if result:
            self._last_activity = time.time()
        return result

    def shutdown(self, graceful: bool = True) -> None:
        """Shut down the builder process."""
        self._running = False

        if graceful and self.pty and self.pty.is_alive():
            self.send_exit()
            time.sleep(3)

        if self.pty:
            self.pty.close()
            self.pty = None

        self.watcher = None
        logger.info("Builder shut down (graceful=%s)", graceful)

    def _health_loop(self) -> None:
        """Background thread: periodically check builder health."""
        stale_threshold = self.config.turn_timeout + 60

        while self._running:
            time.sleep(self.config.health_check_interval)

            if not self._running:
                break

            if self.pty and not self.pty.is_alive():
                logger.error("Health check: builder process is dead")
                if self._on_health_fail:
                    self._on_health_fail("process_dead")
                break

            # Check for stale state (no activity for too long)
            elapsed = time.time() - self._last_activity
            if elapsed > stale_threshold:
                logger.warning(
                    "Health check: no activity for %.0fs (threshold: %.0fs)",
                    elapsed,
                    stale_threshold,
                )
