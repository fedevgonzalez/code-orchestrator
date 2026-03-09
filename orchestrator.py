#!/usr/bin/env python3
"""Claude Orchestrator V2 — Dual-agent autonomous SaaS development.

Architecture:
  BUILDER (Claude Code PTY) — writes code, runs commands
  REVIEWER (Claude Code pipe) — reviews code, validates quality
  ENGINE (state machine) — manages phases, tasks, recovery
  WATCHER (optional Node.js) — lightweight JSONL monitor via WebSocket

Usage:
    # Full SaaS from a spec (overnight mode)
    python orchestrator.py --spec my-saas.md --cwd ./my-saas

    # Resume a crashed run
    python orchestrator.py --resume --cwd ./my-saas

    # From existing tasks
    python orchestrator.py --tasks tasks.json

    # Single prompt (no phases/review)
    python orchestrator.py --cwd ./project --prompt "Add auth"

    # Options
    python orchestrator.py --spec spec.md --cwd ./out --no-review --verbose --dry-run
"""

import argparse
import json
import logging
import os
import sys
import time
import uuid

from config import OrchestratorConfig
from models import ProjectState, Phase, Task, TaskStatus, PhaseStatus, GateConfig
from engine.state_machine import OrchestrationEngine
from engine.checkpoint import save_checkpoint, load_checkpoint
from spec.analyzer import analyze_spec
from spec.phase_planner import create_phase_plan
from spec.task_generator import generate_tasks_for_phase
from spec_parser import load_spec_summary

logger = logging.getLogger("orchestrator")


def build_state_from_spec(
    spec_path: str,
    cwd: str,
    project_name: str,
    config: OrchestratorConfig,
) -> ProjectState:
    """Analyze a spec and build the full phased execution plan."""
    spec_text = load_spec_summary(spec_path, max_chars=8000)
    os.makedirs(cwd, exist_ok=True)

    # Step 1: Analyze spec
    logger.info("Step 1/3: Analyzing spec...")
    analysis = analyze_spec(spec_text, cwd)

    # Step 2: Create phase plan
    logger.info("Step 2/3: Creating phase plan...")
    phases = create_phase_plan(analysis)

    # Step 3: Generate tasks for each phase
    logger.info("Step 3/3: Generating tasks for %d phases...", len(phases))
    completed_phase_names = []

    for phase in phases:
        tasks = generate_tasks_for_phase(
            phase=phase,
            spec_summary=spec_text,
            analysis=analysis,
            completed_phases=completed_phase_names,
            cwd=cwd,
        )
        phase.tasks = tasks
        completed_phase_names.append(phase.name)

    total_tasks = sum(len(p.tasks) for p in phases)
    logger.info("Plan ready: %d phases, %d total tasks", len(phases), total_tasks)

    state = ProjectState(
        run_id=uuid.uuid4().hex[:12],
        project=project_name or analysis.get("project_name", "project"),
        cwd=cwd,
        spec_summary=spec_text,
        phases=phases,
    )

    # Save the generated plan for reference
    plan_path = os.path.join(cwd, ".orchestrator", "plan.json")
    os.makedirs(os.path.dirname(plan_path), exist_ok=True)
    save_checkpoint(state, plan_path)
    logger.info("Plan saved: %s", plan_path)

    return state


