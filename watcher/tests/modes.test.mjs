import { describe, test, expect } from "@jest/globals";
import { createMode, getAvailableModes } from "../src/planner.mjs";

describe("getAvailableModes", () => {
  test("returns all 8 modes", () => {
    const modes = getAvailableModes();
    expect(modes).toHaveLength(8);
    expect(modes).toContain("build");
    expect(modes).toContain("feature");
    expect(modes).toContain("fix");
    expect(modes).toContain("audit");
    expect(modes).toContain("test");
    expect(modes).toContain("review");
    expect(modes).toContain("refactor");
    expect(modes).toContain("exec");
  });
});

describe("createMode", () => {
  const baseOpts = { cwd: "/tmp/test", prompt: "test prompt" };

  test("creates each mode without error", () => {
    for (const mode of getAvailableModes()) {
      const instance = createMode(mode, baseOpts);
      expect(instance).toBeTruthy();
      expect(instance.name).toBe(mode);
    }
  });

  test("throws for unknown mode", () => {
    expect(() => createMode("nonexistent", baseOpts)).toThrow();
  });

  test("review mode skips validation", () => {
    const review = createMode("review", baseOpts);
    expect(review.runTaskReview).toBe(false);
    expect(review.runFinalReview).toBe(false);
    expect(review.skipPhaseValidation).toBe(true);
  });

  test("audit mode skips validation without --fix", () => {
    const audit = createMode("audit", { ...baseOpts, flags: {} });
    expect(audit.runTaskReview).toBe(false);
    expect(audit.runFinalReview).toBe(false);
    expect(audit.skipPhaseValidation).toBe(true);
  });

  test("audit mode enables validation with --fix", () => {
    const audit = createMode("audit", { ...baseOpts, flags: { fix: true } });
    expect(audit.runTaskReview).toBe(true);
    expect(audit.skipPhaseValidation).toBe(false);
  });

  test("feature mode has build validators", () => {
    const feature = createMode("feature", baseOpts);
    const validators = feature.getValidators("any-phase");
    expect(validators).toContain("build");
  });

  test("fix mode has higher timeout", () => {
    const fix = createMode("fix", baseOpts);
    const config = fix.getConfigOverrides();
    expect(config.turnTimeout).toBeGreaterThanOrEqual(15 * 60_000);
  });

  test("refactor mode has higher timeout", () => {
    const refactor = createMode("refactor", baseOpts);
    const config = refactor.getConfigOverrides();
    expect(config.turnTimeout).toBeGreaterThanOrEqual(15 * 60_000);
  });

  test("build mode defaults", () => {
    const build = createMode("build", baseOpts);
    expect(build.runFinalReview).toBe(true);
    expect(build.runTaskReview).toBe(true);
    expect(build.skipPhaseValidation).toBe(false);
  });
});
