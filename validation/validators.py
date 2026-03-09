"""Validation dispatcher — routes validation configs to the right strategy."""

import logging
import subprocess
from pathlib import Path

from models import Task

logger = logging.getLogger(__name__)


def run_validation(task: Task, cwd: str) -> tuple[bool, str]:
    """Run validation for a task. Returns (success, message)."""
    if not task.validate:
        return True, "No validation required"

    validation = task.validate.strip()

    if validation.startswith("check file:"):
        return _check_files(validation, cwd)
    elif validation.startswith("run:"):
        return _run_command(validation, cwd)
    elif validation.startswith("server:"):
        return _check_server(validation, cwd)
    else:
        logger.warning("Unknown validation type: %s", validation)
        return True, f"Unknown validation, skipping: {validation}"


def _check_files(validation: str, cwd: str) -> tuple[bool, str]:
    """Check that specified files exist."""
    files_str = validation.removeprefix("check file:").strip()
    files = [f.strip() for f in files_str.split(",")]

    missing = []
    for f in files:
        if not (Path(cwd) / f).exists():
            missing.append(f)

    if missing:
        return False, f"Missing files: {', '.join(missing)}"
    return True, f"All files exist: {', '.join(files)}"


def _run_command(validation: str, cwd: str) -> tuple[bool, str]:
    """Run a command and check exit code."""
    cmd = validation.removeprefix("run:").strip()
    logger.info("Running validation: %s", cmd)

    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd,
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            return True, f"Command succeeded: {cmd}"

        output = (result.stderr or result.stdout or "").strip()[-500:]
        return False, f"Command failed (exit {result.returncode}): {output}"

    except subprocess.TimeoutExpired:
        return False, f"Command timed out: {cmd}"
    except Exception as e:
        return False, f"Command error: {e}"


def _check_server(validation: str, cwd: str) -> tuple[bool, str]:
    """Start a server, check it responds, then stop it.

    Format: server: start_cmd | url | timeout_seconds
    Example: server: npm run dev | http://localhost:3000 | 30
    """
    import socket
    import time
    from urllib.parse import urlparse

    parts = validation.removeprefix("server:").strip().split("|")
    start_cmd = parts[0].strip()
    url = parts[1].strip() if len(parts) > 1 else "http://localhost:3000"
    timeout = int(parts[2].strip()) if len(parts) > 2 else 30

    parsed = urlparse(url)
    port = parsed.port or 3000

    try:
        proc = subprocess.Popen(
            start_cmd, shell=True, cwd=cwd,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
    except Exception as e:
        return False, f"Failed to start server: {e}"

    # Wait for port
    start_time = time.time()
    ready = False
    while time.time() - start_time < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            if sock.connect_ex(("localhost", port)) == 0:
                ready = True
                sock.close()
                break
            sock.close()
        except Exception:
            pass
        time.sleep(1)

    # Stop server
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        proc.kill()

    if ready:
        return True, f"Server responded on port {port}"
    return False, f"Server did not respond on port {port} within {timeout}s"
