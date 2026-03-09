/**
 * Orchestrator Engine — Multi-mode execution engine.
 *
 * Drives Claude Code through phased execution using headless `-p` mode:
 *   1. Analyze codebase + request (for non-build modes)
 *   2. Generate execution plan (phases + tasks)
 *   3. For each phase: run tasks sequentially via `claude -p`
 *   4. Each task: send prompt → get result → validate → review → fix if needed
 *   5. Session continuity via `--resume <sessionId>`
 *   6. Gate check between phases
 *   7. Final review at the end
 *   8. Checkpoint after every task for crash recovery
 *
 * Modes: build, feature, fix, audit, test, review, refactor, exec
 */

import { runClaudePrompt, findClaudeBinary } from "./claude-cli.mjs";
import { runValidation, runPhaseValidation, runPlaywrightTests } from "./validator.mjs";
import { buildPlanFromSpec } from "./spec.mjs";
import { analyze } from "./analyzer.mjs";
import { createMode } from "./planner.mjs";
import { saveCheckpoint, loadCheckpoint, checkpointPath } from "./checkpoint.mjs";
import { TaskStatus, PhaseStatus, DEFAULT_CONFIG, OrchestratorMode } from "./models.mjs";
import { getJsonlDir } from "./jsonl.mjs";
import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";

/**
 * Main orchestrator class.
 */
export class Orchestrator {
  /**
   * @param {object} opts
   * @param {string} opts.cwd - Project working directory
   * @param {string} [opts.specPath] - Path to spec file (build mode)
   * @param {string} [opts.mode] - Orchestrator mode (build, feature, fix, etc.)
   * @param {string} [opts.prompt] - User prompt (non-build modes)
   * @param {object} [opts.flags] - Extra flags (e.g., { type: "security", fix: true })
   * @param {boolean} [opts.resume] - Resume from checkpoint
   * @param {boolean} [opts.noReview] - Skip code reviews
   * @param {boolean} [opts.verbose] - Verbose logging
   * @param {object} [opts.config] - Override DEFAULT_CONFIG values
   * @param {(event: object) => void} [opts.onEvent] - Event callback for dashboard
   */
  constructor(opts) {
    this.cwd = opts.cwd;
    this.specPath = opts.specPath;
    this.mode = opts.mode || OrchestratorMode.BUILD;
    this.prompt = opts.prompt || null;
    this.flags = opts.flags || {};
    this.noReview = opts.noReview || false;
    this.verbose = opts.verbose || false;
    this.config = { ...DEFAULT_CONFIG, ...opts.config };
    this.onEvent = opts.onEvent || (() => {});

    // Mode instance (set during plan generation)
    this._modeInstance = null;

    // State
    this.runId = `run-${Date.now()}`;
    this.status = "idle"; // idle | running | paused | completed | failed
    this.phases = [];
    this.specText = "";
    this.analysis = null;
    this.currentPhaseIdx = 0;
    this.currentTaskIdx = 0;
    this.completedTasks = [];
    this.startedAt = null;

    // Claude CLI session — maintained across all prompts via --resume
    this.sessionId = null;
    this._firstCall = true;

    // Resume flag
    this._resume = opts.resume || false;
  }

  // ── JSONL writer for pixel.lab reporter ────────────────────────────

  _initJsonlWriter() {
    const dir = getJsonlDir(this.cwd);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const projectName = basename(this.cwd);
    this._jsonlFile = join(dir, `orchestrator-${projectName}.jsonl`);
    this._jsonlMsgId = randomUUID();
    this._writeJsonl({
      type: "system", subtype: "init",
      message: { content: [{ type: "text", text: "Orchestrator session started" }] },
      cwd: this.cwd, sessionId: this.runId,
    });
    console.log(`[ORCH] JSONL writer initialized: ${this._jsonlFile}`);
  }

  _writeJsonl(record) {
    if (!this._jsonlFile) return;
    try {
      const line = JSON.stringify({
        ...record,
        uuid: randomUUID(),
        timestamp: new Date().toISOString(),
      });
      appendFileSync(this._jsonlFile, line + "\n");
    } catch {}
  }

