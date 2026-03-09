"""Core orchestration state machine with persistence and crash recovery.

This is the heart of V2 — replaces the procedural while loop in V1's
orchestrator.py with an explicit state machine that survives crashes.
"""

import logging
import time
import uuid
from datetime import datetime

from config import OrchestratorConfig
from models import (
    ProjectState, Phase, Task, TaskStatus, PhaseStatus,
)
from engine.checkpoint import save_checkpoint, load_checkpoint
from engine.process_supervisor import ProcessSupervisor
from engine.phase_gate import run_phase_gate
from validation.validators import run_validation
from reviewer import review_task, final_review
from interactive.prompt_detector import InteractivePromptDetector

logger = logging.getLogger(__name__)


class OrchestrationEngine:
    """Drives the build→validate→review→fix loop across phases."""

    def __init__(
        self,
        state: ProjectState,
        config: OrchestratorConfig,
        enable_review: bool = True,
        verbose: bool = False,
    ):
        self.state = state
        self.config = config
        self.enable_review = enable_review
        self.verbose = verbose
        self.supervisor: ProcessSupervisor | None = None
        self.prompt_detector: InteractivePromptDetector | None = None
        self._shutdown_requested = False

    def run(self) -> bool:
        """Run the full orchestration. Returns True if all tasks pass."""
        self.state.status = "running"
        self.state.started_at = self.state.started_at or time.time()

        if not self.state.run_id:
            self.state.run_id = uuid.uuid4().hex[:12]

        checkpoint_path = self.config.checkpoint_path(self.state.cwd)

        logger.info("╔══════════════════════════════════════════════════════════╗")
        logger.info("║         CLAUDE ORCHESTRATOR V2 — STARTING               ║")
        logger.info("╚══════════════════════════════════════════════════════════╝")
        logger.info("Run ID: %s", self.state.run_id)
        logger.info("Project: %s", self.state.project)
        logger.info("Directory: %s", self.state.cwd)
        logger.info("Phases: %d", len(self.state.phases))
        total_tasks = sum(len(p.tasks) for p in self.state.phases)
        logger.info("Total tasks: %d", total_tasks)
        logger.info("Review: %s", "enabled" if self.enable_review else "disabled")

        # Spawn builder
        self.supervisor = ProcessSupervisor(self.state.cwd, self.config)
        self.prompt_detector = InteractivePromptDetector(self.config.interactive_rules)

        if not self.supervisor.spawn(on_health_fail=self._on_health_fail):
            logger.error("Failed to spawn builder")
            self.state.status = "failed"
            return False

        try:
            success = self._run_phases()
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
            self._shutdown_requested = True
            success = False
        except Exception as e:
            logger.error("Orchestration error: %s", e, exc_info=True)
            success = False
        finally:
            save_checkpoint(self.state, checkpoint_path)
            if self.supervisor:
                self.supervisor.shutdown(graceful=True)

        # Summary
        self._print_summary()
        return success

    def _run_phases(self) -> bool:
        """Execute all phases sequentially."""
        checkpoint_path = self.config.checkpoint_path(self.state.cwd)

        for phase_idx, phase in enumerate(self.state.phases):
            if self._shutdown_requested:
                break

            # Skip already completed phases
            if phase.status == PhaseStatus.DONE:
                logger.info("Phase '%s' already done, skipping", phase.id)
                continue

            self.state.current_phase_idx = phase_idx
            phase.status = PhaseStatus.RUNNING

            logger.info("")
            logger.info("━" * 60)
            logger.info("PHASE %d/%d: %s", phase_idx + 1, len(self.state.phases), phase.name)
            logger.info("━" * 60)

            # Run tasks in this phase
            for task_idx, task in enumerate(phase.tasks):
                if self._shutdown_requested:
                    break

                if task.status in (TaskStatus.DONE, TaskStatus.SKIPPED):
                    continue

                self.state.current_task_idx = task_idx

                if not self._ensure_builder_alive():
                    task.status = TaskStatus.FAILED
                    task.error = "Builder unavailable"
                    break

                self._run_task(task)
                save_checkpoint(self.state, checkpoint_path)

            # Phase gate check
            if not self._shutdown_requested:
                phase.status = PhaseStatus.GATE_CHECK
                gate_result = run_phase_gate(phase, self.state.cwd)

                if gate_result.passed:
                    phase.status = PhaseStatus.DONE
                    logger.info("Phase '%s' COMPLETE", phase.id)
                else:
                    # Try to fix gate failures
                    logger.warning("Phase gate failed: %s", gate_result.summary)
                    if self._ensure_builder_alive():
                        fix_prompt = (
                            f"The phase '{phase.name}' gate check failed:\n"
                            + "\n".join(f"- {f}" for f in gate_result.failures)
                            + "\nFix all these issues."
                        )
                        self.supervisor.send(fix_prompt)
                        self.supervisor.wait_for_idle()

                        # Re-check gate
                        gate_result = run_phase_gate(phase, self.state.cwd)
                        if gate_result.passed:
                            phase.status = PhaseStatus.DONE
                        else:
                            phase.status = PhaseStatus.FAILED
                            logger.error("Phase '%s' FAILED gate re-check", phase.id)
                    else:
                        phase.status = PhaseStatus.FAILED

                save_checkpoint(self.state, checkpoint_path)

        # Final review
        all_done = all(p.status == PhaseStatus.DONE for p in self.state.phases)

        if all_done and self.enable_review and not self._shutdown_requested:
            self._final_review()

        self.state.status = "done" if all_done else "failed"
        save_checkpoint(self.state, checkpoint_path)

        return all_done

    def _run_task(self, task: Task) -> None:
        """Run a single task through the build→validate→review→fix cycle."""
        task.status = TaskStatus.RUNNING

        logger.info("─" * 40)
        logger.info("Task: %s", task.id)
        logger.info("Prompt: %s", task.prompt[:120])
        logger.info("─" * 40)

        # === BUILD ===
        self.supervisor.send(task.prompt)
        self._wait_with_interactive_handling()

        # === VALIDATE ===
        valid, val_msg = run_validation(task, self.state.cwd)
        logger.info("Validation: %s — %s", "PASS" if valid else "FAIL", val_msg)

        # Retry validation failures
        if not valid and task.retries < task.max_retries:
            task.retries += 1
            fix = f"Validation failed: {val_msg}. Fix this. Original task: {task.prompt}"
            self.supervisor.send(fix)
            self._wait_with_interactive_handling()
            valid, val_msg = run_validation(task, self.state.cwd)

        if not valid:
            task.status = TaskStatus.FAILED
            task.error = val_msg
            return

        # === REVIEW ===
        if not self.enable_review:
            task.status = TaskStatus.DONE
            logger.info("Task '%s' done (review skipped)", task.id)
            return

        task.status = TaskStatus.REVIEWING

        while task.review_cycles < task.max_review_cycles:
            task.review_cycles += 1

            review = review_task(
                task_prompt=task.prompt,
                spec_summary=self.state.spec_summary,
                cwd=self.state.cwd,
            )
            task.review_score = review.score

            if review.approved and review.score >= self.config.min_task_score:
                task.status = TaskStatus.DONE
                logger.info("Task '%s' APPROVED (score: %d/10)", task.id, review.score)
                return

            if not review.fix_prompt:
                task.status = TaskStatus.DONE
                return

            logger.info(
                "Task '%s' needs fixes (score: %d, cycle %d/%d)",
                task.id, review.score, task.review_cycles, task.max_review_cycles,
            )

            task.status = TaskStatus.FIXING
            self.supervisor.send(review.fix_prompt)
            self._wait_with_interactive_handling()

            # Re-validate
            valid, _ = run_validation(task, self.state.cwd)
            task.status = TaskStatus.REVIEWING

        # Exhausted review cycles
        if task.review_score >= self.config.min_task_score - 1:
            task.status = TaskStatus.DONE
            logger.warning("Task '%s' accepted (score: %d, marginal)", task.id, task.review_score)
        else:
            task.status = TaskStatus.FAILED
            task.error = f"Review failed after {task.review_cycles} cycles (score: {task.review_score})"

    def _wait_with_interactive_handling(self) -> bool:
        """Wait for idle while handling interactive prompts."""
        start = time.time()
        timeout = self.config.turn_timeout

        while time.time() - start < timeout:
            # Check for interactive prompts in PTY output
            if self.supervisor and self.prompt_detector:
                output = self.supervisor.read_output(timeout=0.3)
                if output:
                    response = self.prompt_detector.detect_and_respond(output)
                    if response is not None:
                        logger.info("Auto-responding to interactive prompt: %r", response)
                        self.supervisor.pty.send(response + "\n")
                        continue

            # Check JSONL for idle
            if self.supervisor and self.supervisor.watcher:
                events = self.supervisor.watcher.poll()
                for ev in events:
                    if ev.state in (AgentState.IDLE, AgentState.EXITED):
                        return True

            time.sleep(0.5)

        logger.warning("Wait timed out after %ds", timeout)
        return False

    def _ensure_builder_alive(self) -> bool:
        """Check builder is alive, respawn if needed."""
        if self.supervisor and self.supervisor.is_alive:
            return True

        logger.warning("Builder is dead, attempting respawn...")
        if self.supervisor:
            return self.supervisor.respawn(self.state)
        return False

    def _on_health_fail(self, reason: str) -> None:
        """Called by the supervisor health check thread."""
        logger.error("Health check failed: %s", reason)
        # The main loop will detect this via _ensure_builder_alive

    def _final_review(self) -> None:
        """Run a final comprehensive review."""
        logger.info("")
        logger.info("=" * 60)
        logger.info("FINAL PROJECT REVIEW")
        logger.info("=" * 60)

        completed_summaries = [
            f"[{t.id}] {t.prompt[:80]}"
            for t in self.state.completed_tasks
        ]

        review = final_review(
            spec_summary=self.state.spec_summary,
            completed_tasks=completed_summaries,
            cwd=self.state.cwd,
        )

        logger.info("Final score: %d/10", review.score)

        if not review.approved and review.issues and self._ensure_builder_alive():
            fix_prompt = (
                "FINAL REVIEW — Fix these critical issues before production:\n\n"
                + "\n".join(f"- {issue}" for issue in review.issues)
                + "\n\nFix ALL issues now."
            )
            self.supervisor.send(fix_prompt)
            self.supervisor.wait_for_idle()
            logger.info("Final fixes applied")

    def _print_summary(self) -> None:
        """Print orchestration summary."""
        elapsed = time.time() - self.state.started_at
        hours = int(elapsed // 3600)
        minutes = int((elapsed % 3600) // 60)

        done = len(self.state.completed_tasks)
        failed = len(self.state.failed_tasks)
        total = len(self.state.all_tasks)
        skipped = sum(1 for t in self.state.all_tasks if t.status == TaskStatus.SKIPPED)

        print("\n" + "=" * 60)
        print("ORCHESTRATION COMPLETE")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Duration: {hours}h {minutes}m")
        print("=" * 60)

        for phase in self.state.phases:
            status_icon = "✓" if phase.status == PhaseStatus.DONE else "✗"
            print(f"\n  {status_icon} Phase: {phase.name}")
            for task in phase.tasks:
                t_icon = {
                    TaskStatus.DONE: "✓",
                    TaskStatus.FAILED: "✗",
                    TaskStatus.SKIPPED: "⊘",
                }.get(task.status, "○")
                line = f"    {t_icon} {task.id}"
                if task.review_score > 0:
                    line += f" (score: {task.review_score}/10)"
                if task.error:
                    line += f" — {task.error}"
                print(line)

        print(f"\nResults: {done}/{total} done, {failed} failed, {skipped} skipped")
        print(f"Checkpoint: {self.config.checkpoint_path(self.state.cwd)}")
        print()


# Needed for the import in _wait_with_interactive_handling
from jsonl_watcher import AgentState
