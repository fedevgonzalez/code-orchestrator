/**
 * Plugin System — Custom validators and lifecycle hooks.
 *
 * Plugins are loaded from the `plugins` array in project config.
 * Each plugin exports a `register(orchestrator)` function.
 *
 * Example plugin (my-validator.mjs):
 *   export function register(orch) {
 *     orch.addValidator("my-check", async (cwd, config) => {
 *       return { type: "my-check", ok: true, message: "All good" };
 *     });
 *     orch.addHook("afterTask", (task, phase) => {
 *       console.log(`Task ${task.id} completed with score ${task.reviewScore}`);
 *     });
 *   }
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";

/**
 * Plugin registry — manages custom validators and hooks.
 */
export class PluginRegistry {
  constructor() {
    /** @type {Map<string, Function>} Custom validators: name -> async (cwd, config) => result */
    this.validators = new Map();

    /** @type {Map<string, Function[]>} Lifecycle hooks: event -> handler[] */
    this.hooks = new Map();

    /** @type {Map<string, Map<string, string[]>>} Phase validator overrides */
    this.phaseValidators = new Map();

    /** @type {string[]} Loaded plugin paths */
    this.loadedPlugins = [];
  }

  /**
   * Register a custom validator.
   * @param {string} name - Validator name (used in phase config)
   * @param {Function} fn - async (cwd, config) => { type, ok, message, output? }
   */
  addValidator(name, fn) {
    this.validators.set(name, fn);
    console.log(`[PLUGIN] Registered validator: ${name}`);
  }

  /**
   * Register a lifecycle hook.
   * @param {string} event - Hook event name
   * @param {Function} handler - Hook handler
   *
   * Available events:
   *   - beforeRun(orchestrator)
   *   - afterRun(orchestrator, status)
   *   - beforePhase(phase, phaseIdx)
   *   - afterPhase(phase, phaseIdx)
   *   - beforeTask(task, phase)
   *   - afterTask(task, phase)
   *   - onValidationFail(result, phase)
   *   - onReviewComplete(task, review)
   */
  addHook(event, handler) {
    if (!this.hooks.has(event)) this.hooks.set(event, []);
    this.hooks.get(event).push(handler);
    console.log(`[PLUGIN] Registered hook: ${event}`);
  }

  /**
   * Add validators for a specific phase.
   * @param {string} phaseId - Normalized phase ID
   * @param {string[]} validators - Validator names to add
   */
  addPhaseValidators(phaseId, validators) {
    if (!this.phaseValidators.has(phaseId)) {
      this.phaseValidators.set(phaseId, []);
    }
    this.phaseValidators.get(phaseId).push(...validators);
  }

  /**
   * Run all handlers for a lifecycle event.
   * @param {string} event
   * @param  {...any} args
   */
  async runHook(event, ...args) {
    const handlers = this.hooks.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(...args);
      } catch (e) {
        console.error(`[PLUGIN] Hook "${event}" error: ${e.message}`);
      }
    }
  }

  /**
   * Run a custom validator by name.
   * @param {string} name
   * @param {string} cwd
   * @param {object} config
   * @returns {Promise<object>}
   */
  async runValidator(name, cwd, config) {
    const fn = this.validators.get(name);
    if (!fn) return { type: name, ok: true, message: `Unknown plugin validator: ${name}` };
    try {
      return await fn(cwd, config);
    } catch (e) {
      return { type: name, ok: false, message: `Plugin validator error: ${e.message}` };
    }
  }

  /**
   * Get extra validators for a phase (from plugins).
   * @param {string} normalizedPhaseId
   * @returns {string[]}
   */
  getPhaseValidators(normalizedPhaseId) {
    return this.phaseValidators.get(normalizedPhaseId) || [];
  }

  /**
   * Check if a validator name is a plugin validator.
   * @param {string} name
   * @returns {boolean}
   */
  hasValidator(name) {
    return this.validators.has(name);
  }
}

/**
 * Load plugins from config.
 * @param {string[]} pluginPaths - Array of plugin file paths
 * @param {PluginRegistry} registry
 */
export async function loadPlugins(pluginPaths, registry) {
  if (!pluginPaths || pluginPaths.length === 0) return;

  for (const pluginPath of pluginPaths) {
    const resolved = resolve(pluginPath);
    if (!existsSync(resolved)) {
      console.error(`[PLUGIN] Plugin not found: ${resolved}`);
      continue;
    }

    try {
      const fileUrl = pathToFileURL(resolved).href;
      const mod = await import(fileUrl);

      if (typeof mod.register === "function") {
        mod.register(registry);
        registry.loadedPlugins.push(resolved);
        console.log(`[PLUGIN] Loaded: ${pluginPath}`);
      } else {
        console.error(`[PLUGIN] No register() export in: ${pluginPath}`);
      }
    } catch (e) {
      console.error(`[PLUGIN] Failed to load ${pluginPath}: ${e.message}`);
    }
  }

  console.log(`[PLUGIN] ${registry.loadedPlugins.length} plugins loaded, ${registry.validators.size} validators, ${registry.hooks.size} hook types`);
}
