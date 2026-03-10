import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Mock claude-cli.mjs BEFORE importing orchestrator
// ---------------------------------------------------------------------------
const mockRunClaudePrompt = jest.fn();
const mockFindClaudeBinary = jest.fn(() => "/usr/bin/claude");

jest.unstable_mockModule("../src/claude-cli.mjs", () => ({
  runClaudePrompt: mockRunClaudePrompt,
  findClaudeBinary: mockFindClaudeBinary,
}));

// Mock validator to avoid real build/test checks
jest.unstable_mockModule("../src/validator.mjs", () => ({
  runValidation: jest.fn(() => ({ ok: true, message: "mock pass" })),
  runPhaseValidation: jest.fn(async () => ({ ok: true, results: [] })),
  runPlaywrightTests: jest.fn(async () => ({ ok: true })),
}));

// Now import orchestrator (picks up mocks)
const { Orchestrator } = await import("../src/orchestrator.mjs");
const { TaskStatus, PhaseStatus, createPhase } = await import("../src/models.mjs");
const { saveCheckpoint, loadCheckpoint, checkpointPath } = await import("../src/checkpoint.mjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir;

function makeTempDir() {
  const dir = join(tmpdir(), `orch-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  // Create minimal package.json so the JSONL dir resolution and any analyzer
  // checks do not blow up.
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test-project" }));
  return dir;
}

/**
 * Build a checkpoint state with pre-set phases ready for execution.
 * This is the cleanest way to feed phases into the orchestrator without
 * needing to mock the entire plan-generation pipeline.
 */
function buildCheckpointState(phases, overrides = {}) {
  return {
    runId: overrides.runId || `run-test-${Date.now()}`,
    mode: overrides.mode || "build",
    prompt: overrides.prompt || null,
    flags: overrides.flags || {},
    status: "running",
    phases,
    specText: "",
    analysis: null,
    currentPhaseIdx: 0,
    currentTaskIdx: 0,
    completedTasks: [],
    startedAt: Date.now(),
    sessionId: null,
    ...overrides,
  };
}

/** Seed a checkpoint file so resume: true can load it. */
function seedCheckpoint(cwd, phases, overrides = {}) {
  const state = buildCheckpointState(phases, overrides);
  saveCheckpoint(state, checkpointPath(cwd));
  return state;
}

/** Create a default "success" response from the mock Claude CLI. */
function claudeSuccessResponse(extra = {}) {
  return {
    result: "Done.",
    sessionId: "sess-mock-123",
    costUsd: 0,
    durationMs: 100,
    raw: {},
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tempDir = makeTempDir();
  jest.clearAllMocks();
  // Default: every Claude call succeeds with zero cost
  mockRunClaudePrompt.mockResolvedValue(claudeSuccessResponse());
});

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch { /* best-effort cleanup */ }
});

// ===========================================================================
// Test cases
// ===========================================================================

describe("Orchestrator — dry-run mode", () => {
  test("completes without calling Claude when dryRun is true", async () => {
    const phases = [
      createPhase({
        id: "p1",
        name: "Setup",
        tasks: [
          { id: "t1", prompt: "Initialize the project scaffold" },
          { id: "t2", prompt: "Add dependencies" },
        ],
      }),
    ];

    seedCheckpoint(tempDir, phases);

    const orch = new Orchestrator({
      cwd: tempDir,
      resume: true,
      dryRun: true,
      noReview: true,
      config: { validationEnabled: false, claudeMinDelayMs: 0 },
    });

    await orch.run();

    expect(orch.status).toBe("completed");
    // Claude should never have been invoked
    expect(mockRunClaudePrompt).not.toHaveBeenCalled();
  });
});

describe("Orchestrator — task execution flow", () => {
  test("executes a 1-phase, 2-task plan and marks everything done", async () => {
    mockRunClaudePrompt.mockResolvedValue(claudeSuccessResponse({ costUsd: 0 }));

    const phases = [
      createPhase({
        id: "p1",
        name: "Implementation",
        tasks: [
          { id: "t1", prompt: "Create the user model" },
          { id: "t2", prompt: "Create the user controller" },
        ],
      }),
    ];

    seedCheckpoint(tempDir, phases);

    const orch = new Orchestrator({
      cwd: tempDir,
      resume: true,
      noReview: true,
      config: { validationEnabled: false, claudeMinDelayMs: 0 },
    });

    await orch.run();

    expect(orch.status).toBe("completed");

    // Both tasks should be done
    const phase = orch.phases[0];
    expect(phase.tasks[0].status).toBe(TaskStatus.DONE);
    expect(phase.tasks[1].status).toBe(TaskStatus.DONE);

    // Phase itself should be done
    expect(phase.status).toBe(PhaseStatus.DONE);

    // runClaudePrompt should have been called once per task
    expect(mockRunClaudePrompt.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Orchestrator — task failure and retry", () => {
  test("retries a failing task and eventually succeeds (parallel path)", async () => {
    // First call throws, second succeeds.
    // We use maxConcurrentClaude > 1 to engage the parallel execution path
    // which properly resets task status to PENDING before retrying.
    mockRunClaudePrompt
      .mockRejectedValueOnce(new Error("Claude API timeout"))
      .mockResolvedValue(claudeSuccessResponse());

    const phases = [
      createPhase({
        id: "p1",
        name: "Single task",
        tasks: [{ id: "t1", prompt: "Do something tricky", maxRetries: 2 }],
      }),
    ];

    seedCheckpoint(tempDir, phases);

    const orch = new Orchestrator({
      cwd: tempDir,
      resume: true,
      noReview: true,
      config: {
        validationEnabled: false,
        claudeMinDelayMs: 0,
        maxConcurrentClaude: 2,
      },
    });

    await orch.run();

    expect(orch.status).toBe("completed");
    expect(orch.phases[0].tasks[0].status).toBe(TaskStatus.DONE);

    // Should have been called at least twice (first fail + retry success)
    expect(mockRunClaudePrompt.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Orchestrator — checkpoint save/load", () => {
  test("creates a checkpoint file after running tasks", async () => {
    mockRunClaudePrompt.mockResolvedValue(claudeSuccessResponse());

    const phases = [
      createPhase({
        id: "p1",
        name: "Checkpoint test",
        tasks: [{ id: "t1", prompt: "Write some code" }],
      }),
    ];

    seedCheckpoint(tempDir, phases);

    const orch = new Orchestrator({
      cwd: tempDir,
      resume: true,
      noReview: true,
      config: { validationEnabled: false, claudeMinDelayMs: 0 },
    });

    await orch.run();

    // Verify the checkpoint file exists
    const cpPath = checkpointPath(tempDir);
    expect(existsSync(cpPath)).toBe(true);

    // Load it and verify state is preserved
    const loaded = loadCheckpoint(cpPath);
    expect(loaded).not.toBeNull();
    expect(loaded.status).toBe("completed");
    expect(loaded.phases).toHaveLength(1);
    expect(loaded.phases[0].tasks[0].status).toBe(TaskStatus.DONE);
    expect(loaded.phases[0].status).toBe(PhaseStatus.DONE);
    expect(loaded.runId).toBe(orch.runId);
  });

  test("resumes from a checkpoint with partially completed work", async () => {
    mockRunClaudePrompt.mockResolvedValue(claudeSuccessResponse());

    // Create a 2-phase plan where the first phase is already done
    const phase1 = createPhase({
      id: "p1",
      name: "Phase 1 - done",
      tasks: [{ id: "t1", prompt: "Already done task" }],
    });
    phase1.status = PhaseStatus.DONE;
    phase1.tasks[0].status = TaskStatus.DONE;

    const phase2 = createPhase({
      id: "p2",
      name: "Phase 2 - pending",
      tasks: [{ id: "t2", prompt: "Still needs work" }],
    });

    seedCheckpoint(tempDir, [phase1, phase2], { currentPhaseIdx: 1 });

    const orch = new Orchestrator({
      cwd: tempDir,
      resume: true,
      noReview: true,
      config: { validationEnabled: false, claudeMinDelayMs: 0 },
    });

    await orch.run();

    expect(orch.status).toBe("completed");
    expect(orch.phases[0].status).toBe(PhaseStatus.DONE);
    expect(orch.phases[1].status).toBe(PhaseStatus.DONE);
    expect(orch.phases[1].tasks[0].status).toBe(TaskStatus.DONE);
  });
});

describe("Orchestrator — cost tracking", () => {
  test("accumulates cost across multiple tasks", async () => {
    mockRunClaudePrompt.mockResolvedValue(claudeSuccessResponse({ costUsd: 0.05 }));

    const phases = [
      createPhase({
        id: "p1",
        name: "Cost tracking",
        tasks: [
          { id: "t1", prompt: "Task one" },
          { id: "t2", prompt: "Task two" },
        ],
      }),
    ];

    seedCheckpoint(tempDir, phases);

    const orch = new Orchestrator({
      cwd: tempDir,
      resume: true,
      noReview: true,
      config: { validationEnabled: false, claudeMinDelayMs: 0 },
    });

    await orch.run();

    expect(orch.status).toBe("completed");
    // Each task triggers at least one Claude call at $0.05 each.
    // With 2 tasks that is at least $0.10.
    expect(orch.totalCostUsd).toBeGreaterThanOrEqual(0.10);
    // Sanity: cost should be a reasonable multiple of 0.05
    expect(orch.totalCostUsd % 0.05).toBeCloseTo(0, 5);
  });
});
