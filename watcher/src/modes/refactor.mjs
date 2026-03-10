/**
 * Refactor Mode — Code refactoring tasks.
 *
 * Phases:
 *   1. Analysis (understand current code, plan refactoring)
 *   2. Refactor (apply changes incrementally)
 *   3. Verify (tests pass, build passes, no regressions)
 *   4. Cleanup (remove dead code, update imports)
 */

import { BaseMode } from "./base-mode.mjs";
import { createPhase } from "../models.mjs";

export class RefactorMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "refactor";
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
      gate: { fileChecks: [], commandChecks: ["npm run build"] },
    }));

    return {
      phases,
      specText: `Refactor: ${this.prompt}`,
      analysis: analysis.request,
    };
  }

  getValidators(phaseId) {
    return ["build", "type-check", "test-regression"];
  }

  getConfigOverrides() {
    return {
      turnTimeout: 15 * 60_000, // 15 min per task (refactoring reads/writes many files)
      maxReviewCycles: 2,
    };
  }
}
