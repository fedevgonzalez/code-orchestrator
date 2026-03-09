/**
 * Validation — build checks, test execution, dev server health checks, E2E.
 *
 * All validation runs via child_process (not the PTY, which is occupied by Claude).
 * Phase-level validation runs after all tasks complete, before gate check.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { execSync, spawn as cpSpawn } from "child_process";
import { createConnection } from "net";
import { get as httpGet } from "http";
import { platform } from "os";

const BUILD_TIMEOUT = 300_000;   // 5 min
const TEST_TIMEOUT = 300_000;    // 5 min
const E2E_TIMEOUT = 300_000;     // 5 min
const SERVER_START_TIMEOUT = 60_000; // 1 min
const ENDPOINT_TIMEOUT = 10_000; // 10s per endpoint

// ── Per-task validation (existing API) ────────────────────────────────

/**
 * Run validation for a task.
 * @param {object} task
 * @param {string} cwd
 * @returns {{ok: boolean, message: string}}
 */
export function runValidation(task, cwd) {
  if (!task.validate) return { ok: true, message: "No validation required" };

  const v = task.validate.trim();

  if (v.startsWith("check file:")) return checkFiles(v, cwd);
  if (v.startsWith("run:")) return runCommand(v, cwd);
  if (v.startsWith("server:")) return checkServer(v, cwd);

  return { ok: true, message: `Unknown validation type, skipping: ${v}` };
}

function checkFiles(validation, cwd) {
  const filesStr = validation.replace("check file:", "").trim();
  const files = filesStr.split(",").map((f) => f.trim());
  const missing = files.filter((f) => !existsSync(join(cwd, f)));

  if (missing.length > 0) {
    return { ok: false, message: `Missing files: ${missing.join(", ")}` };
  }
  return { ok: true, message: `All files exist: ${files.join(", ")}` };
}

function runCommand(validation, cwd) {
  const cmd = validation.replace("run:", "").trim();
  try {
    execSync(cmd, { cwd, stdio: "pipe", timeout: BUILD_TIMEOUT, encoding: "utf-8" });
    return { ok: true, message: `Command succeeded: ${cmd}` };
  } catch (e) {
    const output = (e.stderr || e.stdout || e.message || "").slice(-500);
    return { ok: false, message: `Command failed: ${output}` };
  }
}

function checkServer(validation, cwd) {
  const parts = validation.replace("server:", "").trim().split("|");
  const startCmd = parts[0]?.trim() || "npm run dev";
  const port = parseInt(parts[1]?.trim()) || 3000;
  const timeout = parseInt(parts[2]?.trim()) || 30;

  return new Promise((resolve) => {
    const proc = cpSpawn(startCmd, { cwd, shell: true, stdio: "pipe" });
    let resolved = false;
    const finish = (ok, msg) => {
      if (resolved) return;
      resolved = true;
      killProcessTree(proc.pid);
      resolve({ ok, message: msg });
    };

    const startTime = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - startTime > timeout * 1000) {
        clearInterval(poll);
        finish(false, `Server didn't respond on port ${port} within ${timeout}s`);
        return;
      }
      const sock = createConnection({ port, host: "localhost" });
      sock.on("connect", () => {
        sock.destroy();
        clearInterval(poll);
        finish(true, `Server responded on port ${port}`);
      });
      sock.on("error", () => sock.destroy());
    }, 1000);

    proc.on("error", (err) => {
      clearInterval(poll);
      finish(false, `Failed to start server: ${err.message}`);
    });
  });
}

// ── Phase-level validation ────────────────────────────────────────────

/**
 * Phase validation mapping.
 * Defines which validators run after each phase completes.
 */
const PHASE_VALIDATORS = {
  "scaffold":      ["build"],
  "database":      ["build"],
  "auth":          ["build"],
  "core-api":      ["build"],
  "payments":      ["build"],
  "frontend":      ["build"],
  "onboarding":    ["build"],
  "integration":   ["build", "healthcheck"],
  "ux-polish":     ["build"],
  "nextspark-polish": ["build"],
  "seed-data":     ["build"],
  "landing":       ["build"],
  "seo":           ["build"],
  "legal":         ["build"],
  "email":         ["build"],
  "analytics":     ["build"],
  "security":      ["build"],
  "support":       ["build"],
  "testing":       ["build", "test", "e2e"],
  "screenshots":   ["screenshots"],
  "performance":   ["lighthouse"],
  "cicd":          ["cicd-files"],
  "deploy":        ["build"],
  "launch-assets": ["launch-files"],
};

