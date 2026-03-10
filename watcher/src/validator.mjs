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
  // Reject commands with shell metacharacters that could enable injection
  if (/[;&|`$()]/.test(cmd) && !cmd.startsWith("npm ") && !cmd.startsWith("npx ")) {
    return { ok: false, message: `Command rejected — contains shell metacharacters: ${cmd.slice(0, 80)}` };
  }
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
  "scaffold":      ["env-check", "build"],
  "database":      ["env-check", "db-connect", "build"],
  "auth":          ["env-check", "db-connect", "build"],
  "core-api":      ["build"],
  "payments":      ["build"],
  "frontend":      ["build"],
  "onboarding":    ["build", "onboarding-files"],
  "integration":   ["build", "healthcheck"],
  "ux-polish":     ["build"],
  "nextspark-polish": ["build"],
  "seed-data":     ["build", "seed-files"],
  "landing":       ["build"],
  "seo":           ["build", "seo-files"],
  "legal":         ["build", "legal-files"],
  "email":         ["build", "email-files"],
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
export async function runPhaseValidation(phaseId, cwd, config = {}, pluginRegistry = null) {
  // Normalize phase ID: "Project Scaffolding" -> "scaffold", "Core API & Business Logic" -> "core-api"
  const normalizedId = normalizePhaseId(phaseId);
  const builtinValidators = PHASE_VALIDATORS[normalizedId] || [];
  const pluginValidators = pluginRegistry?.getPhaseValidators(normalizedId) || [];
  const validators = [...builtinValidators, ...pluginValidators];

  if (validators.length === 0) {
    console.log(`[VALIDATE] No validators mapped for phase: ${phaseId} (normalized: ${normalizedId})`);
    return { ok: true, results: [] };
  }

  console.log(`[VALIDATE] Phase "${phaseId}" → running: ${validators.join(", ")}`);
  const results = [];

  for (const v of validators) {
    // Check if this is a plugin-registered validator
    if (pluginRegistry?.hasValidator(v)) {
      const result = await pluginRegistry.runValidator(v, cwd, config);
      results.push(result);
      console.log(`[VALIDATE]   ${result.type}: ${result.ok ? "PASS" : "FAIL"} — ${result.message}`);
      continue;
    }

    let result;
    switch (v) {
      case "env-check":
        result = checkEnvFile(cwd);
        break;
      case "db-connect":
        result = await checkDbConnection(cwd);
        break;
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
      case "seo-files":
        result = checkSeoFiles(cwd);
        break;
      case "legal-files":
        result = checkLegalFiles(cwd);
        break;
      case "onboarding-files":
        result = checkOnboardingFiles(cwd);
        break;
      case "email-files":
        result = checkEmailFiles(cwd);
        break;
      case "seed-files":
        result = checkSeedFiles(cwd);
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
 * Auto-detect the build command based on project ecosystem.
 */
function detectBuildCommand(cwd) {
  if (existsSync(join(cwd, "package.json"))) return "npm run build";
  if (existsSync(join(cwd, "Cargo.toml"))) return "cargo build";
  if (existsSync(join(cwd, "go.mod"))) return "go build ./...";
  if (existsSync(join(cwd, "pom.xml"))) return "mvn compile";
  if (existsSync(join(cwd, "build.gradle")) || existsSync(join(cwd, "build.gradle.kts"))) return "./gradlew build";
  if (existsSync(join(cwd, "Gemfile"))) return "bundle exec rake";
  if (existsSync(join(cwd, "composer.json"))) return "composer install --no-dev";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "setup.py"))) return "python -m py_compile $(find . -name '*.py' -not -path './venv/*' | head -20)";
  return "npm run build"; // fallback
}

/**
 * Auto-detect the test command based on project ecosystem.
 */
function detectTestCommand(cwd) {
  if (existsSync(join(cwd, "package.json"))) return "npm test";
  if (existsSync(join(cwd, "Cargo.toml"))) return "cargo test";
  if (existsSync(join(cwd, "go.mod"))) return "go test ./...";
  if (existsSync(join(cwd, "pom.xml"))) return "mvn test";
  if (existsSync(join(cwd, "build.gradle")) || existsSync(join(cwd, "build.gradle.kts"))) return "./gradlew test";
  if (existsSync(join(cwd, "Gemfile"))) return "bundle exec rspec";
  if (existsSync(join(cwd, "composer.json"))) return "vendor/bin/phpunit";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "requirements.txt"))) return "python -m pytest";
  return "npm test"; // fallback
}

/**
 * Run build and return the result.
 * Auto-detects the build command if not configured.
 */
export function runBuild(cwd, config = {}) {
  const cmd = config.buildCommand || detectBuildCommand(cwd);
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
  // Check if there's a real test script (Node.js projects)
  if (existsSync(join(cwd, "package.json"))) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
      const testScript = pkg.scripts?.test || "";
      if (!testScript || testScript.includes("no test specified")) {
        return { type: "test", ok: true, message: "No test script configured, skipping" };
      }
    } catch {
      return { type: "test", ok: true, message: "Could not read package.json, skipping tests" };
    }
  }

  const cmd = config.testCommand || detectTestCommand(cwd);
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

// ── Env File Validation ───────────────────────────────────────────

/**
 * Validate that .env has real credentials, not placeholders.
 * Checks DATABASE_URL and BETTER_AUTH_SECRET specifically.
 */
function checkEnvFile(cwd) {
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) {
    return { type: "env-check", ok: false, message: "No .env file found" };
  }

  const content = readFileSync(envPath, "utf-8");
  const issues = [];

  // Check DATABASE_URL
  const dbMatch = content.match(/DATABASE_URL="?([^"\n]+)"?/);
  if (!dbMatch) {
    issues.push("DATABASE_URL not set");
  } else {
    const dbUrl = dbMatch[1];
    if (dbUrl.includes("user:password") || dbUrl.includes("username:password")) {
      issues.push("DATABASE_URL has placeholder credentials (user:password)");
    }
  }

  // Check BETTER_AUTH_SECRET
  const authMatch = content.match(/BETTER_AUTH_SECRET="?([^"\n]+)"?/);
  if (authMatch) {
    const secret = authMatch[1];
    if (secret === "your-secret-key-here" || secret.includes("your-") || secret.includes("change-me")) {
      issues.push("BETTER_AUTH_SECRET is a placeholder — must be generated (openssl rand -base64 32)");
    }
  }

  if (issues.length > 0) {
    return {
      type: "env-check",
      ok: false,
      message: `Env issues: ${issues.join("; ")}`,
      fixPrompt: buildEnvFixPrompt(issues, cwd),
    };
  }

  return { type: "env-check", ok: true, message: "Env file has valid credentials" };
}

/**
 * Build a prompt that tells Claude exactly how to fix the .env
 */
function buildEnvFixPrompt(issues, cwd) {
  const lines = ["Fix the .env file. The following issues were detected:\n"];
  for (const issue of issues) {
    lines.push(`- ${issue}`);
  }
  lines.push("\nREQUIRED VALUES:");
  lines.push('- DATABASE_URL must be a valid PostgreSQL connection string (e.g., postgresql://user:pass@localhost:5432/mydb)');
  lines.push('- BETTER_AUTH_SECRET must be a real random secret. Generate one with: openssl rand -base64 32');
  lines.push("- Do NOT use placeholders like 'your-secret-here' or 'user:password'");
  lines.push("\nUpdate the .env file NOW with the correct values.");
  return lines.join("\n");
}

// ── Database Connection Check ─────────────────────────────────────

/**
 * Try to connect to the database using the DATABASE_URL from .env.
 * Uses a simple TCP connection check to postgres port, then tries
 * a real query via node-postgres if available.
 */
async function checkDbConnection(cwd) {
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) {
    return { type: "db-connect", ok: false, message: "No .env file — cannot check DB" };
  }

  const content = readFileSync(envPath, "utf-8");
  const dbMatch = content.match(/DATABASE_URL="?([^"\n]+)"?/);
  if (!dbMatch) {
    return { type: "db-connect", ok: false, message: "DATABASE_URL not found in .env" };
  }

  const dbUrl = dbMatch[1];

  // Parse host and port from DATABASE_URL
  let host, port;
  try {
    const url = new URL(dbUrl);
    host = url.hostname;
    port = parseInt(url.port) || 5432;
  } catch {
    return { type: "db-connect", ok: false, message: `Invalid DATABASE_URL format: ${dbUrl.slice(0, 50)}...` };
  }

  // TCP connection check
  console.log(`[VALIDATE] Checking DB connection to ${host}:${port}...`);

  const tcpOk = await new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const timeout = setTimeout(() => { sock.destroy(); resolve(false); }, 5000);
    sock.on("connect", () => { clearTimeout(timeout); sock.destroy(); resolve(true); });
    sock.on("error", () => { clearTimeout(timeout); sock.destroy(); resolve(false); });
  });

  if (!tcpOk) {
    return {
      type: "db-connect",
      ok: false,
      message: `Cannot reach database at ${host}:${port}`,
      fixPrompt: `The database at ${host}:${port} is not reachable. Check that:\n1. PostgreSQL is running on that host\n2. Port ${port} is accessible\n3. The hostname resolves correctly\n\nUpdate DATABASE_URL in .env to point to a reachable PostgreSQL instance.`,
    };
  }

  // Try a real connection via pg to verify auth works
  // Uses execFileSync with env var to avoid command injection via DATABASE_URL
  try {
    execSync(`node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.__DB_URL,connectionTimeoutMillis:5000});await c.connect();await c.query('SELECT 1');await c.end();console.log('OK')})()"`, {
      cwd,
      stdio: "pipe",
      timeout: 10_000,
      encoding: "utf-8",
      env: { ...process.env, __DB_URL: dbUrl },
    });
    return { type: "db-connect", ok: true, message: `Database connected successfully (${host}:${port})` };
  } catch (e) {
    // pg might not be installed in the project yet — TCP was fine, so partial pass
    if (e.message?.includes("Cannot find module")) {
      return { type: "db-connect", ok: true, message: `Database reachable at ${host}:${port} (pg module not yet installed for full auth check)` };
    }
    const errMsg = (e.stderr || e.message || "").slice(-200);
    return {
      type: "db-connect",
      ok: false,
      message: `Database TCP reachable but auth/query failed: ${errMsg}`,
      fixPrompt: `Database at ${host}:${port} is reachable but the connection failed. Check credentials in DATABASE_URL. Expected format: postgresql://user:password@host:5432/dbname`,
    };
  }
}

