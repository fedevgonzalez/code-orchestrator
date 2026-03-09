#!/usr/bin/env node
/**
 * Claude Orchestrator CLI
 *
 * Usage:
 *   node cli.mjs G:/GitHub/nextspark/projects/petcare/spec.md
 *   node cli.mjs G:/GitHub/nextspark/projects/remis/spec.md
 *   node cli.mjs --logs petcare
 *   node cli.mjs --logs remis
 *   node cli.mjs --logs              (all)
 *   node cli.mjs --stop petcare
 *   node cli.mjs --stop-all
 *   node cli.mjs --status
 *   node cli.mjs --resume G:/GitHub/nextspark/projects/petcare
 */

import { resolve, dirname, basename } from "path";
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

/**
 * Derive a PM2 instance name from a project folder.
 * G:/GitHub/nextspark/projects/petcare → "orch-petcare"
 */
function instanceName(cwd) {
  return "orch-" + basename(resolve(cwd));
}

// ── --status: show all instances ──────────────────────────────────────

if (args.includes("--status")) {
  run("npx pm2 status");
  process.exit(0);
}

// ── --stop-all ────────────────────────────────────────────────────────

if (args.includes("--stop-all")) {
  run("npx pm2 delete all");
  process.exit(0);
}

// ── --stop <name> ─────────────────────────────────────────────────────

if (args.includes("--stop")) {
  const name = getArgAfter("--stop");
  if (!name) {
    console.error("Usage: node cli.mjs --stop petcare");
    console.error("       node cli.mjs --stop-all");
    process.exit(1);
  }
  const pmName = name.startsWith("orch-") ? name : "orch-" + name;
  run(`npx pm2 stop ${pmName}`);
  process.exit(0);
}

// ── --logs [name] ─────────────────────────────────────────────────────

if (args.includes("--logs")) {
  const name = getArgAfter("--logs");
  if (name) {
    const pmName = name.startsWith("orch-") ? name : "orch-" + name;
    run(`npx pm2 logs ${pmName} --lines 100`);
  } else {
    // All logs
    run("npx pm2 logs --lines 50");
  }
  process.exit(0);
}

// ── --restart <name> ──────────────────────────────────────────────────

if (args.includes("--restart")) {
  const name = getArgAfter("--restart");
  if (!name) {
    console.error("Usage: node cli.mjs --restart petcare");
    process.exit(1);
  }
  const pmName = name.startsWith("orch-") ? name : "orch-" + name;
  run(`npx pm2 restart ${pmName}`);
  process.exit(0);
}

// ── --resume <project-dir> ───────────────────────────────────────────

if (args.includes("--resume")) {
  const cwdArg = getArgAfter("--resume");
  if (!cwdArg || !existsSync(cwdArg)) {
    console.error("Usage: node cli.mjs --resume G:/GitHub/mi-proyecto");
    process.exit(1);
  }
  const cwd = resolve(cwdArg);
  startDaemon(cwd, null, true);
  process.exit(0);
}

// ── Main: spec path ───────────────────────────────────────────────────

const specArg = args.find((a) => !a.startsWith("--"));

if (!specArg) {
  console.log(`
  Claude Orchestrator — Autonomous SaaS Builder

  Start:
    node cli.mjs <spec.md>                 Build project from spec
    node cli.mjs <spec.md> --dev-port 3001 Custom dev server port
    node cli.mjs --resume <project-dir>    Resume from checkpoint

  Monitor:
    node cli.mjs --status                  All running instances
    node cli.mjs --logs petcare            Logs for petcare
    node cli.mjs --logs                    All logs

  Control:
    node cli.mjs --stop petcare            Stop one project
    node cli.mjs --stop-all                Stop everything
    node cli.mjs --restart petcare         Restart one project

  Examples:
    node cli.mjs G:/GitHub/nextspark/projects/petcare/spec.md
    node cli.mjs G:/GitHub/nextspark/projects/remis/spec.md
    node cli.mjs --logs petcare
    node cli.mjs --logs remis
  `);
  process.exit(0);
}

const specPath = resolve(specArg);

if (!existsSync(specPath)) {
  console.error(`Error: spec file not found: ${specPath}`);
  process.exit(1);
}

const cwd = dirname(specPath);
startDaemon(cwd, specPath, false);

// ── Functions ─────────────────────────────────────────────────────────

function startDaemon(cwd, specPath, resume) {
  const watcherScript = resolve(__dirname, "watcher.mjs");
  const name = instanceName(cwd);

  // Each project gets its own dashboard port: hash the name to a port 3111-3199
  const port = 3111 + Math.abs(simpleHash(name)) % 89;

  // Dev server port: use --dev-port if provided, then try saved dev-port file, fallback to hash
  const devPortArg = getArgAfter("--dev-port");
  let devPort;
  if (devPortArg) {
    devPort = parseInt(devPortArg, 10);
  } else {
    const savedPortFile = resolve(cwd, ".orchestrator", "dev-port");
    if (existsSync(savedPortFile)) {
      devPort = parseInt(readFileSync(savedPortFile, "utf-8").trim(), 10);
    } else {
      devPort = 3000 + Math.abs(simpleHash(name)) % 100;
    }
  }

  let watcherArgs = `--cwd "${cwd}" --port ${port} --dev-port ${devPort} --verbose`;
  if (resume) {
    watcherArgs += " --resume";
  } else {
    watcherArgs += ` --spec "${specPath}"`;
  }

  // Stop existing instance of same project (if any)
  try {
    execSync(`npx pm2 delete ${name}`, { stdio: "ignore" });
  } catch {}

  const pm2Cmd = `npx pm2 start "${watcherScript}" --name ${name} --interpreter node -- ${watcherArgs}`;

  console.log("");
  console.log("┌──────────────────────────────────────────────────────────┐");
  console.log("│          CLAUDE ORCHESTRATOR — Starting...               │");
  console.log("└──────────────────────────────────────────────────────────┘");
  console.log(`  Instance:  ${name}`);
  console.log(`  Project:   ${cwd}`);
  if (specPath) console.log(`  Spec:      ${specPath}`);
  if (resume) console.log(`  Mode:      RESUME from checkpoint`);
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
  console.log(`    node cli.mjs --stop-all             Stop everything`);
  console.log("");
}

function getArgAfter(flag) {
  const idx = args.indexOf(flag);
  const next = args[idx + 1];
  return next && !next.startsWith("--") ? next : null;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function run(cmd) {
  try {
    execSync(cmd, { cwd: __dirname, stdio: "inherit" });
  } catch {}
}