/**
 * Run phase-level validation.
 * @param {string} phaseId - e.g. "scaffold", "frontend"
 * @param {string} cwd - Project directory
 * @param {object} [config] - Override defaults
 * @returns {Promise<{ok: boolean, results: Array}>}
 */
export async function runPhaseValidation(phaseId, cwd, config = {}) {
  // Normalize phase ID: "Project Scaffolding" -> "scaffold", "Core API & Business Logic" -> "core-api"
  const normalizedId = normalizePhaseId(phaseId);
  const validators = PHASE_VALIDATORS[normalizedId];

  if (!validators) {
    console.log(`[VALIDATE] No validators mapped for phase: ${phaseId} (normalized: ${normalizedId})`);
    return { ok: true, results: [] };
  }

  console.log(`[VALIDATE] Phase "${phaseId}" → running: ${validators.join(", ")}`);
  const results = [];

  for (const v of validators) {
    let result;
    switch (v) {
      case "build":
        result = runBuild(cwd, config);
        break;
      case "test":
        result = runTests(cwd, config);
        break;
      case "healthcheck":
        result = await runDevServerHealthCheck(cwd, config);
        break;
      case "e2e":
        result = await runPlaywrightTests(cwd, config);
        break;
      case "screenshots":
        result = await runScreenshots(cwd, config);
        break;
      case "lighthouse":
        result = await runLighthouse(cwd, config);
        break;
      case "launch-files":
        result = checkLaunchFiles(cwd);
        break;
      case "cicd-files":
        result = checkCicdFiles(cwd);
        break;
      default:
        result = { type: v, ok: true, message: `Unknown validator: ${v}` };
    }
    results.push(result);
    console.log(`[VALIDATE]   ${result.type}: ${result.ok ? "PASS" : "FAIL"} — ${result.message}`);

    // If build fails, skip subsequent validators (no point running tests on broken build)
    if (!result.ok && v === "build") break;
  }

  const ok = results.every((r) => r.ok);
  return { ok, results };
}

/**
 * Normalize a phase name/id to our mapping keys.
 */
function normalizePhaseId(id) {
  const lower = id.toLowerCase();
  if (lower.includes("scaffold")) return "scaffold";
  if (lower.includes("database") || lower.includes("orm")) return "database";
  if (lower.includes("auth")) return "auth";
  if ((lower.includes("core") || lower.includes("business")) && lower.includes("api")) return "core-api";
  if (lower.includes("payment") || lower.includes("billing") || lower.includes("stripe")) return "payments";
  if (lower.includes("onboarding") || lower.includes("settings")) return "onboarding";
  if (lower.includes("frontend") && !lower.includes("integration")) return "frontend";
  if (lower.includes("integration")) return "integration";
  if (lower.includes("nextspark") && lower.includes("polish")) return "nextspark-polish";
  if (lower.includes("ux") || lower.includes("polish") || lower.includes("dark mode")) return "ux-polish";
  if (lower.includes("seed")) return "seed-data";
  if (lower.includes("landing") || lower.includes("marketing")) return "landing";
  if (lower.includes("seo") || lower.includes("meta") || lower.includes("open graph")) return "seo";
  if (lower.includes("legal") || lower.includes("privacy") || lower.includes("gdpr")) return "legal";
  if (lower.includes("email") || lower.includes("cron")) return "email";
  if (lower.includes("analytics") || lower.includes("monitoring") || lower.includes("sentry")) return "analytics";
  if (lower.includes("security") || lower.includes("hardening")) return "security";
  if (lower.includes("support") || lower.includes("help") || lower.includes("faq")) return "support";
  if (lower.includes("test")) return "testing";
  if (lower.includes("screenshot") || lower.includes("visual")) return "screenshots";
  if (lower.includes("performance") || lower.includes("lighthouse")) return "performance";
  if (lower.includes("ci") || lower.includes("cd") || lower.includes("github actions")) return "cicd";
  if (lower.includes("deploy")) return "deploy";
  if (lower.includes("launch") || lower.includes("go-to-market")) return "launch-assets";
  return id;
}

