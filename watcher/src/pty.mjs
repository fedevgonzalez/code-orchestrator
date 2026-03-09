/**
 * PTY Adapter — Spawns Claude Code in a real terminal via node-pty.
 * Cross-platform: ConPTY on Windows, Unix PTY on Linux/Mac.
 */

import { spawn as ptySpawn } from "node-pty";
import which from "which";
import { platform, homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Find the claude CLI binary.
 */
export function findClaudeBinary() {
  // Check PATH first
  try {
    return which.sync("claude");
  } catch {}

  // Windows: check common install locations
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
 * PTY wrapper around node-pty.
 */
export class ClaudePTY {
  constructor() {
    this._pty = null;
    this._outputBuffer = [];
    this._onDataCallbacks = [];
    this._alive = false;
  }

  /**
   * Spawn Claude Code in a PTY.
   * @param {string} cwd - Working directory
   * @returns {void}
   */
  spawn(cwd) {
    const claudeBin = findClaudeBinary();
    const shell = platform() === "win32" ? claudeBin : claudeBin;
    const args = ["--dangerously-skip-permissions"];

    // Remove CLAUDECODE env var to avoid "nested session" error
    const env = { ...process.env };
    delete env.CLAUDECODE;

    this._pty = ptySpawn(shell, args, {
      name: "xterm-256color",
      cols: 200,
      rows: 24,
      cwd,
      env,
    });

    this._pty.onData((data) => {
      this._outputBuffer.push(data);
      // Keep buffer bounded
      if (this._outputBuffer.length > 500) {
        this._outputBuffer = this._outputBuffer.slice(-200);
      }
      for (const cb of this._onDataCallbacks) {
        cb(data);
      }
    });

    this._pty.onExit(({ exitCode, signal }) => {
      console.log(`[PTY] Process exited (code=${exitCode}, signal=${signal})`);
      this._alive = false;
    });

    this._alive = true;
    console.log(`[PTY] Spawned: ${claudeBin} --dangerously-skip-permissions (cwd: ${cwd})`);
  }

  /**
   * Send text to Claude Code's stdin.
   * @param {string} text
   */
  write(text) {
    if (!this._pty) throw new Error("PTY not spawned");
    this._pty.write(text);
  }

  /**
   * Send a prompt followed by Enter.
   * @param {string} prompt
   */
  send(prompt) {
    this.write(prompt + "\n");
  }

  /**
   * Register a callback for PTY output.
   * @param {(data: string) => void} callback
   */
  onData(callback) {
    this._onDataCallbacks.push(callback);
  }

  /**
   * Read and flush the output buffer.
   * @returns {string}
   */
  readBuffer() {
    const out = this._outputBuffer.join("");
    this._outputBuffer = [];
    return out;
  }

  /**
   * Get recent output (last N chars) without clearing.
   * @param {number} chars
   * @returns {string}
   */
  peekRecent(chars = 2000) {
    const all = this._outputBuffer.join("");
    return all.slice(-chars);
  }

  /**
   * Check if the process is alive.
   * @returns {boolean}
   */
  get isAlive() {
    return this._alive && this._pty !== null;
  }

  /**
   * Get the process PID.
   */
  get pid() {
    return this._pty?.pid;
  }

  /**
   * Kill the PTY process.
   */
  kill() {
    if (this._pty) {
      try {
        this._pty.kill();
      } catch {}
      this._pty = null;
    }
    this._alive = false;
    this._outputBuffer = [];
    this._onDataCallbacks = [];
    console.log("[PTY] Killed");
  }

  /**
   * Send /exit and close.
   */
  exit() {
    if (this._pty) {
      try {
        this.write("/exit\n");
      } catch {}
      setTimeout(() => this.kill(), 5000);
    }
  }
}
