"""Cross-platform PTY adapter for spawning Claude Code in a real terminal.

Windows: uses pywinpty (ConPTY)
Linux/Mac: uses pexpect (Unix PTY)
"""

import sys
import time
import threading
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BasePTY(ABC):
    """Abstract PTY interface."""

    @abstractmethod
    def spawn(self, cmd: str, cwd: str, env: dict | None = None) -> None:
        """Spawn a process in a PTY."""

    @abstractmethod
    def send(self, text: str) -> None:
        """Send text to the PTY stdin."""

    @abstractmethod
    def read(self, timeout: float = 0.1) -> str:
        """Read available output from PTY. Non-blocking with timeout."""

    @abstractmethod
    def is_alive(self) -> bool:
        """Check if the spawned process is still running."""

    @abstractmethod
    def close(self) -> None:
        """Close the PTY and terminate the process."""


class WindowsPTY(BasePTY):
    """PTY adapter using pywinpty for Windows (ConPTY)."""

    def __init__(self):
        self._process = None
        self._output_buffer: list[str] = []
        self._reader_thread: threading.Thread | None = None
        self._running = False

    def spawn(self, cmd: str, cwd: str, env: dict | None = None) -> None:
        try:
            from winpty import PtyProcess
        except ImportError:
            raise ImportError(
                "pywinpty is required on Windows. Install with: pip install pywinpty"
            )

        args = cmd.split()
        self._process = PtyProcess.spawn(args, cwd=cwd)
        self._running = True
        self._reader_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._reader_thread.start()
        logger.info("Spawned process via pywinpty: %s", cmd)

    def _read_loop(self):
        while self._running and self._process is not None:
            try:
                data = self._process.read(4096)
                if data:
                    self._output_buffer.append(data)
            except EOFError:
                self._running = False
                break
            except Exception:
                time.sleep(0.05)

    def send(self, text: str) -> None:
        if self._process is None:
            raise RuntimeError("PTY not spawned")
        self._process.write(text)

    def read(self, timeout: float = 0.1) -> str:
        time.sleep(timeout)
        if not self._output_buffer:
            return ""
        output = "".join(self._output_buffer)
        self._output_buffer.clear()
        return output

    def is_alive(self) -> bool:
        if self._process is None:
            return False
        return self._process.isalive()

    def close(self) -> None:
        self._running = False
        if self._process is not None:
            try:
                self._process.close(force=True)
            except Exception:
                pass
            self._process = None
        logger.info("PTY closed")


class UnixPTY(BasePTY):
    """PTY adapter using pexpect for Linux/Mac."""

    def __init__(self):
        self._child = None

    def spawn(self, cmd: str, cwd: str, env: dict | None = None) -> None:
        try:
            import pexpect
        except ImportError:
            raise ImportError(
                "pexpect is required on Linux/Mac. Install with: pip install pexpect"
            )

        self._child = pexpect.spawn(
            cmd,
            cwd=cwd,
            env=env,
            encoding="utf-8",
            timeout=None,
            dimensions=(24, 200),
        )
        logger.info("Spawned process via pexpect: %s", cmd)

    def send(self, text: str) -> None:
        if self._child is None:
            raise RuntimeError("PTY not spawned")
        self._child.send(text)

    def read(self, timeout: float = 0.1) -> str:
        if self._child is None:
            return ""
        import pexpect

        try:
            # Read whatever is available
            index = self._child.expect(
                [pexpect.TIMEOUT, pexpect.EOF], timeout=timeout
            )
            before = self._child.before or ""
            if index == 1:  # EOF
                return before
            return before
        except pexpect.TIMEOUT:
            return self._child.before or ""
        except Exception:
            return ""

    def is_alive(self) -> bool:
        if self._child is None:
            return False
        return self._child.isalive()

    def close(self) -> None:
        if self._child is not None:
            try:
                self._child.close(force=True)
            except Exception:
                pass
            self._child = None
        logger.info("PTY closed")


def create_pty() -> BasePTY:
    """Factory: return the right PTY adapter for the current platform."""
    if sys.platform == "win32":
        return WindowsPTY()
    else:
        return UnixPTY()