def build_state_from_tasks(tasks_path: str, cwd: str) -> ProjectState:
    """Build state from an existing tasks.json (V1 compatibility)."""
    with open(tasks_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    tasks = []
    for t in data.get("tasks", []):
        tasks.append(Task(
            id=t["id"],
            prompt=t["prompt"],
            phase_id="default",
            depends_on=t.get("depends_on"),
            validate=t.get("validate"),
            max_retries=t.get("max_retries", 2),
            max_review_cycles=t.get("max_review_cycles", 3),
        ))

    phase = Phase(
        id="default",
        name="All Tasks",
        tasks=tasks,
        gate=GateConfig(),
    )

    project_cwd = os.path.abspath(data.get("cwd", cwd))

    return ProjectState(
        run_id=uuid.uuid4().hex[:12],
        project=data.get("project", "project"),
        cwd=project_cwd,
        phases=[phase],
    )


def build_state_from_prompt(cwd: str, prompt: str) -> ProjectState:
    """Build state for a single prompt."""
    phase = Phase(
        id="single",
        name="Single Task",
        tasks=[Task(id="task", prompt=prompt, phase_id="single")],
        gate=GateConfig(),
    )

    return ProjectState(
        run_id=uuid.uuid4().hex[:12],
        project=os.path.basename(cwd),
        cwd=cwd,
        phases=[phase],
    )


def dry_run(state: ProjectState) -> None:
    """Print the execution plan without running."""
    print("\n[DRY RUN] Execution Plan:")
    print(f"  Project: {state.project}")
    print(f"  Directory: {state.cwd}")
    print()

    for i, phase in enumerate(state.phases):
        print(f"  Phase {i+1}: {phase.name} ({len(phase.tasks)} tasks)")
        if phase.gate.file_checks:
            print(f"    Gate files: {', '.join(phase.gate.file_checks)}")
        if phase.gate.command_checks:
            print(f"    Gate commands: {', '.join(phase.gate.command_checks)}")
        for task in phase.tasks:
            dep = f" (depends: {task.depends_on})" if task.depends_on else ""
            val = f" [validate: {task.validate}]" if task.validate else ""
            print(f"    - [{task.id}]{dep} {task.prompt[:80]}...{val}")
        print()

    total = sum(len(p.tasks) for p in state.phases)
    print(f"  Total: {len(state.phases)} phases, {total} tasks")


def main():
    parser = argparse.ArgumentParser(
        description="Claude Orchestrator V2 — Autonomous SaaS development",
    )

    # Input modes
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument("--spec", type=str, help="Product spec file (.md)")
    input_group.add_argument("--tasks", type=str, help="Tasks file (.json)")
    input_group.add_argument("--prompt", type=str, help="Single task prompt")
    input_group.add_argument("--resume", action="store_true", help="Resume from checkpoint")

    # Project
    parser.add_argument("--cwd", type=str, default=".", help="Project directory")
    parser.add_argument("--project-name", type=str, help="Project name")
    parser.add_argument("--config", type=str, help="Config file (YAML)")

    # Behavior
    parser.add_argument("--no-review", action="store_true", help="Disable AI reviewer")
    parser.add_argument("--timeout", type=int, default=600, help="Turn timeout (seconds)")
    parser.add_argument("--dry-run", action="store_true", help="Show plan only")
    parser.add_argument("--verbose", action="store_true", help="Detailed logging")

    args = parser.parse_args()

    # Logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    if not any([args.spec, args.tasks, args.prompt, args.resume]):
        parser.error("One of --spec, --tasks, --prompt, or --resume is required")

    cwd = os.path.abspath(args.cwd)
    config = OrchestratorConfig.load(args.config)
    config.turn_timeout = args.timeout

    # Build or load state
    if args.resume:
        checkpoint_path = config.checkpoint_path(cwd)
        state = load_checkpoint(checkpoint_path)
        if state is None:
            logger.error("No checkpoint found at %s", checkpoint_path)
            sys.exit(1)
        logger.info("Resuming run %s from checkpoint", state.run_id)

    elif args.spec:
        state = build_state_from_spec(
            spec_path=os.path.abspath(args.spec),
            cwd=cwd,
            project_name=args.project_name,
            config=config,
        )

    elif args.tasks:
        state = build_state_from_tasks(args.tasks, cwd)

    else:
        state = build_state_from_prompt(cwd, args.prompt)

    # Dry run
    if args.dry_run:
        dry_run(state)
        sys.exit(0)

    # Run
    engine = OrchestrationEngine(
        state=state,
        config=config,
        enable_review=not args.no_review,
        verbose=args.verbose,
    )

    success = engine.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
