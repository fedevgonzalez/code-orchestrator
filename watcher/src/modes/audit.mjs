/**
 * Audit Mode — Code audit (security, performance, quality, accessibility).
 *
 * Phases:
 *   1. Analysis (scan codebase, identify issues)
 *   2. Report (generate detailed markdown report)
 *   3. Fix (optional, if --fix flag is set)
 */

import { BaseMode } from "./base-mode.mjs";
import { createPhase } from "../models.mjs";

export class AuditMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "audit";
    this.auditType = opts.flags?.type || "full"; // security, performance, quality, a11y, full
    this.autoFix = opts.flags?.fix || false;
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
      specText: `Audit (${this.auditType}): ${this.prompt || "Full codebase audit"}`,
      analysis: analysis.request,
    };
  }

  getValidators(phaseId) {
    if (phaseId.includes("fix")) return ["build", "type-check"];
    return ["report-exists"];
  }

  getConfigOverrides() {
    return {
      turnTimeout: 15 * 60_000,
    };
  }

  get runTaskReview() {
    return this.autoFix; // Only review if we're applying fixes
  }

  get runFinalReview() {
    return false; // Audit IS the review
  }
}
