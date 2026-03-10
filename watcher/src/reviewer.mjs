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

/**
 * Parse a JSON response from Claude (may have markdown fences).
 */
function parseReviewJson(raw) {
  let jsonStr = raw;
  if (raw.includes("```json")) {
    const start = raw.indexOf("```json") + 7;
    const end = raw.indexOf("```", start);
    jsonStr = raw.slice(start, end).trim();
  } else if (raw.includes("```")) {
    const start = raw.indexOf("```") + 3;
    const end = raw.indexOf("```", start);
    jsonStr = raw.slice(start, end).trim();
  } else if (raw.includes("{")) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    jsonStr = raw.slice(start, end);
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    return { approved: true, score: 5, issues: ["Could not parse review response"] };
  }
}

const REVIEW_PROMPT = `You are a senior code reviewer. Review the current state of this project after the following task was completed.

TASK: {task}
SPEC: {spec}

Evaluate: correctness, completeness, code quality, security. Score 7+ = acceptable.
Respond with ONLY JSON (no markdown outside):
{"approved": true/false, "score": 1-10, "issues": ["issue 1"], "suggestions": ["suggestion 1"]}`;

const FINAL_REVIEW_PROMPT = `You are a senior tech lead doing a FINAL review before production.

SPEC: {spec}
COMPLETED TASKS: {tasks}

Check: architecture, security, test coverage, deployment readiness, all spec features implemented. Score 8+ = production-ready.
Respond with ONLY JSON:
{"approved": true/false, "score": 1-10, "issues": ["critical issue"], "suggestions": ["nice to have"]}`;

/**
 * Review a single task.
 * @returns {{approved: boolean, score: number, issues: string[], fixPrompt: string}}
 */
export function reviewTask(taskPrompt, specSummary, cwd) {
  const prompt = REVIEW_PROMPT
    .replace("{task}", taskPrompt.slice(0, 500))
    .replace("{spec}", specSummary.slice(0, 2000));

  console.log("[REVIEWER] Running task review...");
  const raw = callClaudePipe(prompt, cwd);
  const data = parseReviewJson(raw);

  const issues = data.issues || [];
  const score = data.score || 5;
  const approved = data.approved ?? score >= 7;

  let fixPrompt = "";
  if (!approved && issues.length > 0) {
    fixPrompt = "The code reviewer found these issues:\n"
      + issues.map((iss, i) => `${i + 1}. ${iss}`).join("\n")
      + "\n\nFix all issues listed above.";
  }

  console.log(`[REVIEWER] Score: ${score}/10, approved: ${approved}, issues: ${issues.length}`);

  return { approved, score, issues, fixPrompt };
}

/**
 * Final comprehensive review.
 */
export function finalReview(specSummary, completedTasks, cwd) {
  const prompt = FINAL_REVIEW_PROMPT
    .replace("{spec}", specSummary.slice(0, 2000))
    .replace("{tasks}", completedTasks.map((t) => `- ${t}`).join("\n"));

  console.log("[REVIEWER] Running FINAL review...");
  const raw = callClaudePipe(prompt, cwd);
  const data = parseReviewJson(raw);

  console.log(`[REVIEWER] Final score: ${data.score}/10`);
  return data;
}
