"""Task queue logic: load tasks, resolve dependencies, validate results."""

import json
import os
import subprocess
import logging
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    REVIEWING = "reviewing"
    FIXING = "fixing"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Task:
    id: str
    prompt: str
    depends_on: str | None = None
    validate: str | None = None
    status: TaskStatus = TaskStatus.PENDING
    retries: int = 0
    max_retries: int = 2
    review_cycles: int = 0
    max_review_cycles: int = 3
    review_score: int = 0
    error: str | None = None


@dataclass
class TaskFile:
    project: str
    cwd: str
    spec_summary: str = ""
    tasks: list[Task] = field(default_factory=list)


def load_tasks(path: str) -> TaskFile:
    """Load tasks from a JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    tasks = []
    for t in data.get("tasks", []):
        tasks.append(
            Task(
                id=t["id"],
                prompt=t["prompt"],
                depends_on=t.get("depends_on"),
                validate=t.get("validate"),
                max_retries=t.get("max_retries", 2),
                max_review_cycles=t.get("max_review_cycles", 3),
            )
        )

    return TaskFile(
        project=data.get("project", "unknown"),
        cwd=data.get("cwd", "."),
        tasks=tasks,
    )


def get_next_task(task_file: TaskFile) -> Task | None:
    """Get the next runnable task respecting dependencies."""
    done_ids = {t.id for t in task_file.tasks if t.status == TaskStatus.DONE}
    failed_ids = {t.id for t in task_file.tasks if t.status == TaskStatus.FAILED}

    for task in task_file.tasks:
        if task.status != TaskStatus.PENDING:
            continue

        # Check dependency
        if task.depends_on:
            if task.depends_on in failed_ids:
                task.status = TaskStatus.SKIPPED
                task.error = f"Dependency '{task.depends_on}' failed"
                logger.warning("Skipping task '%s': %s", task.id, task.error)
                continue
            if task.depends_on not in done_ids:
                continue  # Dependency not done yet, skip for now

        return task

    return None


def all_tasks_complete(task_file: TaskFile) -> bool:
    """Check if all tasks are done, failed, or skipped."""
    return all(
        t.status in (TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.SKIPPED)
        for t in task_file.tasks
    )


class TaskValidator:
    """Validate task results."""

    def __init__(self, cwd: str):
        self.cwd = cwd

    def validate(self, task: Task) -> tuple[bool, str]:
        """Run validation for a task. Returns (success, message)."""
        if not task.validate:
            return True, "No validation required"

        validation = task.validate.strip()

        if validation.startswith("check file:"):
            return self._check_files(validation)
        elif validation.startswith("run:"):
            return self._run_command(validation)
        else:
            logger.warning("Unknown validation type: %s", validation)
            return True, f"Unknown validation type, skipping: {validation}"

    def _check_files(self, validation: str) -> tuple[bool, str]:
        """Check that specified files exist."""
        files_str = validation.removeprefix("check file:").strip()
        files = [f.strip() for f in files_str.split(",")]

        missing = []
        for f in files:
            full_path = Path(self.cwd) / f
            if not full_path.exists():
                missing.append(f)

        if missing:
            msg = f"Missing files: {', '.join(missing)}"
            return False, msg

        return True, f"All files exist: {', '.join(files)}"

    def _run_command(self, validation: str) -> tuple[bool, str]:
        """Run a command and check exit code."""
        cmd = validation.removeprefix("run:").strip()
        logger.info("Running validation command: %s", cmd)

        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=self.cwd,
                capture_output=True,
                text=True,
                timeout=300,
            )

            if result.returncode == 0:
                return True, f"Command succeeded: {cmd}"
            else:
                stderr = result.stderr.strip()[-500:] if result.stderr else ""
                stdout = result.stdout.strip()[-500:] if result.stdout else ""
                output = stderr or stdout
                return False, f"Command failed (exit {result.returncode}): {output}"

        except subprocess.TimeoutExpired:
            return False, f"Command timed out after 300s: {cmd}"
        except Exception as e:
            return False, f"Command error: {e}"


def save_progress(task_file: TaskFile, path: str) -> None:
    """Save current task statuses to a progress file."""
    progress = {
        "project": task_file.project,
        "cwd": task_file.cwd,
        "tasks": [],
    }
    for t in task_file.tasks:
        progress["tasks"].append({
            "id": t.id,
            "status": t.status.value,
            "retries": t.retries,
            "review_cycles": t.review_cycles,
            "review_score": t.review_score,
            "error": t.error,
        })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)


def format_task_summary(task_file: TaskFile) -> str:
    """Format a summary of all tasks and their statuses."""
    lines = [f"Project: {task_file.project}", ""]
    for t in task_file.tasks:
        status_icon = {
            TaskStatus.PENDING: "○",
            TaskStatus.RUNNING: "►",
            TaskStatus.REVIEWING: "⊙",
            TaskStatus.FIXING: "⟳",
            TaskStatus.DONE: "✓",
            TaskStatus.FAILED: "✗",
            TaskStatus.SKIPPED: "⊘",
        }.get(t.status, "?")
        line = f"  {status_icon} [{t.status.value:>9}] {t.id}"
        if t.review_score > 0:
            line += f"  (score: {t.review_score}/10)"
        if t.review_cycles > 0:
            line += f"  [reviews: {t.review_cycles}]"
        if t.error:
            line += f"  — {t.error}"
        lines.append(line)
    return "\n".join(lines)
