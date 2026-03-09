/**
 * Build Mode — Full project generation from spec.
 * Wraps existing buildPlanFromSpec from spec.mjs.
 * This is the legacy 24-phase pipeline, unchanged.
 */

import { BaseMode } from "./base-mode.mjs";
import { buildPlanFromSpec } from "../spec.mjs";

export class BuildMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "build";
    this.specPath = opts.specPath;
  }

  async buildPlan() {
    if (!this.specPath) {
      throw new Error("Build mode requires --spec <path>");
    }
    return buildPlanFromSpec(this.specPath, this.cwd);
  }

  getValidators(phaseId) {
    // Build mode uses the full PHASE_VALIDATORS map from validator.mjs
    return null; // null = use default phase validators
  }

  getConfigOverrides() {
    return {}; // Build mode uses all defaults
  }
}