// ── SEO Files Check ───────────────────────────────────────────────

function checkSeoFiles(cwd) {
  const checks = [
    { path: "app/robots.ts", alt: "public/robots.txt" },
    { path: "app/sitemap.ts", alt: "public/sitemap.xml" },
    { path: "app/manifest.ts", alt: "public/manifest.json" },
  ];

  const missing = [];
  for (const c of checks) {
    if (!existsSync(join(cwd, c.path)) && !existsSync(join(cwd, c.alt))) {
      missing.push(c.path);
    }
  }

  if (missing.length === 0) {
    return { type: "seo-files", ok: true, message: "SEO files present (robots, sitemap, manifest)" };
  }
  return { type: "seo-files", ok: false, message: `Missing SEO files: ${missing.join(", ")}` };
}

// ── Legal Files Check ─────────────────────────────────────────────

function checkLegalFiles(cwd) {
  // Check for legal pages in various possible locations
  const possiblePaths = [
    ["app/(public)/terms/page.tsx", "app/(public)/legal/terms/page.tsx", "app/terms/page.tsx"],
    ["app/(public)/privacy/page.tsx", "app/(public)/legal/privacy/page.tsx", "app/privacy/page.tsx"],
  ];

  const labels = ["Terms of Service", "Privacy Policy"];
  const missing = [];

  for (let i = 0; i < possiblePaths.length; i++) {
    const found = possiblePaths[i].some((p) => existsSync(join(cwd, p)));
    if (!found) missing.push(labels[i]);
  }

  if (missing.length === 0) {
    return { type: "legal-files", ok: true, message: "Legal pages present (terms, privacy)" };
  }
  return { type: "legal-files", ok: false, message: `Missing legal pages: ${missing.join(", ")}` };
}

