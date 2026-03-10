import { spawn } from "child_process";
import * as http from "http";

export class OrchestratorRunner {
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
