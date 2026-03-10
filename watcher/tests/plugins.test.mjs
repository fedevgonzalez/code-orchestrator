import { describe, test, expect } from "@jest/globals";
import { PluginRegistry } from "../src/plugins.mjs";

describe("PluginRegistry", () => {
  test("registers and runs custom validators", async () => {
    const registry = new PluginRegistry();
    registry.addValidator("my-check", async (cwd) => {
      return { type: "my-check", ok: true, message: `Checked ${cwd}` };
    });

    expect(registry.hasValidator("my-check")).toBe(true);
    const result = await registry.runValidator("my-check", "/test", {});
    expect(result.ok).toBe(true);
    expect(result.type).toBe("my-check");
  });

  test("handles unknown validators gracefully", async () => {
    const registry = new PluginRegistry();
    const result = await registry.runValidator("nonexistent", "/test", {});
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Unknown");
  });

  test("registers and runs hooks", async () => {
    const registry = new PluginRegistry();
    const calls = [];
    registry.addHook("afterTask", (task) => calls.push(task.id));

    await registry.runHook("afterTask", { id: "t1" });
    await registry.runHook("afterTask", { id: "t2" });
    expect(calls).toEqual(["t1", "t2"]);
  });

  test("hook errors don't propagate", async () => {
    const registry = new PluginRegistry();
    registry.addHook("test", () => { throw new Error("boom"); });

    // Should not throw
    await registry.runHook("test");
  });

  test("manages phase validators", () => {
    const registry = new PluginRegistry();
    registry.addPhaseValidators("scaffold", ["my-check"]);
    expect(registry.getPhaseValidators("scaffold")).toEqual(["my-check"]);
    expect(registry.getPhaseValidators("unknown")).toEqual([]);
  });
});