// ── Onboarding Files Check ────────────────────────────────────────

/**
 * Verify onboarding/walkme files were created.
 * Checks for tour definitions, provider, and selectors.
 */
function checkOnboardingFiles(cwd) {
  // Search in multiple possible locations
  const searchDirs = ["contents/themes", "src", "app", "lib"];
  let found = [];

  for (const dir of searchDirs) {
    const fullDir = join(cwd, dir);
    if (!existsSync(fullDir)) continue;
    try {
      const files = findFilesRecursive(fullDir, (f) =>
        f.includes("onboarding") || f.includes("walkme") || f.includes("tours") || f.includes("tour")
      );
      found.push(...files);
    } catch (e) {
      console.log(`[VALIDATE] Error scanning ${dir} for onboarding files: ${e.message}`);
    }
  }

  // Also check for walkme plugin
  const walkmePlugin = join(cwd, "contents", "plugins", "walkme");
  if (existsSync(walkmePlugin)) found.push(walkmePlugin);

  if (found.length >= 2) {
    return { type: "onboarding-files", ok: true, message: `Onboarding files found (${found.length} files)` };
  }

  return {
    type: "onboarding-files",
    ok: false,
    message: `Onboarding not implemented — found only ${found.length} related files`,
    fixPrompt: `The onboarding/walkme system was not implemented. You MUST create:
1. Install walkme plugin: pnpm add @nextsparkjs/plugin-walkme, register in theme config
2. Create onboarding files in contents/themes/{theme}/onboarding/:
   - tours.ts — Tour definitions (getting-started tour + contextual tooltips)
   - selectors.ts — TOUR_TARGETS mapping semantic names to data-cy selectors
   - OnboardingProvider.tsx — Wraps WalkmeProvider, registers tours
   - OnboardingWrapper.tsx — Layout wrapper with provider + resume banner
   - index.ts — Exports
3. Add the OnboardingWrapper to the dashboard layout
4. Create at least a "getting-started" multi-step tour`,
  };
}

