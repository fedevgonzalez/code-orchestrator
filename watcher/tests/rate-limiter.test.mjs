import { describe, test, expect } from "@jest/globals";
import { RateLimiter } from "../src/rate-limiter.mjs";

describe("RateLimiter", () => {
  test("allows immediate acquisition when under limit", async () => {
    const limiter = new RateLimiter({ maxConcurrent: 2, minDelayMs: 0 });
    await limiter.acquire();
    expect(limiter.getStatus().active).toBe(1);
    limiter.release();
    expect(limiter.getStatus().active).toBe(0);
  });

  test("wrap executes function and releases", async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayMs: 0 });
    const result = await limiter.wrap(async () => 42);
    expect(result).toBe(42);
    expect(limiter.getStatus().active).toBe(0);
  });

  test("wrap releases on error", async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayMs: 0 });
    try {
      await limiter.wrap(async () => { throw new Error("fail"); });
    } catch {}
    expect(limiter.getStatus().active).toBe(0);
  });

  test("tracks stats", async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayMs: 0 });
    await limiter.wrap(async () => {});
    await limiter.wrap(async () => {});
    expect(limiter.stats.totalCalls).toBe(2);
  });

  test("getStatus returns correct shape", () => {
    const limiter = new RateLimiter();
    const status = limiter.getStatus();
    expect(status).toHaveProperty("active");
    expect(status).toHaveProperty("queued");
    expect(status).toHaveProperty("maxConcurrent");
    expect(status).toHaveProperty("stats");
  });
});
