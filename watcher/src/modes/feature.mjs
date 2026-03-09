/**
 * Feature Mode — Add a feature to an existing project.
 *
 * Typical phases:
 *   1. Preparation (types, schemas, migrations)
 *   2. Backend (API routes, server logic)
 *   3. Frontend (components, pages, state)
 *   4. Integration & Testing
 *   5. Polish (error handling, edge cases)
 */

import { BaseMode } from "./base-mode.mjs";
import { createPhase, createTask } from "../models.mjs";

export class FeatureMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "feature";
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
      specText: `Feature: ${this.prompt}`,
      analysis: analysis.request,
    };
  }

  getValidators(phaseId) {
    return ["build", "type-check"];
  }

  getConfigOverrides() {
    return {
      maxReviewCycles: 2,
      maxTaskRetries: 2,
    };
  }
}
