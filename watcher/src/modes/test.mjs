/**
 * Test Mode — Run tests, analyze failures, generate missing tests, fix issues.
 *
 * Phases:
 *   1. Discovery (find untested code, analyze coverage)
 *   2. Generation (write tests for uncovered code)
 *   3. Run & Fix (run all tests, fix failures)
 *   4. Coverage Report
 */

import { BaseMode } from "./base-mode.mjs";
import { createPhase } from "../models.mjs";

export class TestMode extends BaseMode {
  constructor(opts) {
    super(opts);
    this.name = "test";
    this.autoFix = opts.flags?.fix !== false; // Default: fix failures
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
      specText: `Test: ${this.prompt || "Run and fix all tests"}`,
      analysis: analysis.request,
    };
  }

  getValidators(phaseId) {
    if (phaseId.includes("fix")) return ["build", "test-run"];
    return [];
  }

  getConfigOverrides() {
    return {
      turnTimeout: 10 * 60_000,
      maxTaskRetries: 3,
    };
  }
}
