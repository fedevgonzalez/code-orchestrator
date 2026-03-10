#!/usr/bin/env node
/**
 * Watchdog — Ensures PM2 processes survive system reboots and PM2 crashes.
 *
 * This script is designed to run via Windows Task Scheduler (or cron on Linux/macOS).
 * It checks if PM2 has any orchestrator processes saved, and resurrects them if needed.
 *
 * Usage:
 *   node watchdog.mjs                  Check and resurrect PM2 processes
 *   node watchdog.mjs --install        Register as a Windows scheduled task (runs on logon)
 *   node watchdog.mjs --uninstall      Remove the scheduled task
 *   node watchdog.mjs --status         Show watchdog task status
 */

import { execSync } from "child_process";
import { platform } from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASK_NAME = "ClaudeOrchestratorWatchdog";
const isWindows = platform() === "win32";

const action = process.argv[2];

if (action === "--install") {
  install();
} else if (action === "--uninstall") {
  uninstall();
} else if (action === "--status") {
  status();
} else {
  resurrect();
}

// ── Resurrect PM2 processes ─────────────────────────────────────────────

function resurrect() {
  try {
    // Check if PM2 daemon is running by listing processes
    const list = exec("npx pm2 jlist");
    const processes = JSON.parse(list || "[]");
    const orchProcesses = processes.filter(p => p.name?.startsWith("orch-"));

    if (orchProcesses.length > 0) {
      const running = orchProcesses.filter(p => p.pm2_env?.status === "online");
      console.log(`[WATCHDOG] PM2 alive — ${running.length}/${orchProcesses.length} orchestrator processes online`);
      return;
    }
  } catch {
    // PM2 daemon is not running — need to resurrect
    console.log("[WATCHDOG] PM2 daemon not responding — attempting resurrect...");
  }

  // Save state first (in case PM2 is running but empty)
  try {
    exec("npx pm2 resurrect");
    console.log("[WATCHDOG] PM2 resurrect completed");

    // Verify
    const list = exec("npx pm2 jlist");
    const processes = JSON.parse(list || "[]");
    const orchProcesses = processes.filter(p => p.name?.startsWith("orch-"));
    console.log(`[WATCHDOG] After resurrect: ${orchProcesses.length} orchestrator processes found`);
  } catch (e) {
    console.error(`[WATCHDOG] Resurrect failed: ${e.message}`);
  }
}

// ── Install scheduled task ──────────────────────────────────────────────

function install() {
  const nodePath = process.execPath;
  const scriptPath = resolve(__dirname, "watchdog.mjs");

  if (isWindows) {
    // Remove existing task if any
    try {
      execSync(`schtasks /Delete /TN "${TASK_NAME}" /F`, { stdio: "ignore" });
    } catch { /* task didn't exist */ }

    // Create task that runs on logon + every 10 minutes
    const cmd = `schtasks /Create /TN "${TASK_NAME}" /TR "\\"${nodePath}\\" \\"${scriptPath}\\"" /SC ONLOGON /RL HIGHEST /F`;
    try {
      execSync(cmd, { stdio: "inherit" });
      console.log(`[WATCHDOG] Installed scheduled task: ${TASK_NAME}`);
      console.log(`           Runs on logon as: ${nodePath} ${scriptPath}`);

      // Also add a periodic trigger (every 10 min) as a safety net
      try {
        execSync(`schtasks /Change /TN "${TASK_NAME}" /RI 10 /DU 9999:00`, { stdio: "ignore" });
      } catch { /* periodic trigger is optional */ }

      // Save current PM2 state so resurrect has something to restore
      try {
        execSync("npx pm2 save", { stdio: "inherit", cwd: __dirname });
        console.log("[WATCHDOG] PM2 state saved for future resurrections");
      } catch { /* no PM2 processes to save */ }
    } catch (e) {
      console.error(`[WATCHDOG] Failed to install: ${e.message}`);
      console.error("           Try running as Administrator");
      process.exit(1);
    }
  } else {
    // Linux/macOS: add a cron job
    const cronLine = `*/10 * * * * "${nodePath}" "${scriptPath}" >> /tmp/claude-orch-watchdog.log 2>&1`;
    try {
      const existing = exec("crontab -l").trim();
      if (existing.includes("watchdog.mjs")) {
        console.log("[WATCHDOG] Cron job already installed");
        return;
      }
      const newCron = existing ? `${existing}\n${cronLine}` : cronLine;
      execSync(`echo '${newCron}' | crontab -`, { stdio: "inherit" });
      console.log("[WATCHDOG] Installed cron job (every 10 minutes)");
    } catch (e) {
      console.error(`[WATCHDOG] Failed to install cron: ${e.message}`);
      process.exit(1);
    }
  }
}

// ── Uninstall ───────────────────────────────────────────────────────────

function uninstall() {
  if (isWindows) {
    try {
      execSync(`schtasks /Delete /TN "${TASK_NAME}" /F`, { stdio: "inherit" });
      console.log(`[WATCHDOG] Removed scheduled task: ${TASK_NAME}`);
    } catch {
      console.log("[WATCHDOG] No scheduled task found to remove");
    }
  } else {
    try {
      const existing = exec("crontab -l").trim();
      const filtered = existing.split("\n").filter(l => !l.includes("watchdog.mjs")).join("\n");
      execSync(`echo '${filtered}' | crontab -`, { stdio: "inherit" });
      console.log("[WATCHDOG] Removed cron job");
    } catch {
      console.log("[WATCHDOG] No cron job found to remove");
    }
  }
}

// ── Status ──────────────────────────────────────────────────────────────

function status() {
  if (isWindows) {
    try {
      execSync(`schtasks /Query /TN "${TASK_NAME}" /FO LIST /V`, { stdio: "inherit" });
    } catch {
      console.log(`[WATCHDOG] No scheduled task "${TASK_NAME}" found`);
      console.log("           Install with: node watchdog.mjs --install");
    }
  } else {
    try {
      const cron = exec("crontab -l");
      const line = cron.split("\n").find(l => l.includes("watchdog.mjs"));
      if (line) {
        console.log(`[WATCHDOG] Cron job: ${line}`);
      } else {
        console.log("[WATCHDOG] No cron job found");
        console.log("           Install with: node watchdog.mjs --install");
      }
    } catch {
      console.log("[WATCHDOG] No cron job found");
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function exec(cmd) {
  return execSync(cmd, {
    cwd: __dirname,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30_000,
    windowsHide: true,
  }).trim();
}
