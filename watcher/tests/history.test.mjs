import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadHistory, saveRunRecord, getHistoryStats, historyPath } from "../src/history.mjs";

const TEST_DIR = join(tmpdir(), "claude-orch-history-test-" + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("loadHistory", () => {
  test("returns empty array when no history file", () => {
    expect(loadHistory(TEST_DIR)).toEqual([]);
  });
});

describe("saveRunRecord", () => {
  test("saves and loads a run record", () => {
    const record = {
      runId: "run-1",
      mode: "feature",
      status: "completed",
      startedAt: Date.now() - 60000,
      finishedAt: Date.now(),
      durationMs: 60000,
      totalPhases: 3,
      completedPhases: 3,
      totalTasks: 10,
      completedTasks: 10,
      failedTasks: 0,
      totalCostUsd: 0.25,
      restarts: 0,
      avgReviewScore: 8.5,
    };

    saveRunRecord(TEST_DIR, record);
    const history = loadHistory(TEST_DIR);
    expect(history).toHaveLength(1);
    expect(history[0].runId).toBe("run-1");
    expect(history[0].mode).toBe("feature");
    expect(history[0].avgReviewScore).toBe(8.5);
  });

  test("appends multiple records", () => {
    saveRunRecord(TEST_DIR, { runId: "r1", mode: "build", status: "completed" });
    saveRunRecord(TEST_DIR, { runId: "r2", mode: "fix", status: "failed" });
    const history = loadHistory(TEST_DIR);
    expect(history).toHaveLength(2);
  });
});

describe("getHistoryStats", () => {
  test("returns zero stats for empty history", () => {
    const stats = getHistoryStats([]);
    expect(stats.totalRuns).toBe(0);
    expect(stats.successRate).toBe(0);
  });

  test("calculates correct stats", () => {
    const history = [
      { runId: "r1", mode: "build", status: "completed", durationMs: 120000, avgReviewScore: 8 },
      { runId: "r2", mode: "fix", status: "completed", durationMs: 60000, avgReviewScore: 9 },
      { runId: "r3", mode: "build", status: "failed", durationMs: 30000, avgReviewScore: 5 },
    ];

    const stats = getHistoryStats(history);
    expect(stats.totalRuns).toBe(3);
    expect(stats.completedRuns).toBe(2);
    expect(stats.failedRuns).toBe(1);
    expect(stats.successRate).toBe(67);
    expect(stats.modeBreakdown.build.runs).toBe(2);
    expect(stats.modeBreakdown.fix.runs).toBe(1);
  });
});

describe("historyPath", () => {
  test("returns correct path", () => {
    const p = historyPath("/some/project");
    expect(p).toContain(".orchestrator");
    expect(p).toContain("history.json");
  });
});
