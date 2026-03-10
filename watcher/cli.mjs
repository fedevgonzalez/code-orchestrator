#!/usr/bin/env node
/**
 * Claude Orchestrator CLI — Multi-mode developer tool.
 *
 * Commands:
 *   node cli.mjs build <spec.md>                Build project from spec (0→100)
 *   node cli.mjs feature "add dark mode"        Add a feature
 *   node cli.mjs fix "login is broken"          Fix a bug
 *   node cli.mjs audit [--type security]        Code audit
 *   node cli.mjs test [--fix]                   Run/generate tests, fix failures
 *   node cli.mjs review                         Full code review
 *   node cli.mjs refactor "extract auth service" Refactoring
 *   node cli.mjs exec "do something"            Generic prompt
 *
 * Management:
 *   node cli.mjs --status                       All running instances
 *   node cli.mjs --logs [name]                  View logs
 *   node cli.mjs --stop [name]                  Stop instance
 *   node cli.mjs --stop-all                     Stop everything
 *   node cli.mjs --restart [name]               Restart instance
 *   node cli.mjs --resume <project-dir>         Resume from checkpoint
 */

import { resolve, dirname, basename } from "path";
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawArgs = process.argv.slice(2);

// ── Management commands (flags) ─────────────────────────────────────────

if (rawArgs.includes("--status")) {
  run("npx pm2 status");
  process.exit(0);
}

if (rawArgs.includes("--stop-all")) {
  run("npx pm2 delete all");
  process.exit(0);
}

if (rawArgs.includes("--stop")) {
  const name = getArgAfter("--stop");
  if (!name) { console.error("Usage: node cli.mjs --stop <name>"); process.exit(1); }
  run(`npx pm2 stop ${name.startsWith("orch-") ? name : "orch-" + name}`);
  process.exit(0);
}

if (rawArgs.includes("--logs")) {
  const name = getArgAfter("--logs");
  if (name) {
    run(`npx pm2 logs ${name.startsWith("orch-") ? name : "orch-" + name} --lines 100`);
  } else {
    run("npx pm2 logs --lines 50");
  }
  process.exit(0);
}

if (rawArgs.includes("--restart")) {
  const name = getArgAfter("--restart");
  if (!name) { console.error("Usage: node cli.mjs --restart <name>"); process.exit(1); }
  run(`npx pm2 restart ${name.startsWith("orch-") ? name : "orch-" + name}`);
  process.exit(0);
}

if (rawArgs.includes("--resume")) {
  const cwdArg = getArgAfter("--resume");
  if (!cwdArg || !existsSync(cwdArg)) {
    console.error("Usage: node cli.mjs --resume <project-dir>");
    process.exit(1);
  }
  startDaemon({ cwd: resolve(cwdArg), mode: "build", resume: true });
  process.exit(0);
}

// ── Parse subcommand ────────────────────────────────────────────────────

const MODES = ["build", "feature", "fix", "audit", "test", "review", "refactor", "exec"];
const positionalArgs = rawArgs.filter(a => !a.startsWith("--"));
const firstArg = positionalArgs[0];

// No args → show help
if (!firstArg) {
  showHelp();
  process.exit(0);
}

// Backwards compat: if first arg is a .md file, treat as "build <spec>"
if (firstArg.endsWith(".md")) {
  const specPath = resolve(firstArg);
  if (!existsSync(specPath)) {
    console.error(`Error: spec file not found: ${specPath}`);
    process.exit(1);
  }
  startDaemon({ cwd: dirname(specPath), mode: "build", specPath });
  process.exit(0);
}

// Detect mode
const mode = MODES.includes(firstArg) ? firstArg : "exec";
const promptParts = mode === firstArg ? positionalArgs.slice(1) : positionalArgs;

// Build mode requires a spec file
if (mode === "build") {
  const specArg = promptParts[0];
  if (!specArg) {
    console.error("Usage: node cli.mjs build <spec.md>");
    process.exit(1);
  }
  const specPath = resolve(specArg);
  if (!existsSync(specPath)) {
    console.error(`Error: spec file not found: ${specPath}`);
    process.exit(1);
  }
  startDaemon({ cwd: dirname(specPath), mode: "build", specPath });
  process.exit(0);
}

// All other modes need --cwd or current directory
const cwdArg = getArgAfter("--cwd");
const cwd = cwdArg ? resolve(cwdArg) : process.cwd();

if (!existsSync(cwd)) {
  console.error(`Error: directory not found: ${cwd}`);
  process.exit(1);
}

// Assemble prompt from remaining positional args
const prompt = promptParts.join(" ").trim() || getDefaultPrompt(mode);

// Collect extra flags
const flags = {};
if (rawArgs.includes("--type") || rawArgs.includes("--audit-type")) {
  flags.type = getArgAfter("--type") || getArgAfter("--audit-type") || "full";
}
if (rawArgs.includes("--fix")) {
  flags.fix = true;
}

startDaemon({ cwd, mode, prompt, flags });

// ── Functions ────────────────────────────────────────────────────────────

