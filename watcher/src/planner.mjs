/**
 * Planner — Dispatches to the correct mode for plan generation.
 *
 * Takes mode name + analyzer output and produces a standard plan
 * (phases + tasks) that the orchestrator can execute.
 */

import { BuildMode } from "./modes/build.mjs";
import { FeatureMode } from "./modes/feature.mjs";
import { FixMode } from "./modes/fix.mjs";
import { AuditMode } from "./modes/audit.mjs";
import { TestMode } from "./modes/test.mjs";
import { ReviewMode } from "./modes/review.mjs";
import { RefactorMode } from "./modes/refactor.mjs";
import { ExecMode } from "./modes/exec.mjs";
import { OrchestratorMode } from "./models.mjs";

const MODE_CLASSES = {
  [OrchestratorMode.BUILD]: BuildMode,
  [OrchestratorMode.FEATURE]: FeatureMode,
  [OrchestratorMode.FIX]: FixMode,
  [OrchestratorMode.AUDIT]: AuditMode,
  [OrchestratorMode.TEST]: TestMode,
  [OrchestratorMode.REVIEW]: ReviewMode,
  [OrchestratorMode.REFACTOR]: RefactorMode,
  [OrchestratorMode.EXEC]: ExecMode,
};

/**
 * Create a mode instance.
 * @param {string} modeName
 * @param {object} opts - { cwd, prompt, analysis, flags }
 * @returns {BaseMode}
 */
export function createMode(modeName, opts) {
  const ModeClass = MODE_CLASSES[modeName];
  if (!ModeClass) {
    throw new Error(`Unknown mode: "${modeName}". Available: ${Object.keys(MODE_CLASSES).join(", ")}`);
  }
  return new ModeClass(opts);
}

/**
 * Get all available mode names.
 */
export function getAvailableModes() {
  return Object.keys(MODE_CLASSES);
}
