import { describe, test, expect } from "@jest/globals";
import {
  TaskStatus, PhaseStatus, AgentState, OrchestratorMode,
  DEFAULT_CONFIG, createTask, createPhase,
} from "../src/models.mjs";

describe("TaskStatus", () => {
  test("has all required statuses", () => {
    expect(TaskStatus.PENDING).toBe("pending");
    expect(TaskStatus.RUNNING).toBe("running");
    expect(TaskStatus.DONE).toBe("done");
    expect(TaskStatus.FAILED).toBe("failed");
    expect(TaskStatus.SKIPPED).toBe("skipped");
  });
});

describe("PhaseStatus", () => {
  test("has all required statuses", () => {
    expect(PhaseStatus.PENDING).toBe("pending");
    expect(PhaseStatus.RUNNING).toBe("running");
    expect(PhaseStatus.DONE).toBe("done");
    expect(PhaseStatus.FAILED).toBe("failed");
    expect(PhaseStatus.GATE_CHECK).toBe("gate_check");
  });
});

describe("OrchestratorMode", () => {
  test("has all 8 modes", () => {
    const modes = Object.values(OrchestratorMode);
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

describe("DEFAULT_CONFIG", () => {
  test("has reasonable timeout defaults", () => {
    expect(DEFAULT_CONFIG.turnTimeout).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.phaseTimeout).toBeGreaterThan(DEFAULT_CONFIG.turnTimeout);
    expect(DEFAULT_CONFIG.totalTimeout).toBeGreaterThan(DEFAULT_CONFIG.phaseTimeout);
  });

  test("has review thresholds", () => {
    expect(DEFAULT_CONFIG.minTaskScore).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_CONFIG.minTaskScore).toBeLessThanOrEqual(10);
    expect(DEFAULT_CONFIG.minFinalScore).toBeGreaterThanOrEqual(DEFAULT_CONFIG.minTaskScore);
  });

  test("has validation settings", () => {
    expect(DEFAULT_CONFIG.validationEnabled).toBe(true);
    expect(DEFAULT_CONFIG.buildCommand).toBeTruthy();
    expect(DEFAULT_CONFIG.devServerPort).toBeGreaterThan(0);
  });
});

describe("createTask", () => {
  test("creates task with defaults", () => {
    const task = createTask({ id: "t1", prompt: "Do something" });
    expect(task.id).toBe("t1");
    expect(task.prompt).toBe("Do something");
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.retries).toBe(0);
    expect(task.reviewCycles).toBe(0);
    expect(task.reviewScore).toBe(0);
    expect(task.error).toBeNull();
    expect(task.validate).toBeNull();
    expect(task.phaseId).toBeNull();
  });

  test("respects custom values", () => {
    const task = createTask({
      id: "t2",
      prompt: "Build auth",
      phaseId: "p1",
      validate: "run: npm run build",
      maxRetries: 5,
      maxReviewCycles: 2,
    });
    expect(task.phaseId).toBe("p1");
    expect(task.validate).toBe("run: npm run build");
    expect(task.maxRetries).toBe(5);
    expect(task.maxReviewCycles).toBe(2);
  });

  test("handles snake_case aliases", () => {
    const task = createTask({
      id: "t3",
      prompt: "test",
      depends_on: "t2",
      max_retries: 4,
      max_review_cycles: 1,
    });
    expect(task.dependsOn).toBe("t2");
    expect(task.maxRetries).toBe(4);
    expect(task.maxReviewCycles).toBe(1);
  });
});

describe("createPhase", () => {
  test("creates phase with defaults", () => {
    const phase = createPhase({ id: "p1", name: "Scaffold" });
    expect(phase.id).toBe("p1");
    expect(phase.name).toBe("Scaffold");
    expect(phase.status).toBe(PhaseStatus.PENDING);
    expect(phase.tasks).toEqual([]);
    expect(phase.gate).toEqual({ fileChecks: [], commandChecks: [] });
  });

  test("creates nested tasks", () => {
    const phase = createPhase({
      id: "p1",
      name: "Setup",
      tasks: [
        { id: "t1", prompt: "Init project" },
        { id: "t2", prompt: "Add deps" },
      ],
    });
    expect(phase.tasks).toHaveLength(2);
    expect(phase.tasks[0].id).toBe("t1");
    expect(phase.tasks[0].status).toBe(TaskStatus.PENDING);
    expect(phase.tasks[1].id).toBe("t2");
  });

  test("preserves gate config", () => {
    const phase = createPhase({
      id: "p1",
      name: "Build",
      gate: { fileChecks: ["package.json"], commandChecks: ["npm run build"] },
    });
    expect(phase.gate.fileChecks).toEqual(["package.json"]);
    expect(phase.gate.commandChecks).toEqual(["npm run build"]);
  });
});