function startDaemon({ cwd, mode, specPath, prompt, flags, resume }) {
  const watcherScript = resolve(__dirname, "watcher.mjs");
  const name = instanceName(cwd);

  const port = 3111 + Math.abs(simpleHash(name)) % 89;

  const devPortArg = getArgAfter("--dev-port");
  const computedDevPort = 3000 + Math.abs(simpleHash(name)) % 100;
  let devPort;
  if (devPortArg) {
    devPort = parseInt(devPortArg, 10);
    if (Number.isNaN(devPort)) devPort = computedDevPort;
  } else {
    const savedPortFile = resolve(cwd, ".orchestrator", "dev-port");
    if (existsSync(savedPortFile)) {
      devPort = parseInt(readFileSync(savedPortFile, "utf-8").trim(), 10);
      if (Number.isNaN(devPort)) devPort = computedDevPort;
    } else {
      devPort = computedDevPort;
    }
  }

  let watcherArgs = `--cwd "${cwd}" --port ${port} --dev-port ${devPort} --verbose --mode ${mode}`;

  if (resume) {
    watcherArgs += " --resume";
  } else if (specPath) {
    watcherArgs += ` --spec "${specPath}"`;
  }

  if (prompt) {
    watcherArgs += ` --prompt "${shellEscape(prompt)}"`;
  }

  if (flags?.type) watcherArgs += ` --audit-type ${flags.type}`;
  if (flags?.fix) watcherArgs += " --fix";

  // Stop existing instance
  try { execSync(`npx pm2 delete ${name}`, { stdio: "ignore" }); } catch {}

  const pm2Cmd = `npx pm2 start "${watcherScript}" --name ${name} --interpreter node -- ${watcherArgs}`;

  const modeLabel = mode === "build" ? "BUILD (from spec)" : mode.toUpperCase();

  console.log("");
  console.log("┌──────────────────────────────────────────────────────────┐");
  console.log(`│  CLAUDE ORCHESTRATOR — ${modeLabel.padEnd(35)}│`);
  console.log("└──────────────────────────────────────────────────────────┘");
  console.log(`  Instance:  ${name}`);
  console.log(`  Project:   ${cwd}`);
  console.log(`  Mode:      ${mode}`);
  if (specPath) console.log(`  Spec:      ${specPath}`);
  if (prompt) console.log(`  Prompt:    ${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}`);
  if (resume) console.log(`  Resume:    from checkpoint`);
  if (flags?.type) console.log(`  Type:      ${flags.type}`);
  console.log(`  Dashboard: http://localhost:${port}`);
  console.log(`  Dev port:  ${devPort}`);
  console.log("");

  run(pm2Cmd);

  console.log("");
  console.log("  Running in background. You can close this terminal.");
  console.log("");
  console.log("  Commands:");
  console.log(`    node cli.mjs --logs ${basename(cwd)}       View progress`);
  console.log(`    node cli.mjs --status              All instances`);
  console.log(`    node cli.mjs --stop ${basename(cwd)}       Stop this project`);
  console.log("");
}

function getDefaultPrompt(mode) {
  const defaults = {
    audit: "Full code audit: security, performance, quality, accessibility",
    test: "Run all tests, analyze failures, generate missing tests, fix issues",
    review: "Full comprehensive code review: architecture, quality, security, performance",
    feature: "",
    fix: "",
    refactor: "",
    exec: "",
  };
  return defaults[mode] || "";
}

function instanceName(cwd) {
  return "orch-" + basename(resolve(cwd));
}

function getArgAfter(flag) {
  const idx = rawArgs.indexOf(flag);
  const next = rawArgs[idx + 1];
  return next && !next.startsWith("--") ? next : null;
}

function shellEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function run(cmd) {
  try { execSync(cmd, { cwd: __dirname, stdio: "inherit" }); } catch {}
}

function showHelp() {
  console.log(`
  Claude Orchestrator — Multi-mode Developer Tool

  Build (0→100 from spec):
    node cli.mjs build <spec.md>                       Full project from spec
    node cli.mjs <spec.md>                             (shorthand)

  Develop:
    node cli.mjs feature "add dark mode" --cwd .       Add a feature
    node cli.mjs fix "login button broken" --cwd .     Fix a bug
    node cli.mjs refactor "extract auth service"       Refactoring

  Quality:
    node cli.mjs audit --cwd . [--type security]       Code audit
    node cli.mjs audit --fix --cwd .                   Audit + auto-fix
    node cli.mjs test --cwd . [--fix]                  Run tests, fix failures
    node cli.mjs review --cwd .                        Full code review

  Generic:
    node cli.mjs exec "do something" --cwd .           Any prompt

  Resume & Monitor:
    node cli.mjs --resume <project-dir>                Resume from checkpoint
    node cli.mjs --status                              All running instances
    node cli.mjs --logs [name]                         View logs
    node cli.mjs --stop [name]                         Stop instance
    node cli.mjs --stop-all                            Stop everything
    node cli.mjs --restart [name]                      Restart instance

  Options:
    --cwd <dir>        Project directory (default: current)
    --dev-port <port>  Dev server port
    --type <type>      Audit type: security, performance, quality, a11y, full
    --fix              Auto-fix issues (audit/test modes)
    --no-review        Skip code review step

  Examples:
    node cli.mjs build G:/projects/my-saas/spec.md
    node cli.mjs feature "add Stripe billing" --cwd G:/projects/my-saas
    node cli.mjs fix "users can't reset password" --cwd .
    node cli.mjs audit --type security --cwd G:/projects/my-saas
    node cli.mjs test --fix --cwd .
    node cli.mjs review --cwd G:/projects/my-saas
    node cli.mjs refactor "split monolith into modules" --cwd .
    node cli.mjs exec "update all deps and fix breaking changes" --cwd .
  `);
}
