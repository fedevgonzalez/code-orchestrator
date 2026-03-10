import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { saveCheckpoint, loadCheckpoint, checkpointPath } from "../src/checkpoint.mjs";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "claude-orch-test-" + Date.now());
const CP_PATH = join(TEST_DIR, ".orchestrator", "checkpoint.json");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("checkpointPath", () => {
  test("returns correct path", () => {
    const p = checkpointPath("/some/project");
    expect(p).toContain(".orchestrator");
    expect(p).toContain("checkpoint.json");
  });
});

describe("saveCheckpoint + loadCheckpoint", () => {
  test("round-trips state correctly", () => {
    const state = {
      runId: "run-123",
      currentPhaseIdx: 2,
      status: "running",
      phases: [
        { id: "p1", status: "done", tasks: [{ id: "t1", status: "done" }] },
        { id: "p2", status: "done", tasks: [{ id: "t2", status: "done" }] },
        { id: "p3", status: "running", tasks: [{ id: "t3", status: "pending" }] },
      ],
    };

    saveCheckpoint(state, CP_PATH);
    expect(existsSync(CP_PATH)).toBe(true);

    const loaded = loadCheckpoint(CP_PATH);
    expect(loaded.runId).toBe("run-123");
    expect(loaded.currentPhaseIdx).toBe(2);
    expect(loaded.status).toBe("running");
    expect(loaded.phases).toHaveLength(3);
    expect(loaded.savedAt).toBeGreaterThan(0);
  });

  test("overwrites existing checkpoint", () => {
    saveCheckpoint({ runId: "run-1", status: "running" }, CP_PATH);
    saveCheckpoint({ runId: "run-2", status: "completed" }, CP_PATH);

    const loaded = loadCheckpoint(CP_PATH);
    expect(loaded.runId).toBe("run-2");
    expect(loaded.status).toBe("completed");
  });

  test("returns null for missing file", () => {
    const result = loadCheckpoint(join(TEST_DIR, "nonexistent.json"));
    expect(result).toBeNull();
  });

  test("returns null for corrupt file", () => {
    const corruptPath = join(TEST_DIR, ".orchestrator", "corrupt.json");
    mkdirSync(join(TEST_DIR, ".orchestrator"), { recursive: true });
    writeFileSync(corruptPath, "not json{{{", "utf-8");

    const result = loadCheckpoint(corruptPath);
    expect(result).toBeNull();
  });

  test("no tmp file remains after save", () => {
    saveCheckpoint({ test: true }, CP_PATH);
    expect(existsSync(CP_PATH + ".tmp")).toBe(false);
  });
});

describe("checkpoint preserves mode data", () => {
  test("saves and loads mode, prompt, flags", () => {
    const state = {
      runId: "run-456",
      mode: "feature",
      prompt: "add dark mode",
      flags: { type: "ui", fix: true },
      currentPhaseIdx: 0,
      status: "running",
      sessionId: "abc-def-123",
    };

    saveCheckpoint(state, CP_PATH);
    const loaded = loadCheckpoint(CP_PATH);

    expect(loaded.mode).toBe("feature");
    expect(loaded.prompt).toBe("add dark mode");
    expect(loaded.flags.type).toBe("ui");
    expect(loaded.flags.fix).toBe(true);
    expect(loaded.sessionId).toBe("abc-def-123");
  });
});
