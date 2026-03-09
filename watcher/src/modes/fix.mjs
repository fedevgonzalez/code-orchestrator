/**
 * Fix Mode — Diagnose and fix a bug or issue.
 *
 * Phases:
 *   1. Diagnosis (understand the bug, find root cause)
 *   2. Fix (apply fix + regression test)
 *   3. Verify (run tests, build, validate)
 */

import { BaseMode } from "./base-mode.mjs";
import { createPhase } from "../models.mjs";

export class FixMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "fix";
  }

  async buildPlan(analysis) {
    const plan = analysis.plan;
    const phases = plan.phases.map(p => createPhase({
      id: p.id,
      name: p.name,
      tasks: p.tasks.map(t => ({
        id: t.id,
        prompt: t.prompt,
        validate: t.validate || null,
        phaseId: p.id,
      })),
      gate: { fileChecks: [], commandChecks: [] },
    }));

    return {
      phases,
      specText: `Fix: ${this.prompt}`,
      analysis: analysis.request,
    };
  }

  getValidators(phaseId) {
    return ["build", "test-regression"];
  }

  getConfigOverrides() {
    return {
      maxReviewCycles: 2,
      maxTaskRetries: 3, // More retries for fixes
      turnTimeout: 15 * 60_000, // 15 min per task (diagnosis can be slow)
    };
  }
}
