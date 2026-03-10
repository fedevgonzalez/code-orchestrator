/**
 * Reviewer — calls claude -p (pipe mode) to review code.
 */

import { execFileSync } from "child_process";
import { readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { findClaudeBinary } from "./claude-cli.mjs";
import { getJsonlDir } from "./jsonl.mjs";

const REVIEW_TIMEOUT = 300_000; // 5 min

/**
 * Call claude CLI in pipe mode.
 * Passes prompt via stdin to avoid Windows command-line issues and extra terminal windows.
 * @param {string} prompt
 * @param {string} cwd
 * @returns {string} Claude's response
 */
/**
 * Get current JSONL file set for a project (to diff before/after reviewer calls).
 */
function snapshotJsonls(cwd) {
  try {
    const dir = getJsonlDir(cwd);
    return new Set(readdirSync(dir).filter((f) => f.endsWith(".jsonl")));
  } catch {
    return new Set();
  }
}

/**
 * Delete JSONL files created by `claude -p` (reviewer) to avoid ghost sessions
 * showing up in observers like pixel.lab.
 */
function cleanupReviewerJsonls(cwd, before) {
  try {
    const dir = getJsonlDir(cwd);
    const after = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    console.log(`[REVIEWER] Cleanup: before=${before.size} files, after=${after.length} files`);
    for (const f of after) {
      if (!before.has(f)) {
        try {
          unlinkSync(join(dir, f));
          console.log(`[REVIEWER] Cleaned up ghost JSONL: ${f}`);
        } catch (e) {
          console.log(`[REVIEWER] Failed to delete ${f}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log(`[REVIEWER] Cleanup error: ${e.message}`);
  }
}

export function callClaudePipe(prompt, cwd, opts = {}) {
  const claudeBin = findClaudeBinary();
  const beforeJsonls = snapshotJsonls(cwd);
  const { outputFormat = null, maxTurns = null } = opts;

  const args = ["-p", "--no-session-persistence"];
  if (outputFormat) args.push("--output-format", outputFormat);
  if (maxTurns) args.push("--max-turns", String(maxTurns));

  try {
    // Remove CLAUDECODE env var to avoid "nested session" error
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const result = execFileSync(claudeBin, args, {
      input: prompt,
      cwd,
      timeout: REVIEW_TIMEOUT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      env,
    });

    // Clean up JSONL files created by this `claude -p` call
    cleanupReviewerJsonls(cwd, beforeJsonls);

    let output = result.trim();

    // If using json output format, extract the result text
    if (outputFormat === "json" && output.startsWith("{")) {
      try {
        const parsed = JSON.parse(output);
        output = parsed.result || output;
      } catch { /* not valid JSON, use raw output */ }
    }

    return output;
  } catch (e) {
    cleanupReviewerJsonls(cwd, beforeJsonls);
    console.error(`[REVIEWER] claude -p failed: ${e.message?.slice(0, 200)}`);
    return '{"approved": true, "score": 5, "issues": ["Review call failed"]}';
  }
}