// ── Email Files Check ─────────────────────────────────────────────

/**
 * Verify email templates were created.
 */
function checkEmailFiles(cwd) {
  const searchDirs = ["src/emails", "emails", "lib/emails", "app/emails", "contents"];
  let found = [];

  for (const dir of searchDirs) {
    const fullDir = join(cwd, dir);
    if (!existsSync(fullDir)) continue;
    try {
      const files = findFilesRecursive(fullDir, (f) =>
        f.includes("email") && (f.endsWith(".tsx") || f.endsWith(".ts"))
      );
      found.push(...files);
    } catch (e) {
      console.log(`[VALIDATE] Error scanning ${dir} for email files: ${e.message}`);
    }
  }

  // Also check for email utility
  const emailUtil = ["src/lib/email.ts", "lib/email.ts", "utils/email.ts", "src/utils/email.ts"];
  for (const p of emailUtil) {
    if (existsSync(join(cwd, p))) found.push(p);
  }

  if (found.length >= 2) {
    return { type: "email-files", ok: true, message: `Email templates found (${found.length} files)` };
  }

  return {
    type: "email-files",
    ok: false,
    message: `Email templates not implemented — found only ${found.length} related files`,
    fixPrompt: `Email templates were not created. You MUST create:
1. Email templates using React Email or plain HTML in src/emails/ (or similar):
   - welcome.tsx — Welcome email after signup
   - password-reset.tsx — Password reset email
   - invoice.tsx — Payment receipt/invoice
2. Email sending utility at src/lib/email.ts (using Resend: RESEND_API_KEY from .env)
3. Add RESEND_API_KEY to .env.example with a comment

Create at least 2 email templates and the sending utility.`,
  };
}

// ── Seed Files Check ──────────────────────────────────────────────

/**
 * Verify seed script was created.
 */
function checkSeedFiles(cwd) {
  const possiblePaths = [
    "scripts/seed.ts", "scripts/seed.js", "scripts/seed.mjs",
    "src/lib/seed.ts", "src/lib/seed.js",
    "prisma/seed.ts", "prisma/seed.js",
    "drizzle/seed.ts", "drizzle/seed.js",
    "db/seed.ts", "db/seed.js",
  ];

  const found = possiblePaths.filter((p) => existsSync(join(cwd, p)));

  // Also check package.json for seed script
  let hasSeedScript = false;
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
    hasSeedScript = !!(pkg.scripts?.seed || pkg.scripts?.["db:seed"]);
  } catch { /* no package.json */ }

  if (found.length > 0 || hasSeedScript) {
    return { type: "seed-files", ok: true, message: `Seed data found: ${found.join(", ") || "via package.json script"}` };
  }

  return {
    type: "seed-files",
    ok: false,
    message: "No seed script found",
    fixPrompt: `No seed data script was created. You MUST create:
1. A seed script at scripts/seed.ts with realistic demo data:
   - Use real-sounding names (NOT "John Doe" or "test@test.com")
   - Include 15-30 records per entity with varied statuses and dates
   - Make it idempotent (safe to run multiple times — upsert or check before insert)
2. Add "seed" or "db:seed" script to package.json that runs the seed file
3. The seed should use the DATABASE_URL from .env to connect to the database`,
  };
}

// ── File search helper ────────────────────────────────────────────

/**
 * Recursively find files matching a filter function.
 */
function findFilesRecursive(dir, filterFn, maxDepth = 5, depth = 0) {
  if (depth >= maxDepth) return [];
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFilesRecursive(full, filterFn, maxDepth, depth + 1));
      } else if (filterFn(entry.name)) {
        results.push(full);
      }
    }
  } catch { /* permission denied or unreadable dir */ }
  return results;
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
  } catch { /* process already exited */ }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
