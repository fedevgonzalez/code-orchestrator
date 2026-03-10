/**
 * Claude CLI Adapter — Runs Claude Code in headless `-p` mode.
 *
 * Replaces the PTY-based approach with per-prompt `claude -p` invocations.
 * Uses `--resume <sessionId>` to maintain conversation context across calls.
 * No PTY, no ConPTY, no ANSI parsing, no zombie processes.
 */

import { spawn } from "child_process";
import which from "which";
import { platform, homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Find the claude CLI binary.
 */
export function findClaudeBinary() {
  try {
    return which.sync("claude");
  } catch { /* not on PATH, try manual locations */ }

  if (platform() === "win32") {
    const home = homedir();
    const candidates = [
      join(home, ".claude", "local", "claude.exe"),
      join(home, "AppData", "Local", "Programs", "claude", "claude.exe"),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }

  throw new Error(
    "Could not find 'claude' CLI. Make sure Claude Code is installed and on PATH."
  );
}

/**
 * Run a single prompt through Claude Code in headless mode.
 *
 * @param {string} prompt - The prompt to send
 * @param {string} cwd - Working directory
 * @param {object} opts
 * @param {string|null} opts.sessionId - Session ID for --resume (null for first call)
 * @param {boolean} opts.firstCall - If true, uses --session-id instead of --resume
 * @param {number} opts.timeoutMs - Timeout in ms (default 600000 = 10 min)
 * @param {function} opts.onStderr - Callback for stderr chunks (progress logging)
 * @param {number} opts.maxTurns - Max agentic turns (default: no limit)
 * @returns {Promise<{result: string, sessionId: string, costUsd: number, durationMs: number, raw: object}>}
 */
export function runClaudePrompt(prompt, cwd, opts = {}) {
  const {
    sessionId = null,
    firstCall = false,
    timeoutMs = 600_000,
    onStderr = null,
    maxTurns = null,
    verbose = false,
    allowUnsafe = true, // Set to false to require Claude's built-in permission prompts
  } = opts;

  const claudeBin = findClaudeBinary();

  const args = [
    "-p",
    prompt,
    "--output-format", "json",
  ];

  // Skip permission prompts (required for autonomous operation)
  // Users can disable this via config: { allowUnsafePermissions: false }
  if (allowUnsafe) {
    args.push("--dangerously-skip-permissions");
  }

  if (sessionId) {
    if (firstCall) {
      args.push("--session-id", sessionId);
    } else {
      args.push("--resume", sessionId);
    }
  }

  if (maxTurns) {
    args.push("--max-turns", String(maxTurns));
  }

  const env = { ...process.env };
  delete env.CLAUDECODE;

  return new Promise((resolve, reject) => {
    const chunks = [];
    const errChunks = [];

    const proc = spawn(claudeBin, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    proc.stdout.on("data", (chunk) => chunks.push(chunk));

    proc.stderr.on("data", (chunk) => {
      errChunks.push(chunk);
      if (onStderr) {
        try { onStderr(chunk.toString("utf-8")); } catch { /* stderr callback error, ignore */ }
      }
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      // Force kill after 10s grace period
      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch { /* already dead */ }
      }, 10_000);
      reject(new Error(`claude -p timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString("utf-8").trim();
      const stderr = Buffer.concat(errChunks).toString("utf-8").trim();

      if (code !== 0 && !stdout) {
        reject(new Error(`claude -p exited with code ${code}: ${stderr.slice(0, 500)}`));
        return;
      }

      try {
        const json = JSON.parse(stdout);
        let costUsd = json.total_cost_usd ?? json.cost_usd ?? json.total_cost ?? json.cost ?? 0;
        if (!costUsd && json.usage) {
          costUsd = json.usage.total_cost_usd ?? json.usage.cost_usd ?? json.usage.total_cost ?? json.usage.cost ?? 0;
        }
        if (costUsd === 0 && opts.verbose) {
          console.log(`[CLAUDE-CLI] Cost is 0. Available keys: ${Object.keys(json).join(", ")}`);
        }
        resolve({
          result: json.result || "",
          sessionId: json.session_id || sessionId,
          costUsd,
          durationMs: json.duration_ms || json.duration || 0,
          raw: json,
        });
      } catch {
        // JSON parse failed — return raw text (claude may have returned non-JSON)
        resolve({
          result: stdout,
          sessionId: sessionId,
          costUsd: 0,
          durationMs: 0,
          raw: null,
        });
      }
    });

    // Close stdin — prompt is passed via CLI arg, not stdin
    proc.stdin.end();
  });
}
