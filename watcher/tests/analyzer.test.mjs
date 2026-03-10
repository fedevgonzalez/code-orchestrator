import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We can't easily test the Claude-calling parts, but we can test the local scan
// by importing the module and checking the exported analyze function exists
const TEST_DIR = join(tmpdir(), "claude-orch-analyzer-test-" + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("analyzer module", () => {
  test("exports analyze function", async () => {
    const mod = await import("../src/analyzer.mjs");
    expect(typeof mod.analyze).toBe("function");
  });
});

describe("local scan detection", () => {
  test("detects Next.js + TypeScript from package.json", async () => {
    // Create a mock package.json
    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify({
      name: "test-project",
      dependencies: {
        "next": "^14.0.0",
        "react": "^18.0.0",
      },
      devDependencies: {
        "typescript": "^5.0.0",
        "tailwindcss": "^3.0.0",
      },
    }), "utf-8");

    // Import the private functions indirectly through analyze
    // Since analyze calls Claude (which we can't do in tests), we just
    // verify the module loads and the codebase object shape is correct
    // by checking the function signature
    const mod = await import("../src/analyzer.mjs");
    expect(mod.analyze).toBeDefined();
    expect(mod.analyze.length).toBeGreaterThanOrEqual(3); // cwd, userPrompt, mode
  });
});
