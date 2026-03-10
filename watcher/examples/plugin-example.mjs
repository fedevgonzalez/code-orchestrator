/**
 * Example Plugin for Code Orchestrator
 *
 * Demonstrates every capability of the plugin API:
 *   - Custom validators (orch.addValidator)
 *   - Lifecycle hooks (orch.addHook)
 *   - Phase validator overrides (orch.addPhaseValidators)
 *
 * Usage:
 *   In your project config, add this plugin to the `plugins` array:
 *
 *     {
 *       "plugins": ["./examples/plugin-example.mjs"]
 *     }
 *
 *   The orchestrator will call `register(orch)` at startup, where `orch`
 *   is a PluginRegistry instance exposing addValidator, addHook, and
 *   addPhaseValidators.
 *
 * @module plugin-example
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Configuration — adjust these for your environment
// ---------------------------------------------------------------------------

/** Slack webhook URL for event notifications (set via env or hardcode for testing). */
const SLACK_WEBHOOK_URL = process.env.SLACK_ORCHESTRATOR_WEBHOOK || "";

/** Phases where validation should be skipped (e.g., documentation-only phases). */
const SKIP_VALIDATION_PHASES = new Set([
  "launch-assets",
  "screenshots",
]);

/** ESLint timeout in milliseconds. */
const ESLINT_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Helper: send a message to a Slack incoming webhook
// ---------------------------------------------------------------------------

/**
 * Post a JSON payload to a Slack incoming webhook.
 * Fails silently so that webhook issues never block the orchestrator.
 *
 * @param {string} text - The message text to send.
 * @param {object} [fields] - Optional key/value pairs rendered as attachment fields.
 */
