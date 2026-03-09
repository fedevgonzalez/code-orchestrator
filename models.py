"""Shared data models for Claude Orchestrator V2."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    REVIEWING = "reviewing"
    FIXING = "fixing"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class PhaseStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    GATE_CHECK = "gate_check"
    DONE = "done"
    FAILED = "failed"


@dataclass
class Task:
    id: str
    prompt: str
    phase_id: str | None = None
    depends_on: str | None = None
    validate: str | None = None
    browser_validation: list[dict] | None = None
    context_files: list[str] | None = None
    status: TaskStatus = TaskStatus.PENDING
    retries: int = 0
    max_retries: int = 2
    review_cycles: int = 0
    max_review_cycles: int = 3
    review_score: int = 0
    error: str | None = None


@dataclass
class GateConfig:
    """Validation checks that must pass before moving to next phase."""
    file_checks: list[str] = field(default_factory=list)
    command_checks: list[str] = field(default_factory=list)
    server_checks: list[dict] = field(default_factory=list)
    browser_checks: list[dict] = field(default_factory=list)


@dataclass
class Phase:
    id: str
    name: str
    tasks: list[Task] = field(default_factory=list)
    gate: GateConfig = field(default_factory=GateConfig)
    status: PhaseStatus = PhaseStatus.PENDING
    depends_on: list[str] = field(default_factory=list)


@dataclass
class ProjectState:
    """Full orchestration state — persisted to checkpoint."""
    run_id: str = ""
    project: str = ""
    cwd: str = ""
    spec_summary: str = ""
    started_at: float = 0.0
    current_phase_idx: int = 0
    current_task_idx: int = 0
    phases: list[Phase] = field(default_factory=list)
    builder_jsonl_path: str | None = None
    status: str = "initializing"  # initializing, running, paused, failed, done

    @property
    def all_tasks(self) -> list[Task]:
        """Flat list of all tasks across all phases."""
        tasks = []
        for phase in self.phases:
            tasks.extend(phase.tasks)
        return tasks

    @property
    def completed_tasks(self) -> list[Task]:
        return [t for t in self.all_tasks if t.status == TaskStatus.DONE]

    @property
    def failed_tasks(self) -> list[Task]:
        return [t for t in self.all_tasks if t.status == TaskStatus.FAILED]

    @property
    def current_phase(self) -> Phase | None:
        if 0 <= self.current_phase_idx < len(self.phases):
            return self.phases[self.current_phase_idx]
        return None
