/**
 * Exec Mode — Generic prompt execution (catch-all).
 *
 * The analyzer creates whatever phases make sense for the request.
 * This is the fallback when no specialized mode fits.
 */

import { BaseMode } from "./base-mode.mjs";
import { createPhase } from "../models.mjs";

export class ExecMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "exec";
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
      specText: `Exec: ${this.prompt}`,
      analysis: analysis.request,
    };
  }

  getValidators(phaseId) {
    return ["build"];
  }

  getConfigOverrides() {
    return {};
  }
}