// ── Build ─────────────────────────────────────────────────────────────

/**
 * Run `npm run build` and return the result.
 */
export function runBuild(cwd, config = {}) {
  const cmd = config.buildCommand || "npm run build";
  console.log(`[VALIDATE] Running: ${cmd}`);

  try {
    const output = execSync(cmd, {
      cwd,
      stdio: "pipe",
      timeout: config.buildTimeout || BUILD_TIMEOUT,
      encoding: "utf-8",
      env: { ...process.env, CI: "true", NODE_ENV: "production" },
    });
    return { type: "build", ok: true, message: "Build succeeded", output: output.slice(-500) };
  } catch (e) {
    const stderr = (e.stderr || "").slice(-2000);
    const stdout = (e.stdout || "").slice(-1000);
    const output = stderr || stdout || e.message || "Unknown error";
    return { type: "build", ok: false, message: `Build failed`, output };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

/**
 * Run `npm test` and return the result.
 * Checks if a test script exists in package.json first.
 */
export function runTests(cwd, config = {}) {
  // Check if there's a real test script
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
    const testScript = pkg.scripts?.test || "";
    if (!testScript || testScript.includes("no test specified")) {
      return { type: "test", ok: true, message: "No test script configured, skipping" };
    }
  } catch {
    return { type: "test", ok: true, message: "No package.json found, skipping tests" };
  }

  const cmd = config.testCommand || "npm test";
  console.log(`[VALIDATE] Running: ${cmd}`);

  try {
    const output = execSync(cmd, {
      cwd,
      stdio: "pipe",
      timeout: config.testTimeout || TEST_TIMEOUT,
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });

    // Try to parse test summary
    const summary = parseTestSummary(output);
    return {
      type: "test",
      ok: true,
      message: summary || "Tests passed",
      output: output.slice(-1000),
    };
  } catch (e) {
    const stderr = (e.stderr || "").slice(-2000);
    const stdout = (e.stdout || "").slice(-1000);
    const output = stderr || stdout || e.message;
    const summary = parseTestSummary(output);
    return {
      type: "test",
      ok: false,
      message: summary || "Tests failed",
      output,
    };
  }
}

/**
 * Parse test runner output for a human-readable summary.
 */
function parseTestSummary(output) {
  // Vitest: "Tests  3 passed (3)"  or "Tests  1 failed | 2 passed (3)"
  const vitestMatch = output.match(/Tests\s+(.+)/);
  if (vitestMatch) return `Tests: ${vitestMatch[1].trim()}`;

  // Jest: "Tests:       3 passed, 3 total"
  const jestMatch = output.match(/Tests:\s+(.+)/);
  if (jestMatch) return `Tests: ${jestMatch[1].trim()}`;

  return null;
}

// ── Dev Server Health Check ───────────────────────────────────────────

/**
 * Start dev server, hit endpoints with HTTP GET, return results.
 */
export async function runDevServerHealthCheck(cwd, config = {}) {
  const devCmd = config.devCommand || "npm run dev";
  const port = config.devServerPort || 3000;
  const endpoints = config.healthCheckEndpoints || ["/"];
  const startTimeout = config.serverStartTimeout || SERVER_START_TIMEOUT;

  console.log(`[VALIDATE] Starting dev server: ${devCmd} (port ${port})`);

  const proc = cpSpawn(devCmd, [], { cwd, shell: true, stdio: "pipe" });
  let serverOutput = "";
  proc.stdout?.on("data", (d) => { serverOutput += d.toString(); });
  proc.stderr?.on("data", (d) => { serverOutput += d.toString(); });

  try {
    // Wait for server to start
    const started = await waitForPort(port, startTimeout);
    if (!started) {
      killProcessTree(proc.pid);
      return {
        type: "healthcheck",
        ok: false,
        message: `Dev server didn't start within ${startTimeout / 1000}s`,
        output: serverOutput.slice(-500),
      };
    }

    // Hit each endpoint
    const endpointResults = [];
    for (const ep of endpoints) {
      const url = `http://localhost:${port}${ep}`;
      const res = await httpGetStatus(url);
      endpointResults.push({ url, ...res });
    }

    const allOk = endpointResults.every((r) => r.ok);
    const summary = endpointResults.map((r) => `${r.url} → ${r.status || r.error}`).join(", ");

    return {
      type: "healthcheck",
      ok: allOk,
      message: allOk ? `All endpoints healthy: ${summary}` : `Endpoint failures: ${summary}`,
      endpoints: endpointResults,
    };
  } finally {
    killProcessTree(proc.pid);
    // Wait a moment for ports to free
    await sleep(2000);
  }
}

/**
 * Poll a port until it accepts connections.
 */
function waitForPort(port, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - start > timeout) {
        clearInterval(poll);
        resolve(false);
        return;
      }
      const sock = createConnection({ port, host: "localhost" });
      sock.on("connect", () => {
        sock.destroy();
        clearInterval(poll);
        resolve(true);
      });
      sock.on("error", () => sock.destroy());
    }, 1500);
  });
}

