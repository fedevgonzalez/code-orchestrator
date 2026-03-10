/**
 * History — Run history and metrics tracking.
 *
 * Stores a record of each orchestrator run with timing, cost, and outcome data.
 * Persisted to `.orchestrator/history.json` in the project directory.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const MAX_HISTORY_ENTRIES = 200;

/**
 * @typedef {object} RunRecord
 * @property {string} runId
 * @property {string} mode
 * @property {string} [prompt]
 * @property {string} status - completed | failed | stopped
 * @property {number} startedAt - timestamp
 * @property {number} finishedAt - timestamp
 * @property {number} durationMs
 * @property {number} totalPhases
 * @property {number} completedPhases
 * @property {number} totalTasks
 * @property {number} completedTasks
 * @property {number} failedTasks
 * @property {number} totalCostUsd
 * @property {number} restarts
 * @property {number} avgReviewScore
 * @property {string[]} [errors]
 */

/**
 * Get the history file path.
 * @param {string} cwd
 * @returns {string}
 */
export function historyPath(cwd) {
  return join(cwd, ".orchestrator", "history.json");
}

/**
 * Load run history.
 * @param {string} cwd
 * @returns {RunRecord[]}
 */
export function loadHistory(cwd) {
  const path = historyPath(cwd);
  if (!existsSync(path)) return [];

  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Save a run record to history.
 * @param {string} cwd
 * @param {RunRecord} record
 */
export function saveRunRecord(cwd, record) {
  const dir = join(cwd, ".orchestrator");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const history = loadHistory(cwd);
  history.push(record);

  // Trim to max entries
  while (history.length > MAX_HISTORY_ENTRIES) {
    history.shift();
  }

  writeFileSync(historyPath(cwd), JSON.stringify(history, null, 2), "utf-8");
  console.log(`[HISTORY] Saved run ${record.runId} (${record.status}, ${record.completedTasks}/${record.totalTasks} tasks)`);
}

/**
 * Create a run record from orchestrator state.
 * @param {object} orchestrator - Orchestrator instance
 * @param {number} [restarts=0]
 * @returns {RunRecord}
 */
export function createRunRecord(orchestrator, restarts = 0) {
  const phases = orchestrator.phases || [];
  const totalTasks = phases.reduce((s, p) => s + p.tasks.length, 0);
  const completedTasks = phases.reduce(
    (s, p) => s + p.tasks.filter((t) => t.status === "done").length, 0
  );
  const failedTasks = phases.reduce(
    (s, p) => s + p.tasks.filter((t) => t.status === "failed").length, 0
  );
  const completedPhases = phases.filter((p) => p.status === "done").length;

  // Calculate average review score
  let totalScore = 0;
  let scoredTasks = 0;
  for (const phase of phases) {
    for (const task of phase.tasks) {
      if (task.reviewScore > 0) {
        totalScore += task.reviewScore;
        scoredTasks++;
      }
    }
  }

  return {
    runId: orchestrator.runId,
    mode: orchestrator.mode,
    prompt: orchestrator.prompt ? orchestrator.prompt.slice(0, 200) : null,
    status: orchestrator.status,
    startedAt: orchestrator.startedAt,
    finishedAt: Date.now(),
    durationMs: Date.now() - (orchestrator.startedAt || Date.now()),
    totalPhases: phases.length,
    completedPhases,
    totalTasks,
    completedTasks,
    failedTasks,
    totalCostUsd: 0, // TODO: aggregate from task results
    restarts,
    avgReviewScore: scoredTasks > 0 ? Math.round((totalScore / scoredTasks) * 10) / 10 : 0,
  };
}

/**
 * Get summary statistics from history.
 * @param {RunRecord[]} history
 * @returns {object}
 */
export function getHistoryStats(history) {
  if (history.length === 0) {
    return { totalRuns: 0, successRate: 0, avgDuration: 0, avgScore: 0, totalCost: 0 };
  }

  const completed = history.filter((r) => r.status === "completed");
  const totalDuration = history.reduce((s, r) => s + (r.durationMs || 0), 0);
  const totalCost = history.reduce((s, r) => s + (r.totalCostUsd || 0), 0);
  const totalScore = history.reduce((s, r) => s + (r.avgReviewScore || 0), 0);
  const scoredRuns = history.filter((r) => r.avgReviewScore > 0).length;

  return {
    totalRuns: history.length,
    completedRuns: completed.length,
    failedRuns: history.length - completed.length,
    successRate: Math.round((completed.length / history.length) * 100),
    avgDurationMs: Math.round(totalDuration / history.length),
    avgScore: scoredRuns > 0 ? Math.round((totalScore / scoredRuns) * 10) / 10 : 0,
    totalCostUsd: Math.round(totalCost * 10000) / 10000,
    lastRun: history[history.length - 1] || null,
    modeBreakdown: getModeBreakdown(history),
  };
}

/**
 * @param {RunRecord[]} history
 */
function getModeBreakdown(history) {
  const modes = {};
  for (const run of history) {
    if (!modes[run.mode]) modes[run.mode] = { runs: 0, completed: 0 };
    modes[run.mode].runs++;
    if (run.status === "completed") modes[run.mode].completed++;
  }
  return modes;
}
