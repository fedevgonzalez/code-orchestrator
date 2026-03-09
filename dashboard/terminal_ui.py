"""Rich terminal dashboard for real-time orchestration progress."""

import logging
import threading
import time
from datetime import datetime

from models import ProjectState, Phase, Task, TaskStatus, PhaseStatus

logger = logging.getLogger(__name__)

# Try to import rich, fall back to plain output
try:
    from rich.console import Console
    from rich.table import Table
    from rich.live import Live
    from rich.panel import Panel
    from rich.layout import Layout
    from rich.text import Text
    HAS_RICH = True
except ImportError:
    HAS_RICH = False


def format_duration(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}h {m}m {s}s"
    if m > 0:
        return f"{m}m {s}s"
    return f"{s}s"


def print_progress(state: ProjectState) -> None:
    """Print a progress summary to the terminal."""
    if HAS_RICH:
        _print_rich(state)
    else:
        _print_plain(state)


def _print_plain(state: ProjectState) -> None:
    """Fallback plain-text progress display."""
    elapsed = time.time() - state.started_at if state.started_at else 0
    done = len(state.completed_tasks)
    total = len(state.all_tasks)
    failed = len(state.failed_tasks)

    print(f"\n--- Progress: {done}/{total} tasks done ({failed} failed) | {format_duration(elapsed)} ---")

    for phase in state.phases:
        icon = {"done": "+", "running": ">", "failed": "X", "pending": " "}.get(phase.status.value, "?")
        print(f"  [{icon}] {phase.name}")
        for task in phase.tasks:
            t_icon = {"done": "+", "running": ">", "reviewing": "?", "fixing": "~", "failed": "X", "skipped": "-"}.get(task.status.value, " ")
            line = f"      [{t_icon}] {task.id}"
            if task.review_score:
                line += f" (score: {task.review_score}/10)"
            if task.error:
                line += f" -- {task.error[:50]}"
            print(line)

    print()


def _print_rich(state: ProjectState) -> None:
    """Rich-formatted progress display."""
    console = Console()
    elapsed = time.time() - state.started_at if state.started_at else 0
    done = len(state.completed_tasks)
    total = len(state.all_tasks)
    failed = len(state.failed_tasks)

    # Header
    header = Text()
    header.append(f"Project: {state.project}", style="bold cyan")
    header.append(f"  |  {done}/{total} tasks", style="green" if failed == 0 else "yellow")
    if failed:
        header.append(f"  |  {failed} failed", style="red")
    header.append(f"  |  {format_duration(elapsed)}", style="dim")
    console.print(Panel(header, title="Claude Orchestrator V2"))

    # Phase table
    table = Table(show_header=True, header_style="bold")
    table.add_column("Status", width=4)
    table.add_column("Phase", min_width=20)
    table.add_column("Tasks", width=10)
    table.add_column("Score", width=8)

    for phase in state.phases:
        icon = {
            PhaseStatus.DONE: "[green]OK[/green]",
            PhaseStatus.RUNNING: "[yellow]>>>[/yellow]",
            PhaseStatus.GATE_CHECK: "[cyan]CHK[/cyan]",
            PhaseStatus.FAILED: "[red]FAIL[/red]",
            PhaseStatus.PENDING: "[dim]---[/dim]",
        }.get(phase.status, "?")

        phase_done = sum(1 for t in phase.tasks if t.status == TaskStatus.DONE)
        phase_total = len(phase.tasks)
        scores = [t.review_score for t in phase.tasks if t.review_score > 0]
        avg_score = f"{sum(scores)/len(scores):.1f}" if scores else "-"

        table.add_row(icon, phase.name, f"{phase_done}/{phase_total}", avg_score)

    console.print(table)
    console.print()
