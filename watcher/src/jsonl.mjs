/**
 * JSONL Watcher — Monitors Claude Code transcript files for state changes.
 *
 * Claude Code writes JSONL transcripts to:
 *   ~/.claude/projects/<project-hash>/<session-id>.jsonl
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, normalize } from "path";
import { homedir } from "os";
import { watch } from "chokidar";
import { AgentState } from "./models.mjs";

/**
 * Compute the project hash the same way Claude Code does.
 */
export function projectHash(cwd) {
  const normalized = normalize(cwd);
  return normalized
    .replace(/\\/g, "-")
    .replace(/\//g, "-")
    .replace(/:/g, "-")
    .replace(/^-+/, "");
}

export function getJsonlDir(cwd) {
  return join(homedir(), ".claude", "projects", projectHash(cwd));
}

/**
 * Classify a JSONL record into an AgentState.
 */
export function classifyRecord(record) {
  const type = record.type || "";
  const subtype = record.subtype || "";

  if (type === "system" && subtype === "turn_duration") return AgentState.IDLE;

  if (type === "assistant") {
    const msg = record.message || {};
    const content = msg.content || record.content || [];
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === "tool_use") return AgentState.WORKING;
      }
    }
    return AgentState.RESPONDING;
  }

  if (type === "user") {
    const content = record.content || "";
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((b) => (typeof b === "string" ? b : b.text || "")).join("")
          : "";
    if (text.includes("/exit")) return AgentState.EXITED;
  }

  return null;
}

/**
 * Find the latest .jsonl file for a project.
 */
export function findLatestJsonl(cwd) {
  const dir = getJsonlDir(cwd);
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}

/**
 * JSONL Watcher class — tails the JSONL file and emits events.
 */
export class JSONLWatcher {
  constructor(cwd) {
    this.cwd = cwd;
    this.filePath = null;
    this.filePos = 0;
    this.currentState = AgentState.UNKNOWN;
    this._chokidar = null;
    this._onEventCallbacks = [];
    this._pollTimer = null;
    this._locked = false; // When true, don't switch to newer JSONL files
    this._autoLock = false; // When true, lock to the first file detected
  }

  /**
   * Register a callback for state change events.
   * @param {(event: {state: string, record: object}) => void} cb
   */
  onEvent(cb) {
    this._onEventCallbacks.push(cb);
  }

  _emit(event) {
    for (const cb of this._onEventCallbacks) cb(event);
  }

  /**
   * Start watching. Finds the JSONL file and tails it.
   */
  start() {
    this._findFile();

    // Watch directory for new files
    const dir = getJsonlDir(this.cwd);
    if (existsSync(dir)) {
      this._startChokidar(dir);
    }

    // Fallback poll every 2s
    this._pollTimer = setInterval(() => {
      this._findFile();
      this._readNewLines();
    }, 2000);
  }

  _startChokidar(dir) {
    if (this._chokidar) return;
    this._chokidar = watch(join(dir, "*.jsonl"), {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });
    this._chokidar.on("change", () => {
      this._findFile();
      this._readNewLines();
    });
    this._chokidar.on("add", () => this._findFile());
  }

  /**
   * Lock the watcher to the current JSONL file.
   * While locked, it won't switch to newer files (e.g., from `claude -p` reviewer).
   */
  lock() {
    if (this.filePath) {
      this._locked = true;
      this._autoLock = false;
      console.log(`[JSONL] Locked to: ${this.filePath}`);
    }
  }

  /**
   * Enable auto-lock: the watcher will lock to the FIRST new JSONL file it detects.
   * Use this when the PTY hasn't created its JSONL yet but you want to lock as soon as it does.
   */
  autoLockOnFirstFile() {
    this._autoLock = true;
    console.log("[JSONL] Auto-lock enabled — will lock to first file detected");
  }

  /**
   * Unlock — allow switching to newer JSONL files again.
   */
  unlock() {
    this._locked = false;
  }

  _findFile() {
    // If locked to a specific file, don't switch
    if (this._locked && this.filePath && existsSync(this.filePath)) {
      return;
    }

    const latest = findLatestJsonl(this.cwd);
    if (latest && latest !== this.filePath) {
      this.filePath = latest;
      this.filePos = 0;
      console.log(`[JSONL] Watching: ${latest}`);
      this._emit({ type: "session_start", jsonlPath: latest });

      // Auto-lock: lock to the first file we detect (this is the PTY's JSONL)
      if (this._autoLock) {
        this._locked = true;
        this._autoLock = false;
        console.log(`[JSONL] Auto-locked to: ${latest}`);
      }

      // Start chokidar if we haven't yet (dir may have just appeared)
      const dir = getJsonlDir(this.cwd);
      if (!this._chokidar && existsSync(dir)) {
        this._startChokidar(dir);
      }
    }
  }

  /**
   * Skip to end of current file (don't process old events).
   */
  skipToEnd() {
    if (this.filePath && existsSync(this.filePath)) {
      const content = readFileSync(this.filePath, "utf-8");
      this.filePos = content.length;
    }
  }

  /**
   * Read new lines from the JSONL file.
   * @returns {Array} Array of events
   */
  _readNewLines() {
    if (!this.filePath || !existsSync(this.filePath)) return [];

    const content = readFileSync(this.filePath, "utf-8");
    const newContent = content.slice(this.filePos);
    this.filePos = content.length;

    const lines = newContent.split("\n").filter((l) => l.trim());
    const events = [];

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const state = classifyRecord(record);
        if (state && state !== this.currentState) {
          this.currentState = state;
          const event = { type: "state_change", state, record, timestamp: Date.now() };
          events.push(event);
          this._emit(event);

          if (state === AgentState.IDLE) {
            this._emit({
              type: "turn_complete",
              durationMs: record.duration_ms || 0,
              timestamp: Date.now(),
            });
          }
        }
      } catch {}
    }

    return events;
  }

  /**
   * Wait for idle state. Returns a promise that resolves true (idle) or false (timeout).
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  waitForIdle(timeoutMs = 600_000) {
    return new Promise((resolve) => {
      // Check if already idle
      if (this.currentState === AgentState.IDLE) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);

      const handler = (event) => {
        if (event.state === AgentState.IDLE || event.state === AgentState.EXITED) {
          cleanup();
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        const idx = this._onEventCallbacks.indexOf(handler);
        if (idx >= 0) this._onEventCallbacks.splice(idx, 1);
      };

      this._onEventCallbacks.push(handler);
    });
  }

  stop() {
    if (this._chokidar) {
      this._chokidar.close();
      this._chokidar = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
}
