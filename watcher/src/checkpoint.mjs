/**
 * Checkpoint — Atomic state persistence for crash recovery.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from "fs";
import { join, dirname } from "path";

/**
 * Save state atomically (write tmp then rename).
 */
export function saveCheckpoint(state, filePath) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const data = {
    ...state,
    savedAt: Date.now(),
  };

  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");

  // Atomic rename (Windows: delete first)
  if (existsSync(filePath)) {
    try { unlinkSync(filePath); } catch {}
  }
  renameSync(tmpPath, filePath);
}

/**
 * Load state from checkpoint.
 * @returns {object|null}
 */
export function loadCheckpoint(filePath) {
  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    console.log(
      `[CHECKPOINT] Loaded: run=${data.runId}, phase=${data.currentPhaseIdx}, status=${data.status}`
    );
    return data;
  } catch (e) {
    console.error(`[CHECKPOINT] Failed to load: ${e.message}`);
    return null;
  }
}

export function checkpointPath(cwd) {
  return join(cwd, ".orchestrator", "checkpoint.json");
}
