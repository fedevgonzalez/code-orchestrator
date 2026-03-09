"""Watch Claude Code JSONL transcript files to detect state changes.

Claude Code writes JSONL transcripts to:
  ~/.claude/projects/<project-hash>/<session-id>.jsonl

The project hash is derived from the project path with path separators
replaced by dashes (e.g., G:\\GitHub\\my-project -> G--GitHub-my-project).
"""

import json
import os
import time
import logging
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AgentState(Enum):
    UNKNOWN = "unknown"
    WORKING = "working"        # Agent is using tools
    RESPONDING = "responding"  # Agent is outputting text
    IDLE = "idle"              # Turn finished, waiting for input
    EXITED = "exited"          # Session ended


@dataclass
class WatcherEvent:
    state: AgentState
    record: dict = field(default_factory=dict)
    timestamp: float = 0.0


def project_hash(cwd: str) -> str:
    """Compute the Claude Code project hash from a working directory path.

    Replicates Claude Code's hashing: replace path separators and colons
    with dashes.
    """
    # Normalize path
    normalized = os.path.normpath(cwd)
    # Replace separators and colon with dashes
    h = normalized.replace("\\", "-").replace("/", "-").replace(":", "-")
    # Remove leading dash if present
    h = h.lstrip("-")
    return h


def find_claude_projects_dir() -> Path:
    """Return the ~/.claude/projects/ directory."""
    return Path.home() / ".claude" / "projects"


def find_jsonl_dir(cwd: str) -> Path:
    """Find the JSONL directory for a given project cwd."""
    projects_dir = find_claude_projects_dir()
    h = project_hash(cwd)
    return projects_dir / h


def find_latest_jsonl(cwd: str) -> Path | None:
    """Find the most recently modified .jsonl file for a project."""
    jsonl_dir = find_jsonl_dir(cwd)
    if not jsonl_dir.exists():
        return None

    jsonl_files = list(jsonl_dir.glob("*.jsonl"))
    if not jsonl_files:
        return None

    return max(jsonl_files, key=lambda f: f.stat().st_mtime)


def parse_record(line: str) -> dict | None:
    """Parse a single JSONL line into a dict."""
    line = line.strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        logger.debug("Failed to parse JSONL line: %s", line[:100])
        return None


def classify_record(record: dict) -> AgentState:
    """Classify a JSONL record into an AgentState."""
    rec_type = record.get("type", "")
    subtype = record.get("subtype", "")

    # Turn finished — agent is idle
    if rec_type == "system" and subtype == "turn_duration":
        return AgentState.IDLE

    # Agent is using tools
    if rec_type == "assistant":
        message = record.get("message", {})
        content = message.get("content", [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    return AgentState.WORKING

        # Check top-level content too
        content_top = record.get("content", [])
        if isinstance(content_top, list):
            for block in content_top:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    return AgentState.WORKING

        return AgentState.RESPONDING

    # Session exit
    if rec_type == "user":
        content = record.get("content", "")
        if isinstance(content, str) and "/exit" in content:
            return AgentState.EXITED
        if isinstance(content, list):
            for block in content:
                text = block.get("text", "") if isinstance(block, dict) else str(block)
                if "/exit" in text:
                    return AgentState.EXITED

    return AgentState.UNKNOWN


class JSONLWatcher:
    """Watch a JSONL file for new records and emit state changes."""

    def __init__(self, cwd: str):
        self.cwd = cwd
        self._file_path: Path | None = None
        self._file_pos: int = 0
        self._last_state = AgentState.UNKNOWN

    @property
    def current_state(self) -> AgentState:
        return self._last_state

    def locate_file(self, wait: bool = True, timeout: float = 120) -> Path | None:
        """Find the JSONL file, optionally waiting for it to appear."""
        start = time.time()
        while True:
            path = find_latest_jsonl(self.cwd)
            if path is not None:
                # If we already have a file, check if a newer one appeared
                if self._file_path is None or path != self._file_path:
                    self._file_path = path
                    self._file_pos = 0
                    logger.info("Watching JSONL: %s", path)
                return path

            if not wait or (time.time() - start) > timeout:
                return None
            time.sleep(0.5)

    def poll(self) -> list[WatcherEvent]:
        """Read new records from the JSONL file and return events."""
        events = []

        if self._file_path is None:
            self.locate_file(wait=False)
            if self._file_path is None:
                return events

        # Check if a newer file appeared
        latest = find_latest_jsonl(self.cwd)
        if latest and latest != self._file_path:
            self._file_path = latest
            self._file_pos = 0
            logger.info("Switched to newer JSONL: %s", latest)

        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                f.seek(self._file_pos)
                new_lines = f.readlines()
                self._file_pos = f.tell()
        except (OSError, IOError) as e:
            logger.debug("Error reading JSONL: %s", e)
            return events

        for line in new_lines:
            record = parse_record(line)
            if record is None:
                continue

            state = classify_record(record)
            if state != AgentState.UNKNOWN:
                event = WatcherEvent(
                    state=state,
                    record=record,
                    timestamp=time.time(),
                )
                events.append(event)
                self._last_state = state
                logger.debug("State -> %s", state.value)

        return events

    def wait_for_idle(
        self, timeout: float = 600, poll_interval: float = 1.0
    ) -> bool:
        """Block until agent reaches IDLE state. Returns True if idle, False on timeout."""
        start = time.time()
        while (time.time() - start) < timeout:
            events = self.poll()
            for ev in events:
                if ev.state == AgentState.IDLE:
                    return True
                if ev.state == AgentState.EXITED:
                    return True
            time.sleep(poll_interval)
        return False
