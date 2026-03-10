/**
 * BaseMode — Abstract base class for all orchestrator modes.
 *
 * Each mode (build, feature, fix, audit, test, review, refactor, exec)
 * extends this class and implements buildPlan() to produce phases + tasks.
 */

export class BaseMode {
  /**
   * @param {object} opts
   * @param {string} opts.cwd - Project working directory
   * @param {string} opts.prompt - User's raw input
   * @param {object} opts.analysis - Output from the analyzer
   * @param {object} [opts.flags] - Extra CLI flags (e.g., --type, --fix)
   */
  constructor(opts) {
    this.name = "base";
    this.cwd = opts.cwd;
    this.prompt = opts.prompt || "";
    this.analysis = opts.analysis || null;
    this.flags = opts.flags || {};
  }

  /**
   * Build the execution plan (phases + tasks).
   * Each mode overrides this to produce its own plan.
   * @param {object} analysis - Codebase + request analysis from analyzer
   * @returns {Promise<{phases: object[], specText: string, analysis: object}>}
   */
  async buildPlan(analysis) {
    throw new Error(`${this.name}.buildPlan() not implemented`);
  }

  /**
   * Get validators that apply to a specific phase in this mode.
   * Override in subclasses for mode-specific validation.
   * @param {string} phaseId
   * @returns {string[]} - Validator names (e.g., ["build", "type-check"])
   */
  getValidators(phaseId) {
    return ["build"];
  }

  /**
   * Get config overrides for this mode.
   * Override in subclasses for mode-specific settings.
   * @returns {object}
   */
  getConfigOverrides() {
    return {};
  }

  /**
   * Whether this mode should run the final review.
   */
  get runFinalReview() {
    return true;
  }

  /**
   * Whether this mode should run per-task reviews.
   */
  get runTaskReview() {
    return true;
  }

  /**
   * Whether this mode should skip phase-level validation (build, test, etc.).
   * Read-only modes (review, audit without --fix) should skip these.
   */
  get skipPhaseValidation() {
    return false;
  }
}
