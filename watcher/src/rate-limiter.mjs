/**
 * Rate Limiter — Queue for Claude API calls.
 *
 * Prevents overwhelming the Claude API with parallel calls.
 * Enforces concurrency limits and inter-request delays.
 */

/**
 * @typedef {object} RateLimiterOptions
 * @property {number} [maxConcurrent=1] - Max concurrent Claude calls
 * @property {number} [minDelayMs=1000] - Minimum delay between calls
 * @property {number} [maxQueueSize=100] - Max queued requests
 */

export class RateLimiter {
  /**
   * @param {RateLimiterOptions} opts
   */
  constructor(opts = {}) {
    this.maxConcurrent = opts.maxConcurrent || 1;
    this.minDelayMs = opts.minDelayMs || 1000;
    this.maxQueueSize = opts.maxQueueSize || 100;

    /** @type {Array<{resolve: Function, reject: Function}>} */
    this._queue = [];
    this._active = 0;
    this._lastCallTime = 0;

    // Stats
    this.stats = {
      totalCalls: 0,
      totalWaitMs: 0,
      maxWaitMs: 0,
      queueHighWater: 0,
    };
  }

  /**
   * Acquire a slot to make a Claude call.
   * Resolves when it's safe to proceed.
   * @returns {Promise<void>}
   */
  async acquire() {
    if (this._active < this.maxConcurrent) {
      return this._startCall();
    }

    if (this._queue.length >= this.maxQueueSize) {
      throw new Error(`Rate limiter queue full (${this.maxQueueSize} pending)`);
    }

    const waitStart = Date.now();
    this.stats.queueHighWater = Math.max(this.stats.queueHighWater, this._queue.length + 1);

    return new Promise((resolve, reject) => {
      this._queue.push({ resolve: () => {
        const waitMs = Date.now() - waitStart;
        this.stats.totalWaitMs += waitMs;
        this.stats.maxWaitMs = Math.max(this.stats.maxWaitMs, waitMs);
        this._startCall().then(resolve);
      }, reject });
    });
  }

  /**
   * Release a slot after a Claude call completes.
   */
  release() {
    this._active--;

    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next.resolve();
    }
  }

  /**
   * Wrap a function with rate limiting.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async wrap(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  async _startCall() {
    this._active++;
    this.stats.totalCalls++;

    // Enforce minimum delay between calls
    const now = Date.now();
    const elapsed = now - this._lastCallTime;
    if (elapsed < this.minDelayMs && this._lastCallTime > 0) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this._lastCallTime = Date.now();
  }

  /**
   * Get current status.
   */
  getStatus() {
    return {
      active: this._active,
      queued: this._queue.length,
      maxConcurrent: this.maxConcurrent,
      stats: { ...this.stats },
    };
  }
}
