"""State persistence and crash recovery.

Writes atomic checkpoint files after every state transition so the
orchestrator can resume after a crash mid-run.
"""

import json
import os
import time
import logging
from pathlib import Path

from models import ProjectState, Phase, Task, GateConfig, TaskStatus, PhaseStatus

logger = logging.getLogger(__name__)


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "prompt": task.prompt,
        "phase_id": task.phase_id,
        "depends_on": task.depends_on,
        "validate": task.validate,
        "browser_validation": task.browser_validation,
        "context_files": task.context_files,
        "status": task.status.value,
        "retries": task.retries,
        "max_retries": task.max_retries,
        "review_cycles": task.review_cycles,
        "max_review_cycles": task.max_review_cycles,
        "review_score": task.review_score,
        "error": task.error,
    }


def _task_from_dict(d: dict) -> Task:
    return Task(
        id=d["id"],
        prompt=d["prompt"],
        phase_id=d.get("phase_id"),
        depends_on=d.get("depends_on"),
        validate=d.get("validate"),
        browser_validation=d.get("browser_validation"),
        context_files=d.get("context_files"),
        status=TaskStatus(d.get("status", "pending")),
        retries=d.get("retries", 0),
        max_retries=d.get("max_retries", 2),
        review_cycles=d.get("review_cycles", 0),
        max_review_cycles=d.get("max_review_cycles", 3),
        review_score=d.get("review_score", 0),
        error=d.get("error"),
    )


def _phase_to_dict(phase: Phase) -> dict:
    return {
        "id": phase.id,
        "name": phase.name,
        "tasks": [_task_to_dict(t) for t in phase.tasks],
        "gate": {
            "file_checks": phase.gate.file_checks,
            "command_checks": phase.gate.command_checks,
            "server_checks": phase.gate.server_checks,
            "browser_checks": phase.gate.browser_checks,
        },
        "status": phase.status.value,
        "depends_on": phase.depends_on,
    }


def _phase_from_dict(d: dict) -> Phase:
    gate_data = d.get("gate", {})
    return Phase(
        id=d["id"],
        name=d["name"],
        tasks=[_task_from_dict(t) for t in d.get("tasks", [])],
        gate=GateConfig(
            file_checks=gate_data.get("file_checks", []),
            command_checks=gate_data.get("command_checks", []),
            server_checks=gate_data.get("server_checks", []),
            browser_checks=gate_data.get("browser_checks", []),
        ),
        status=PhaseStatus(d.get("status", "pending")),
        depends_on=d.get("depends_on", []),
    )


def save_checkpoint(state: ProjectState, path: str | Path) -> None:
    """Atomically save the full orchestration state."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "run_id": state.run_id,
        "project": state.project,
        "cwd": state.cwd,
        "spec_summary": state.spec_summary[:2000],  # truncate
        "started_at": state.started_at,
        "current_phase_idx": state.current_phase_idx,
        "current_task_idx": state.current_task_idx,
        "phases": [_phase_to_dict(p) for p in state.phases],
        "builder_jsonl_path": state.builder_jsonl_path,
        "status": state.status,
        "saved_at": time.time(),
    }

    tmp_path = path.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Atomic rename
    if os.name == "nt":
        # Windows: can't rename over existing file
        if path.exists():
            path.unlink()
    tmp_path.rename(path)

    logger.debug("Checkpoint saved: %s", path)


def load_checkpoint(path: str | Path) -> ProjectState | None:
    """Load orchestration state from a checkpoint file."""
    path = Path(path)
    if not path.exists():
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to load checkpoint: %s", e)
        return None

    state = ProjectState(
        run_id=data.get("run_id", ""),
        project=data.get("project", ""),
        cwd=data.get("cwd", ""),
        spec_summary=data.get("spec_summary", ""),
        started_at=data.get("started_at", 0.0),
        current_phase_idx=data.get("current_phase_idx", 0),
        current_task_idx=data.get("current_task_idx", 0),
        phases=[_phase_from_dict(p) for p in data.get("phases", [])],
        builder_jsonl_path=data.get("builder_jsonl_path"),
        status=data.get("status", "paused"),
    )

    logger.info(
        "Loaded checkpoint: run=%s, phase=%d, task=%d, status=%s",
        state.run_id,
        state.current_phase_idx,
        state.current_task_idx,
        state.status,
    )

    return state
