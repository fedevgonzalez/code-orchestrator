import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "claude-orch-config-test-" + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("loadConfig", () => {
  test("returns defaults when no config file exists", async () => {
    const { loadConfig } = await import("../src/config.mjs");
    const config = await loadConfig(TEST_DIR);
    expect(config.turnTimeout).toBeGreaterThan(0);
    expect(config.buildCommand).toBe("npm run build");
    expect(config.validationEnabled).toBe(true);
  });

  test("merges runtime overrides", async () => {
    const { loadConfig } = await import("../src/config.mjs");
    const config = await loadConfig(TEST_DIR, { devServerPort: 5173 });
    expect(config.devServerPort).toBe(5173);
  });

  test("findConfigPath returns null when no config exists", async () => {
    const { findConfigPath } = await import("../src/config.mjs");
    expect(findConfigPath(TEST_DIR)).toBeNull();
  });
});