async function postToSlack(text, fields = {}) {
  if (!SLACK_WEBHOOK_URL) return;

  const attachmentFields = Object.entries(fields).map(([title, value]) => ({
    title,
    value: String(value),
    short: String(value).length < 40,
  }));

  const payload = {
    text,
    attachments: attachmentFields.length > 0
      ? [{ color: "#7C3AED", fields: attachmentFields }]
      : undefined,
  };

  try {
    // Use a dynamic import so the plugin works in environments without
    // a global fetch (Node 16/17). Falls back to the built-in fetch in
    // Node 18+.
    const fetchFn = globalThis.fetch ?? (await import("node-fetch")).default;
    await fetchFn(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Never let a notification failure break the build.
    console.error(`[plugin-example] Slack notification failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Custom Validator: eslint
// ---------------------------------------------------------------------------

/**
 * Run ESLint on the project and return a structured result.
 *
 * The validator auto-detects whether the project uses ESLint by looking for
 * common config files. If ESLint is not configured it returns a passing
 * result with a note, rather than failing.
 *
 * @param {string} cwd  - Project root directory.
 * @param {object} config - Orchestrator config (may contain overrides).
 * @returns {Promise<{type: string, ok: boolean, message: string, output?: string}>}
 */
async function eslintValidator(cwd, config) {
  // Check for an ESLint config before running — avoids a confusing error
  // when the project has no linter set up.
  const configFiles = [
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yml",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
  ];

  const hasEslint = configFiles.some((f) => existsSync(join(cwd, f)));

  // Also check package.json for an eslintConfig key.
  if (!hasEslint) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
      if (!pkg.eslintConfig) {
        return {
          type: "eslint",
          ok: true,
          message: "ESLint not configured in this project — skipping",
        };
      }
    } catch {
      return {
        type: "eslint",
        ok: true,
        message: "No package.json found — skipping ESLint",
      };
    }
  }

  const cmd = config.eslintCommand || "npx eslint . --max-warnings 0";
  const timeout = config.eslintTimeout || ESLINT_TIMEOUT_MS;

  try {
    const output = execSync(cmd, {
      cwd,
      stdio: "pipe",
      timeout,
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });

    return {
      type: "eslint",
      ok: true,
      message: "ESLint passed with no warnings or errors",
      output: output.slice(-500),
    };
  } catch (err) {
    const stderr = (err.stderr || "").slice(-1500);
    const stdout = (err.stdout || "").slice(-1000);
    const output = stderr || stdout || err.message || "Unknown ESLint error";

    // Parse a summary line like "12 problems (4 errors, 8 warnings)"
    const summaryMatch = output.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
    const summary = summaryMatch
      ? `${summaryMatch[2]} errors, ${summaryMatch[3]} warnings`
      : "lint errors detected";

    return {
      type: "eslint",
      ok: false,
      message: `ESLint failed: ${summary}`,
      output,
    };
  }
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

/**
 * Register this plugin with the orchestrator.
 *
 * Called automatically when the orchestrator loads the plugin. The `orch`
 * parameter is a {@link PluginRegistry} instance that exposes:
 *
 *   - `addValidator(name, fn)` — register a named validator
 *   - `addHook(event, fn)`     — register a lifecycle hook
 *   - `addPhaseValidators(phaseId, names)` — attach validators to a phase
 *
 * @param {import("../src/plugins.mjs").PluginRegistry} orch
 */
export function register(orch) {

  // -----------------------------------------------------------------------
  // 1. Custom validator — "eslint"
  //
  //    Can be referenced in phase config or added via addPhaseValidators.
  //    Signature: async (cwd, config) => { type, ok, message, output? }
  // -----------------------------------------------------------------------

  orch.addValidator("eslint", eslintValidator);

  // -----------------------------------------------------------------------
  // 2. afterTask hook — log task completion with timing and score
  //
  //    Receives (task, phase) after each task finishes successfully.
  //    Useful for audit trails, metrics collection, or notifications.
  // -----------------------------------------------------------------------

  orch.addHook("afterTask", async (task, phase) => {
    const score = task.reviewScore ?? "N/A";
    const retries = task.retries || 0;

    console.log(
      `[plugin-example] Task completed: ${phase.id}/${task.id} ` +
      `| status=${task.status} score=${score} retries=${retries}`
    );

    // Notify Slack when a task scores below 7 (potential quality issue).
    if (typeof task.reviewScore === "number" && task.reviewScore < 7) {
      await postToSlack(
        `Low score on task *${phase.id}/${task.id}*`,
        { Score: task.reviewScore, Retries: retries, Phase: phase.name },
      );
    }
  });

  // -----------------------------------------------------------------------
  // 3. beforePhaseValidation hook — conditionally skip validation
  //
  //    Receives (phase, phaseIdx). Runs before the built-in phase
  //    validators execute. You can mutate phase or config here.
  //
  //    This example skips validation entirely for documentation/asset
  //    phases where build checks are not meaningful.
  // -----------------------------------------------------------------------

  orch.addHook("beforePhaseValidation", async (phase, _phaseIdx) => {
    const normalizedId = phase.id.toLowerCase().replace(/\s+/g, "-");

    if (SKIP_VALIDATION_PHASES.has(normalizedId)) {
      console.log(
        `[plugin-example] Skipping validation for phase "${phase.id}" ` +
        `(listed in SKIP_VALIDATION_PHASES)`
      );
      // Mark all tasks as done so the orchestrator treats validation as
      // a no-op. The built-in validator checks task statuses and won't
      // re-run tasks that are already done.
      for (const task of phase.tasks) {
        if (task.status === "pending") {
          task.status = "skipped";
        }
      }
    }
  });

  // -----------------------------------------------------------------------
  // 4. onEvent hook — forward orchestrator events to Slack
  //
  //    The orchestrator fires events like phase_start, phase_done,
  //    task_start, task_done, task_failed, run_complete, error, etc.
  //    This hook catches them all and posts notable ones to Slack.
  // -----------------------------------------------------------------------

  /** Events worth forwarding to Slack. */
  const NOTABLE_EVENTS = new Set([
    "phase_start",
    "phase_done",
    "task_failed",
    "run_complete",
    "error",
    "timeout",
    "phase_timeout",
  ]);

  orch.addHook("onEvent", async (event) => {
    if (!event || !event.type) return;

    // Log every event locally for debugging.
    console.log(`[plugin-example] Event: ${event.type}`, JSON.stringify(event).slice(0, 200));

    // Only forward notable events to Slack to avoid noise.
    if (!NOTABLE_EVENTS.has(event.type)) return;

    const fields = {};
    if (event.phaseId)    fields["Phase"]  = event.phaseId;
    if (event.taskId)     fields["Task"]   = event.taskId;
    if (event.status)     fields["Status"] = event.status;
    if (event.doneTasks != null && event.totalTasks != null) {
      fields["Progress"] = `${event.doneTasks}/${event.totalTasks}`;
    }
    if (event.elapsed)    fields["Elapsed"] = `${Math.floor(event.elapsed / 60)}m`;

    const icon = event.type === "error" || event.type === "task_failed" ? "[FAIL]" : "[INFO]";
    await postToSlack(`${icon} Orchestrator event: *${event.type}*`, fields);
  });

  // -----------------------------------------------------------------------
  // 5. Phase validator overrides — add "eslint" to frontend-related phases
  //
  //    addPhaseValidators(phaseId, validatorNames) appends plugin
  //    validators to a phase. These run in addition to the built-in
  //    validators defined in validator.mjs.
  //
  //    The phaseId must match the normalized ID used internally
  //    (e.g., "frontend", "core-api", "integration").
  // -----------------------------------------------------------------------

  orch.addPhaseValidators("frontend",    ["eslint"]);
  orch.addPhaseValidators("core-api",    ["eslint"]);
  orch.addPhaseValidators("integration", ["eslint"]);
  orch.addPhaseValidators("ux-polish",   ["eslint"]);

  // -----------------------------------------------------------------------

  console.log("[plugin-example] Plugin registered successfully");
}