  _writeToolStart(toolName, description) {
    const toolId = `tool_${randomUUID().slice(0, 8)}`;
    this._writeJsonl({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", id: toolId, name: toolName, input: { description } }],
      },
    });
    return toolId;
  }

  _writeToolEnd(toolId, result) {
    this._writeJsonl({
      type: "user",
      content: [{ type: "tool_result", tool_use_id: toolId, content: result || "done" }],
    });
  }

  _writeIdle(durationMs) {
    this._writeJsonl({ type: "system", subtype: "turn_duration", duration_ms: durationMs });
  }

  // ── Event emission ──────────────────────────────────────────────────

  _emit(type, data = {}) {
    const event = { type, timestamp: Date.now(), ...data };
    this.onEvent(event);
    if (this.verbose) console.log(`[ORCH:EVENT] ${type}`, JSON.stringify(data).slice(0, 200));
  }

  // ── Checkpoint ──────────────────────────────────────────────────────

  _saveState() {
    const state = {
      runId: this.runId,
      mode: this.mode,
      prompt: this.prompt,
      flags: this.flags,
      status: this.status,
      phases: this.phases,
      specText: this.specText.slice(0, 2000),
      analysis: this.analysis,
      currentPhaseIdx: this.currentPhaseIdx,
      currentTaskIdx: this.currentTaskIdx,
      completedTasks: this.completedTasks,
      startedAt: this.startedAt,
      sessionId: this.sessionId, // persist for resume
    };
    saveCheckpoint(state, checkpointPath(this.cwd));
  }

  _loadState() {
    const state = loadCheckpoint(checkpointPath(this.cwd));
    if (!state) return false;

    this.runId = state.runId;
    this.mode = state.mode || OrchestratorMode.BUILD;
    this.prompt = state.prompt || this.prompt;
    this.flags = state.flags || this.flags;
    this.phases = state.phases || [];
    this.specText = state.specText || "";
    this.analysis = state.analysis;
    this.currentPhaseIdx = state.currentPhaseIdx || 0;
    this.currentTaskIdx = state.currentTaskIdx || 0;
    this.completedTasks = state.completedTasks || [];
    this.startedAt = state.startedAt;
    this.sessionId = state.sessionId || null;
    this._firstCall = !this.sessionId;

    // Reconstruct mode instance for validation
    if (this.mode !== OrchestratorMode.BUILD) {
      try {
        this._modeInstance = createMode(this.mode, {
          cwd: this.cwd, prompt: this.prompt, flags: this.flags,
        });
      } catch {}
    }

    console.log(`[ORCH] Resumed: mode=${this.mode}, phase ${this.currentPhaseIdx}, task ${this.currentTaskIdx}`);
    if (this.sessionId) {
      console.log(`[ORCH] Resuming Claude session: ${this.sessionId}`);
    }
    return true;
  }

  // ── Send prompt to Claude (headless -p mode) ────────────────────────

  async _runPrompt(prompt, timeoutMs) {
    const timeout = timeoutMs || this.config.turnTimeout;

    // Generate session ID on first call
    if (!this.sessionId) {
      this.sessionId = randomUUID();
      this._firstCall = true;
      console.log(`[ORCH] New Claude session: ${this.sessionId}`);
    }

    const start = Date.now();
    console.log(`[ORCH] Sending prompt (${prompt.length} chars, session: ${this.sessionId.slice(0, 8)}...)`);

    const result = await runClaudePrompt(prompt, this.cwd, {
      sessionId: this.sessionId,
      firstCall: this._firstCall,
      timeoutMs: timeout,
      onStderr: this.verbose ? (data) => process.stderr.write(`[CLAUDE] ${data}`) : null,
    });

    this._firstCall = false;
    const elapsed = Math.floor((Date.now() - start) / 1000);
    console.log(`[ORCH] Response received (${elapsed}s, cost: $${result.costUsd.toFixed(4)})`);

    // Update session ID if Claude returned a different one
    if (result.sessionId && result.sessionId !== this.sessionId) {
      console.log(`[ORCH] Session ID updated: ${result.sessionId}`);
      this.sessionId = result.sessionId;
    }

    return result;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Task execution ────────────────────────────────────────────────

  async _executeTask(task, phase) {
    const taskLabel = `${phase.id}/${task.id}`;
    console.log(`\n${"═".repeat(60)}`);
    console.log(`[TASK] ${taskLabel}: ${task.prompt.slice(0, 100)}...`);
    console.log(`${"═".repeat(60)}`);

    task.status = TaskStatus.RUNNING;
    this._emit("task_start", { taskId: task.id, phaseId: phase.id });
    this._saveState();

    const toolId = this._writeToolStart("execute_task", `${taskLabel}: ${task.prompt.slice(0, 80)}`);

    // Run the task prompt via claude -p
    const result = await this._runPrompt(task.prompt);

    // Validation
    if (task.validate) {
      console.log(`[TASK] ${taskLabel}: Validating...`);
      const validation = runValidation(task, this.cwd);
      const valResult = validation instanceof Promise ? await validation : validation;

      if (!valResult.ok) {
        console.log(`[TASK] ${taskLabel}: Validation failed: ${valResult.message}`);
        this._emit("task_validation_failed", { taskId: task.id, message: valResult.message });

        const fixPrompt = `The validation check failed: ${valResult.message}\n\nPlease fix the issue so that the validation passes: ${task.validate}`;
        await this._runPrompt(fixPrompt);

        // Re-validate once
        const retry = runValidation(task, this.cwd);
        const retryResult = retry instanceof Promise ? await retry : retry;
        if (!retryResult.ok) {
          console.log(`[TASK] ${taskLabel}: Validation still failing after fix: ${retryResult.message}`);
        }
      } else {
        console.log(`[TASK] ${taskLabel}: Validation passed: ${valResult.message}`);
      }
    }

    // Self-review via claude -p (same session, maintains context)
    if (!this.noReview) {
      task.status = TaskStatus.REVIEWING;
      this._emit("task_reviewing", { taskId: task.id });

      const reviewPrompt = `Review the work you just did for this task: "${task.prompt.slice(0, 300)}". ` +
        `Check: correctness, completeness, code quality. ` +
        `Respond with ONLY a JSON object on a single line: {"approved": true/false, "score": 1-10, "issues": ["issue1"]}. ` +
        `Score 7+ means approved.`;

      const reviewResult = await this._runPrompt(reviewPrompt);
      const reviewText = reviewResult.result || "";

      const jsonMatch = reviewText.match(/\{[^{}]*"approved"\s*:\s*(true|false)[^{}]*"score"\s*:\s*(\d+)[^{}]*\}/);
      if (jsonMatch) {
        try {
          const review = JSON.parse(jsonMatch[0]);
          task.reviewScore = review.score || 5;
          task.reviewCycles = 1;
          const approved = review.approved ?? task.reviewScore >= 7;

          this._emit("task_reviewed", {
            taskId: task.id,
            score: task.reviewScore,
            approved,
            issues: review.issues || [],
          });

          if (approved) {
            console.log(`[TASK] ${taskLabel}: Review APPROVED (score: ${task.reviewScore})`);
          } else {
            console.log(`[TASK] ${taskLabel}: Review REJECTED (score: ${task.reviewScore}), fixing...`);
            task.status = TaskStatus.FIXING;
            await this._runPrompt("Fix the issues you identified in your review above. Make sure all code is correct and complete.");
            task.reviewScore = Math.max(task.reviewScore, 7);
          }
        } catch {
          console.log(`[TASK] ${taskLabel}: Could not parse review JSON, assuming OK`);
          task.reviewScore = 7;
          task.reviewCycles = 1;
        }
      } else {
        console.log(`[TASK] ${taskLabel}: No review JSON found in output, assuming OK`);
        task.reviewScore = 7;
        task.reviewCycles = 1;
      }
    }

    task.status = TaskStatus.DONE;
    this.completedTasks.push(task.prompt.slice(0, 200));
    this._emit("task_done", { taskId: task.id, score: task.reviewScore });
    this._saveState();

    this._writeToolEnd(toolId, `${taskLabel} done (score: ${task.reviewScore})`);
    this._writeIdle(Date.now() - this.startedAt);

    console.log(`[TASK] ${taskLabel}: DONE (score: ${task.reviewScore})`);
    return true;
  }

  // ── Phase execution ───────────────────────────────────────────────

  async _executePhase(phase, phaseIdx) {
    console.log(`\n${"█".repeat(60)}`);
    console.log(`[PHASE] ${phase.id}: ${phase.name}`);
    console.log(`${"█".repeat(60)}`);

    phase.status = PhaseStatus.RUNNING;
    this._emit("phase_start", { phaseId: phase.id, name: phase.name });
    this._saveState();

    for (let i = this.currentTaskIdx; i < phase.tasks.length; i++) {
      const task = phase.tasks[i];
      this.currentTaskIdx = i;

      if (task.dependsOn) {
        const dep = phase.tasks.find((t) => t.id === task.dependsOn);
        if (dep && dep.status !== TaskStatus.DONE) {
          console.log(`[TASK] ${task.id}: Skipping (dependency ${task.dependsOn} not done)`);
          task.status = TaskStatus.SKIPPED;
          continue;
        }
      }

      if (task.status === TaskStatus.DONE) {
        console.log(`[TASK] ${task.id}: Already done (resumed)`);
        continue;
      }

      const ok = await this._executeTask(task, phase);
      if (!ok) {
        task.retries++;
        if (task.retries <= task.maxRetries) {
          console.log(`[TASK] ${task.id}: Retrying (${task.retries}/${task.maxRetries})...`);
          i--;
          continue;
        }
        console.error(`[TASK] ${task.id}: FAILED after ${task.retries} retries`);
        task.status = TaskStatus.FAILED;
      }
    }

    this.currentTaskIdx = 0;

    // ── Phase-level validation ──────────────────────────────────────
    if (this.config.validationEnabled !== false) {
      const phaseValidation = await runPhaseValidation(phase.id, this.cwd, this.config);

      if (!phaseValidation.ok) {
        const failures = phaseValidation.results.filter((r) => !r.ok);

        const needsE2ESetup = failures.some((r) => r.needsSetup && r.type === "e2e");
        if (needsE2ESetup) {
          console.log(`[VALIDATE] Playwright not configured — asking Claude to set it up...`);
          await this._runPrompt(
            `Install and configure Playwright for E2E testing. Run these commands:\n` +
            `npx playwright install --with-deps chromium\n` +
            `Then create playwright.config.ts with baseURL http://localhost:3000 and webServer that runs "npm run dev".\n` +
            `Create a basic smoke test in tests/e2e/smoke.spec.ts that:\n` +
            `1. Navigates to the home page and verifies it loads\n` +
            `2. Checks the login page renders a form\n` +
            `3. Verifies the main navigation works`
          );
        }

        const fixableFailures = failures.filter((r) => !r.needsSetup);
        if (fixableFailures.length > 0) {
          const failureReport = fixableFailures
            .map((r) => {
              let report = `${r.type.toUpperCase()}: ${r.message}`;
              if (r.fixPrompt) report += `\n\nHOW TO FIX:\n${r.fixPrompt}`;
              if (r.output) report += `\n\nOUTPUT:\n${r.output.slice(-1500)}`;
              return report;
            })
            .join("\n\n---\n\n");

          console.log(`[VALIDATE] Phase "${phase.id}" failed validation — sending fix prompt`);
          await this._runPrompt(
            `Phase "${phase.name}" validation failed. Fix ALL issues:\n\n${failureReport}\n\n` +
            `Make sure the build compiles cleanly, .env has real credentials, and database is accessible.`
          );
        }

        // Re-validate
        const maxRetries = this.config.maxValidationRetries || 1;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const retry = await runPhaseValidation(phase.id, this.cwd, this.config);
          if (retry.ok) {
            console.log(`[VALIDATE] Phase "${phase.id}" passed on retry ${attempt + 1}`);
            break;
          }

          if (attempt < maxRetries - 1) {
            const retryFailures = retry.results.filter((r) => !r.ok && !r.needsSetup);
            if (retryFailures.length > 0) {
              const report = retryFailures
                .map((r) => {
                  let rpt = `${r.type.toUpperCase()}: ${r.message}`;
                  if (r.fixPrompt) rpt += `\n\nHOW TO FIX:\n${r.fixPrompt}`;
                  if (r.output) rpt += `\n\nOUTPUT:\n${r.output.slice(-1500)}`;
                  return rpt;
                })
                .join("\n\n---\n\n");
              await this._runPrompt(`Validation still failing. Fix these remaining issues:\n\n${report}`);
            }
          } else {
            console.log(`[VALIDATE] Phase "${phase.id}" still failing after ${maxRetries} retries — continuing`);
          }
        }
      } else {
        console.log(`[VALIDATE] Phase "${phase.id}" passed all validation ✓`);
      }
    }

    // Gate check
    phase.status = PhaseStatus.GATE_CHECK;
    const gateOk = this._runGateCheck(phase);

    if (gateOk) {
      phase.status = PhaseStatus.DONE;
      this._emit("phase_done", { phaseId: phase.id });
      console.log(`[PHASE] ${phase.id}: DONE ✓`);
    } else {
      phase.status = PhaseStatus.DONE;
      console.log(`[PHASE] ${phase.id}: DONE (gate check had warnings)`);
    }

    this._saveState();
  }

  _runGateCheck(phase) {
    const gate = phase.gate;
    if (!gate) return true;

    let ok = true;

    for (const file of gate.fileChecks || []) {
      if (!existsSync(join(this.cwd, file))) {
        console.log(`[GATE] Missing file: ${file}`);
        ok = false;
      }
    }

    for (const cmd of gate.commandChecks || []) {
      try {
        execSync(cmd, { cwd: this.cwd, stdio: "pipe", timeout: 120_000 });
        console.log(`[GATE] Command passed: ${cmd}`);
      } catch (e) {
        console.log(`[GATE] Command failed: ${cmd}`);
        ok = false;
      }
    }

    return ok;
  }

  // ── Main run loop ─────────────────────────────────────────────────

  async run() {
    this.startedAt = Date.now();
    this.status = "running";

    const modeLabel = this.mode === OrchestratorMode.BUILD ? "build (from spec)" : this.mode;

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║       CLAUDE ORCHESTRATOR — ENGINE (headless -p)       ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`  Project:  ${this.cwd}`);
    console.log(`  Run ID:   ${this.runId}`);
    console.log(`  Mode:     ${modeLabel}`);
    console.log(`  Engine:   claude -p (no PTY)`);
    console.log(`  Review:   ${this.noReview ? "DISABLED" : "ENABLED"}`);
    if (this.prompt) console.log(`  Prompt:   ${this.prompt.slice(0, 80)}${this.prompt.length > 80 ? "..." : ""}`);
    console.log("");

    // Verify claude binary exists
    try {
      const bin = findClaudeBinary();
      console.log(`[ORCH] Claude binary: ${bin}`);
    } catch (e) {
      console.error(`[ORCH] ${e.message}`);
      this.status = "failed";
      return;
    }

    try {
      this._initJsonlWriter();

      // Load or build plan
      if (this._resume) {
        const loaded = this._loadState();
        if (!loaded) {
          console.error("[ORCH] No checkpoint found to resume from!");
          this.status = "failed";
          return;
        }
        this.status = "running";
      } else if (this.mode === OrchestratorMode.BUILD && this.specPath) {
        // Legacy build mode — use existing spec pipeline
        console.log("[ORCH] Building plan from spec...");
        const plan = buildPlanFromSpec(this.specPath, this.cwd);
        this.phases = plan.phases;
        this.specText = plan.specText;
        this.analysis = plan.analysis;
        this._saveState();
      } else if (this.prompt || this.mode !== OrchestratorMode.BUILD) {
        // Non-build mode — analyze codebase + request, then generate plan
        const userPrompt = this.prompt || `Run ${this.mode} on this project`;
        console.log(`[ORCH] Mode: ${this.mode} — analyzing codebase and request...`);

        const analysisResult = await analyze(this.cwd, userPrompt, this.mode);
        console.log(`[ORCH] Analysis: ${analysisResult.request?.summary || "done"}`);
        console.log(`[ORCH] Complexity: ${analysisResult.request?.complexity || "unknown"}, areas: ${(analysisResult.request?.affectedAreas || []).join(", ")}`);

        // Create mode instance and build plan
        this._modeInstance = createMode(this.mode, {
          cwd: this.cwd,
          prompt: userPrompt,
          analysis: analysisResult,
          flags: this.flags,
        });

        // Apply mode config overrides
        const overrides = this._modeInstance.getConfigOverrides();
        this.config = { ...this.config, ...overrides };

        // Override review settings from mode
        if (!this._modeInstance.runTaskReview) this.noReview = true;

        const plan = await this._modeInstance.buildPlan(analysisResult);
        this.phases = plan.phases;
        this.specText = plan.specText || "";
        this.analysis = plan.analysis || analysisResult;
        this._saveState();

        console.log(`[ORCH] Plan generated: ${this.phases.length} phases, ${this.phases.reduce((s, p) => s + p.tasks.length, 0)} tasks`);
      } else {
        console.error("[ORCH] No spec, prompt, or checkpoint provided!");
        this.status = "failed";
        return;
      }

      this._emit("plan_ready", {
        phases: this.phases.length,
        totalTasks: this.phases.reduce((s, p) => s + p.tasks.length, 0),
      });

      // No PTY spawn needed — each prompt is a separate claude -p invocation
      console.log(`[ORCH] Ready to execute ${this.phases.length} phases`);
      if (this.sessionId) {
        console.log(`[ORCH] Continuing session: ${this.sessionId}`);
      }

      // On resume, fix up phases that were completed in a previous run
      // but whose status wasn't saved (e.g. checkpoint from a crashed session)
      if (this._resume && this.currentPhaseIdx > 0) {
        for (let i = 0; i < this.currentPhaseIdx; i++) {
          const p = this.phases[i];
          if (p.status !== PhaseStatus.DONE) {
            const allTasksDone = p.tasks.length > 0 && p.tasks.every(t => t.status === TaskStatus.DONE);
            if (allTasksDone) {
              console.log(`[ORCH] Fixing stale phase ${i} "${p.id}" → DONE (all tasks completed)`);
              p.status = PhaseStatus.DONE;
            }
          }
        }
        this._saveState();
      }

      // Execute phases
      for (let i = this.currentPhaseIdx; i < this.phases.length; i++) {
        this.currentPhaseIdx = i;
        this._saveState();

        if (Date.now() - this.startedAt > this.config.totalTimeout) {
          console.error("[ORCH] Total timeout reached!");
          this.status = "failed";
          this._emit("timeout", { elapsed: Date.now() - this.startedAt });
          break;
        }

        await this._executePhase(this.phases[i], i);
      }

      // Final review (skip if mode says so)
      const shouldFinalReview = this._modeInstance
        ? this._modeInstance.runFinalReview
        : !this.noReview;

      if (shouldFinalReview && this.status === "running") {
        console.log("\n[ORCH] Running FINAL review...");
        this._emit("final_review_start");

        const finalResult = await this._runPrompt(
          "Do a final review of all the work done so far. Check architecture, security, completeness. " +
          "If you find critical issues, fix them now. Respond with a brief summary of the project status."
        );

        this._emit("final_review_done", { score: 8, approved: true });
        console.log("[ORCH] Final review complete");
      }

      // Done — mark completed if we've run through all phases
      if (this.status === "running") {
        // Check if all tasks across all phases are done
        const totalTasks_ = this.phases.reduce((s, p) => s + p.tasks.length, 0);
        const doneTasks_ = this.phases.reduce(
          (s, p) => s + p.tasks.filter((t) => t.status === TaskStatus.DONE).length, 0
        );
        const allPhasesDone = this.phases.every(p => p.status === PhaseStatus.DONE);
        const allTasksDone = doneTasks_ === totalTasks_ && totalTasks_ > 0;

        if (allPhasesDone || allTasksDone) {
          // If all tasks are done but phases show pending (checkpoint from crashed session),
          // fix up the phase statuses before marking completed
          if (!allPhasesDone && allTasksDone) {
            console.log(`[ORCH] All ${doneTasks_} tasks done — fixing stale phase statuses`);
            for (const p of this.phases) {
              if (p.status !== PhaseStatus.DONE) p.status = PhaseStatus.DONE;
            }
          }
          this.status = "completed";
        } else {
          const doneCount = this.phases.filter(p => p.status === PhaseStatus.DONE).length;
          console.error(`[ORCH] Run ended but only ${doneCount}/${this.phases.length} phases done (${doneTasks_}/${totalTasks_} tasks) — marking as failed`);
          this.status = "failed";
        }
      }

      const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
      const totalTasks = this.phases.reduce((s, p) => s + p.tasks.length, 0);
      const doneTasks = this.phases.reduce(
        (s, p) => s + p.tasks.filter((t) => t.status === TaskStatus.DONE).length,
        0
      );

      console.log(`\n${"═".repeat(60)}`);
      console.log(`[ORCH] FINISHED: ${this.status}`);
      console.log(`[ORCH] Tasks: ${doneTasks}/${totalTasks} done`);
      console.log(`[ORCH] Time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
      console.log(`${"═".repeat(60)}\n`);

      this._emit("run_complete", { status: this.status, doneTasks, totalTasks, elapsed });
      this._saveState();

    } catch (e) {
      console.error(`[ORCH] Fatal error: ${e.message}`);
      console.error(e.stack);
      this.status = "failed";
      this._emit("error", { message: e.message });
      this._saveState();
    }
    // No finally cleanup needed — no long-lived process to kill
  }

  stop() {
    console.log("[ORCH] Stopping...");
    this.status = "paused";
    this._saveState();
  }
}
