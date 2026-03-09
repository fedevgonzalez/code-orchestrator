#!/usr/bin/env node
/**
 * Claude Orchestrator — Main Entry Point
 *
 * Runs the orchestration engine directly in Node.js (no Python).
 *   1. Parses CLI args
 *   2. Starts the Orchestrator engine (PTY + JSONL + build/review loop)
 *   3. Exposes WebSocket + HTTP API for real-time monitoring
 *   4. Serves the dashboard UI
 *   5. Auto-restarts engine on crash with --resume
 *
 * Usage:
 *   node watcher.mjs --cwd /path/to/project --spec spec.md
 *   node watcher.mjs --cwd /path/to/project --resume
 */

import { createServer } from "http";
import { WebSocketServer } from "ws";
import { existsSync, readFileSync, mkdirSync, appendFileSync, writeFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { parseArgs } from "util";
import { fileURLToPath } from "url";
import { Orchestrator } from "./src/orchestrator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    cwd: { type: "string", default: "." },
    port: { type: "string", default: "3111" },
    "dev-port": { type: "string", default: "3000" },
    verbose: { type: "boolean", default: false },
    spec: { type: "string" },
    resume: { type: "boolean", default: false },
    "no-review": { type: "boolean", default: false },
    "max-restarts": { type: "string", default: "5" },
  },
});

const PROJECT_CWD = resolve(args.cwd);
const PORT = parseInt(args.port, 10);
const DEV_PORT = parseInt(args["dev-port"], 10);
const VERBOSE = args.verbose;
const MAX_RESTARTS = parseInt(args["max-restarts"], 10);

// ── Persistent logging ────────────────────────────────────────────────────

function ensureLogDir(cwd) {
  const logDir = join(cwd, ".orchestrator", "logs");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  return logDir;
}

const LOG_DIR = ensureLogDir(PROJECT_CWD);

function logToFile(message) {
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(join(LOG_DIR, "supervisor.log"), `[${timestamp}] ${message}\n`);
  } catch {}
}

// Wrap console to also log to file (for PM2 daemon mode)
const _origLog = console.log;
const _origErr = console.error;
console.log = (...a) => { _origLog(...a); logToFile(a.join(" ")); };
console.error = (...a) => { _origErr(...a); logToFile(`[ERROR] ${a.join(" ")}`); };

// ── Global state for dashboard ────────────────────────────────────────────

const state = {
  orchestrator: {
    status: "stopped",  // stopped | running | completed | crashed | restarting
    startedAt: null,
    restarts: 0,
    lastCrashAt: null,
    currentPhase: null,
    currentTask: null,
    lastLog: [],        // last 200 log lines
  },
  startedAt: Date.now(),
};

function pushLog(text) {
  state.orchestrator.lastLog.push({ time: new Date().toISOString(), text });
  if (state.orchestrator.lastLog.length > 200) {
    state.orchestrator.lastLog = state.orchestrator.lastLog.slice(-200);
  }
  broadcast({ type: "log", text, timestamp: Date.now() });
}

// ── WebSocket ─────────────────────────────────────────────────────────────

const clients = new Set();

function broadcast(event) {
  const msg = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  // Serve dashboard HTML
  if (req.url === "/" && req.method === "GET") {
    const dashboardPath = join(__dirname, "..", "dashboard", "static", "index.html");
    if (existsSync(dashboardPath)) {
      res.writeHead(200, { ...headers, "Content-Type": "text/html" });
      res.end(readFileSync(dashboardPath, "utf-8"));
      return;
    }
  }

  res.setHeader("Content-Type", "application/json");
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      uptime_s: Math.floor((Date.now() - state.startedAt) / 1000),
      orchestrator_status: state.orchestrator.status,
      orchestrator_restarts: state.orchestrator.restarts,
    }));
    return;
  }

  if (req.url === "/state" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({
      orchestrator: state.orchestrator,
      project_cwd: PROJECT_CWD,
    }));
    return;
  }

  if (req.url === "/logs" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({ logs: state.orchestrator.lastLog }));
    return;
  }

  if (req.url === "/restart" && req.method === "POST") {
    if (currentOrchestrator) currentOrchestrator.stop();
    state.orchestrator.restarts = 0;
    setTimeout(() => startOrchestrator(true), 2000);
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, action: "restarting" }));
    return;
  }

  if (req.url === "/stop" && req.method === "POST") {
    if (currentOrchestrator) currentOrchestrator.stop();
    state.orchestrator.status = "stopped";
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, action: "stopped" }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

// ── WebSocket server ──────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);

  ws.send(JSON.stringify({
    type: "initial_state",
    orchestrator: {
      status: state.orchestrator.status,
      restarts: state.orchestrator.restarts,
    },
    project_cwd: PROJECT_CWD,
  }));

  ws.on("close", () => clients.delete(ws));
});

// ── Orchestrator lifecycle ────────────────────────────────────────────────

let currentOrchestrator = null;

