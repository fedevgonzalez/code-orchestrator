/**
 * Review Mode — Comprehensive code review with actionable report.
 *
 * Phases:
 *   1. Analysis (review architecture, code quality, security, performance)
 *   2. Report (generate detailed markdown report with actionable items)
 */

import { BaseMode } from "./base-mode.mjs";
import { createPhase } from "../models.mjs";

export class ReviewMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "review";
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
      specText: `Review: ${this.prompt || "Full code review"}`,
      analysis: analysis.request,
    };
  }

  getValidators(phaseId) {
    return ["report-exists"];
  }

  getConfigOverrides() {
    return {
      turnTimeout: 15 * 60_000,
    };
  }

  get runTaskReview() {
    return false; // Review IS the task
  }

  get runFinalReview() {
    return false;
  }
}