/**
 * HTTP GET a URL and return status info.
 */
function httpGetStatus(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ ok: false, error: "timeout" }), ENDPOINT_TIMEOUT);

    httpGet(url, (res) => {
      clearTimeout(timeout);
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      res.resume(); // drain the response
      resolve({ ok, status: res.statusCode });
    }).on("error", (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });
  });
}

// ── Playwright E2E ────────────────────────────────────────────────────

/**
 * Run Playwright E2E tests.
 * If Playwright is not configured, returns needsSetup flag.
 */
export async function runPlaywrightTests(cwd, config = {}) {
  // Check if Playwright is configured
  const hasConfig = existsSync(join(cwd, "playwright.config.ts"))
    || existsSync(join(cwd, "playwright.config.js"));

  if (!hasConfig) {
    return {
      type: "e2e",
      ok: false,
      needsSetup: true,
      message: "Playwright not configured — needs setup",
    };
  }

  console.log(`[VALIDATE] Running Playwright E2E tests...`);

  try {
    const output = execSync("npx playwright test --reporter=line", {
      cwd,
      stdio: "pipe",
      timeout: config.e2eTimeout || E2E_TIMEOUT,
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });
    return { type: "e2e", ok: true, message: "E2E tests passed", output: output.slice(-1000) };
  } catch (e) {
    const stderr = (e.stderr || "").slice(-2000);
    const stdout = (e.stdout || "").slice(-1000);
    const output = stderr || stdout || e.message;
    return { type: "e2e", ok: false, message: "E2E tests failed", output };
  }
}

// ── Screenshots ───────────────────────────────────────────────────────

/**
 * Run the Playwright screenshot script if it exists.
 * The orchestrator creates scripts/screenshots.ts during the screenshots phase.
 */
export async function runScreenshots(cwd, config = {}) {
  const scriptTs = join(cwd, "scripts", "screenshots.ts");
  const scriptJs = join(cwd, "scripts", "screenshots.js");
  const hasScript = existsSync(scriptTs) || existsSync(scriptJs);

  if (!hasScript) {
    return {
      type: "screenshots",
      ok: false,
      needsSetup: true,
      message: "No screenshot script found at scripts/screenshots.ts",
    };
  }

  console.log("[VALIDATE] Running screenshot capture...");

  try {
    // Run with npx tsx for TypeScript support
    const script = existsSync(scriptTs) ? scriptTs : scriptJs;
    const runner = script.endsWith(".ts") ? "npx tsx" : "node";
    const output = execSync(`${runner} "${script}"`, {
      cwd,
      stdio: "pipe",
      timeout: config.screenshotTimeout || 120_000,
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });

    // Check if screenshots directory has files
    const ssDir = join(cwd, ".screenshots");
    if (existsSync(ssDir)) {
      const files = readdirSync(ssDir).filter((f) => f.endsWith(".png") || f.endsWith(".jpg"));
      return {
        type: "screenshots",
        ok: files.length > 0,
        message: files.length > 0
          ? `Captured ${files.length} screenshots in .screenshots/`
          : "Screenshot script ran but produced no images",
        output: output.slice(-500),
      };
    }

    return { type: "screenshots", ok: false, message: "No .screenshots/ directory created", output: output.slice(-500) };
  } catch (e) {
    return {
      type: "screenshots",
      ok: false,
      message: "Screenshot capture failed",
      output: (e.stderr || e.stdout || e.message || "").slice(-1500),
    };
  }
}

// ── Lighthouse ────────────────────────────────────────────────────────