function startOrchestrator(forceResume = false) {
  const isResume = forceResume || args.resume || state.orchestrator.restarts > 0;
  const specPath = !isResume && args.spec ? resolve(args.spec) : undefined;

  if (!isResume && !specPath) {
    // Check if checkpoint exists for implicit resume
    const cpPath = join(PROJECT_CWD, ".orchestrator", "checkpoint.json");
    if (existsSync(cpPath)) {
      return startOrchestrator(true);
    }
    console.log(
      "[SUPERVISOR] No --spec provided and no checkpoint found.\n" +
      "             Use POST /restart or re-run with --spec to start."
    );
    return;
  }

  state.orchestrator.status = "running";
  state.orchestrator.startedAt = Date.now();

  // Write PID file and dev-port for watchdog (avoids PM2 daemon mismatch)
  const pidDir = join(PROJECT_CWD, ".orchestrator");
  mkdirSync(pidDir, { recursive: true });
  writeFileSync(join(pidDir, "orchestrator.pid"), String(process.pid), "utf-8");
  writeFileSync(join(pidDir, "dev-port"), String(DEV_PORT), "utf-8");

  broadcast({
    type: "orchestrator_started",
    restart: state.orchestrator.restarts,
    timestamp: Date.now(),
  });

  currentOrchestrator = new Orchestrator({
    cwd: PROJECT_CWD,
    specPath,
    resume: isResume,
    noReview: args["no-review"],
    verbose: VERBOSE,
    config: { devServerPort: DEV_PORT },
    onEvent: (event) => {
      pushLog(`[${event.type}] ${JSON.stringify(event).slice(0, 300)}`);
      broadcast(event);
    },
  });

  // Run the orchestrator and handle completion/crash
  currentOrchestrator.run().then(() => {
    const orchStatus = currentOrchestrator.status;
    currentOrchestrator = null;

    if (orchStatus === "completed") {
      state.orchestrator.status = "completed";
      console.log(`[SUPERVISOR] Orchestrator finished: completed`);
      broadcast({ type: "orchestrator_completed", status: "completed", timestamp: Date.now() });
      return;
    }

    // Orchestrator ended but not completed (e.g. PTY died, phases incomplete)
    // Treat as crash and auto-restart
    console.log(`[SUPERVISOR] Orchestrator ended with status "${orchStatus}" — treating as crash for auto-restart`);
    state.orchestrator.status = "crashed";
    state.orchestrator.lastCrashAt = Date.now();
    triggerAutoRestart();
  }).catch((err) => {
    console.error(`[SUPERVISOR] Orchestrator crashed: ${err.message}`);
    state.orchestrator.status = "crashed";
    state.orchestrator.lastCrashAt = Date.now();
    currentOrchestrator = null;

    broadcast({
      type: "orchestrator_crashed",
      error: err.message,
      restarts: state.orchestrator.restarts,
      timestamp: Date.now(),
    });

    triggerAutoRestart();
  });
}

// ── Auto-restart with backoff ─────────────────────────────────────────────

function triggerAutoRestart() {
  if (state.orchestrator.restarts >= MAX_RESTARTS) {
    console.error(`[SUPERVISOR] Max restarts (${MAX_RESTARTS}) reached. Stopping.`);
    broadcast({ type: "orchestrator_max_restarts", timestamp: Date.now() });
    return;
  }

  const backoff = Math.min(5000 * Math.pow(2, state.orchestrator.restarts), 60000);
  state.orchestrator.restarts++;
  state.orchestrator.status = "restarting";

  console.log(`[SUPERVISOR] Restarting in ${backoff / 1000}s (attempt ${state.orchestrator.restarts}/${MAX_RESTARTS})...`);
  broadcast({ type: "orchestrator_restarting", in_ms: backoff, attempt: state.orchestrator.restarts, timestamp: Date.now() });

  setTimeout(() => {
    console.log("[SUPERVISOR] Restarting with --resume...");
    startOrchestrator(true);
  }, backoff);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────

function gracefulShutdown(signal) {
  console.log(`\n[SUPERVISOR] Received ${signal}. Shutting down...`);
  if (currentOrchestrator) currentOrchestrator.stop();
  setTimeout(() => {
    console.log("[SUPERVISOR] Goodbye.");
    process.exit(0);
  }, 3000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// ── Start everything ──────────────────────────────────────────────────────

console.log("");
console.log("┌──────────────────────────────────────────────────────────┐");
console.log("│          CLAUDE ORCHESTRATOR v2 — Node.js                │");
console.log("└──────────────────────────────────────────────────────────┘");
console.log(`  Project:      ${PROJECT_CWD}`);
console.log(`  Dashboard:    http://localhost:${PORT}`);
console.log(`  Dev server:   port ${DEV_PORT}`);
console.log(`  Max restarts: ${MAX_RESTARTS}`);
console.log(`  Review:       ${args["no-review"] ? "DISABLED" : "ENABLED"}`);
console.log("");

httpServer.listen(PORT, () => {
  console.log(`[READY] Supervisor running on http://localhost:${PORT}`);
  console.log(`        WebSocket: ws://localhost:${PORT}`);
  console.log("");

  if (args.spec || args.resume) {
    startOrchestrator();
  } else {
    // Try auto-resume from checkpoint
    const cpPath = join(PROJECT_CWD, ".orchestrator", "checkpoint.json");
    if (existsSync(cpPath)) {
      console.log("[SUPERVISOR] Found checkpoint, auto-resuming...");
      startOrchestrator(true);
    } else {
      console.log(
        "[SUPERVISOR] No --spec or --resume provided. Watching only.\n" +
        "             Use POST /restart or re-run with --spec to start."
      );
    }
  }
});
