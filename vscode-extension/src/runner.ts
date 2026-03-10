import { spawn, execSync } from "child_process";
import * as http from "http";
import * as path from "path";

export interface RunningInstance {
  name: string;
  pid: number;
  status: string;
  uptime: string;
  memory: string;
}

export class OrchestratorRunner {
  /**
   * Check if there's already an orchestrator running for this project.
   * Returns the running instance info, or null if none found.
   */
  checkRunning(cwd: string): RunningInstance | null {
    try {
      const raw = path.basename(path.resolve(cwd));
      const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 50);
      const expectedName = "orch-" + (safe || "project");

      const output = execSync("npx pm2 jlist", {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
      }).toString();

      const processes: any[] = JSON.parse(output);
      const match = processes.find(
        (p) => p.name === expectedName && p.pm2_env?.status === "online"
      );

      if (!match) return null;

      const uptimeMs = Date.now() - (match.pm2_env?.pm_uptime || Date.now());
      const uptimeMin = Math.floor(uptimeMs / 60000);
      const uptimeStr = uptimeMin >= 60
        ? `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`
        : `${uptimeMin}m`;

      return {
        name: match.name,
        pid: match.pid,
        status: match.pm2_env?.status || "unknown",
        uptime: uptimeStr,
        memory: `${Math.round((match.monit?.memory || 0) / 1024 / 1024)}MB`,
      };
    } catch {
      return null;
    }
  }

  /**
   * Start an orchestrator run via the CLI.
   */
  async start(
    mode: string,
    prompt: string,
    cwd: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Find code-orch binary — try npx first, then global
      const isWindows = process.platform === "win32";
      const shell = isWindows;

      const args =
        mode === "build"
          ? [mode, prompt, "--cwd", cwd]
          : [mode, prompt, "--cwd", cwd];

      const proc = spawn("code-orch", args, {
        cwd,
        shell,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: !isWindows,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      // CLI returns quickly after starting PM2 — wait for exit
      proc.on("close", (code) => {
        if (code === 0 || stdout.includes("Running in background")) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: stderr || stdout || `Exit code ${code}`,
          });
        }
      });

      proc.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      // If it doesn't exit in 30s, assume it started fine
      setTimeout(() => resolve({ success: true }), 30000);
    });
  }

  /**
   * Stop the orchestrator for a given project.
   */
  async stop(cwd: string): Promise<void> {
    return new Promise((resolve) => {
      const proc = spawn("code-orch", ["--stop", cwd], {
        shell: process.platform === "win32",
        stdio: "ignore",
        windowsHide: true,
      });
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
      setTimeout(resolve, 5000);
    });
  }

  /**
   * Fetch current state from the dashboard HTTP API.
   */
  async getState(port: number, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const req = http.get(
        `http://localhost:${port}/state`,
        { headers },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error("Invalid JSON from dashboard"));
            }
          });
        }
      );
      req.on("error", reject);
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
    });
  }
}