/**
 * Run Lighthouse CI on key pages.
 * Tries the project's own script first, falls back to npx lighthouse.
 */
export async function runLighthouse(cwd, config = {}) {
  const scriptTs = join(cwd, "scripts", "lighthouse.ts");
  const scriptJs = join(cwd, "scripts", "lighthouse.js");
  const hasScript = existsSync(scriptTs) || existsSync(scriptJs);

  if (hasScript) {
    console.log("[VALIDATE] Running Lighthouse via project script...");
    try {
      const script = existsSync(scriptTs) ? scriptTs : scriptJs;
      const runner = script.endsWith(".ts") ? "npx tsx" : "node";
      const output = execSync(`${runner} "${script}"`, {
        cwd,
        stdio: "pipe",
        timeout: config.lighthouseTimeout || 180_000,
        encoding: "utf-8",
        env: { ...process.env, CI: "true" },
      });
      return { type: "lighthouse", ok: true, message: "Lighthouse audit completed", output: output.slice(-1000) };
    } catch (e) {
      return {
        type: "lighthouse",
        ok: false,
        message: "Lighthouse script failed",
        output: (e.stderr || e.stdout || e.message || "").slice(-1500),
      };
    }
  }

  // Fallback: run npx lighthouse directly against dev server
  console.log("[VALIDATE] Running Lighthouse (fallback: npx lighthouse)...");
  const port = config.devServerPort || 3000;
  const devCmd = config.devCommand || "npm run dev";

  const proc = cpSpawn(devCmd, [], { cwd, shell: true, stdio: "pipe" });

  try {
    const started = await waitForPort(port, 60_000);
    if (!started) {
      killProcessTree(proc.pid);
      return { type: "lighthouse", ok: false, message: "Dev server didn't start for Lighthouse" };
    }

    const lhDir = join(cwd, ".lighthouse");
    try {
      execSync(`npx lighthouse http://localhost:${port} --output=html --output-path="${join(lhDir, "report.html")}" --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices,seo`, {
        cwd,
        stdio: "pipe",
        timeout: 120_000,
        encoding: "utf-8",
      });
      return { type: "lighthouse", ok: true, message: "Lighthouse report saved to .lighthouse/" };
    } catch (e) {
      return {
        type: "lighthouse",
        ok: false,
        message: "Lighthouse audit failed",
        output: (e.stderr || e.message || "").slice(-1000),
      };
    }
  } finally {
    killProcessTree(proc.pid);
    await sleep(2000);
  }
}

// ── Launch Files ──────────────────────────────────────────────────────

/**
 * Verify that launch asset files were generated.
 */
function checkLaunchFiles(cwd) {
  const expectedFiles = [
    "docs/launch/product-hunt.md",
    "docs/launch/twitter-thread.md",
    "docs/launch/hacker-news.md",
    "docs/launch/LAUNCH-CHECKLIST.md",
    "docs/launch/roadmap.md",
  ];

  const found = expectedFiles.filter((f) => existsSync(join(cwd, f)));
  const missing = expectedFiles.filter((f) => !existsSync(join(cwd, f)));

  if (missing.length === 0) {
    return { type: "launch-files", ok: true, message: `All ${found.length} launch files present` };
  }

  return {
    type: "launch-files",
    ok: false,
    message: `Missing launch files: ${missing.join(", ")}`,
  };
}

// ── CI/CD Files ───────────────────────────────────────────────────────

function checkCicdFiles(cwd) {
  const expectedFiles = [
    ".github/workflows/ci.yml",
    ".env.example",
    "SETUP-GUIDE.md",
  ];

  const found = expectedFiles.filter((f) => existsSync(join(cwd, f)));
  const missing = expectedFiles.filter((f) => !existsSync(join(cwd, f)));

  if (missing.length === 0) {
    return { type: "cicd-files", ok: true, message: `CI/CD files present: ${found.join(", ")}` };
  }
  return { type: "cicd-files", ok: false, message: `Missing CI/CD files: ${missing.join(", ")}` };
}

// ── Utilities ─────────────────────────────────────────────────────────

/**
 * Kill a process and its entire tree. Critical on Windows where
 * child processes survive after killing the parent.
 */
function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (platform() === "win32") {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore", timeout: 10_000 });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch {}
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
