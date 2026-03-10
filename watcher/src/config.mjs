/**
 * Config — Project-level configuration loader.
 *
 * Loads `.orchestrator.config.js` or `.orchestrator.config.mjs` from the project root.
 * Merges with DEFAULT_CONFIG, with project config taking precedence.
 *
 * Example .orchestrator.config.js:
 *   export default {
 *     buildCommand: "pnpm run build",
 *     devCommand: "pnpm run dev",
 *     devServerPort: 5173,
 *     testCommand: "pnpm test",
 *     turnTimeout: 15 * 60_000,
 *     maxReviewCycles: 2,
 *     validators: ["build", "test"],
 *     plugins: ["./my-validator.mjs"],
 *   };
 */

import { existsSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { DEFAULT_CONFIG } from "./models.mjs";

const CONFIG_FILENAMES = [
  ".orchestrator.config.mjs",
  ".orchestrator.config.js",
  ".orchestrator.config.cjs",
  "orchestrator.config.mjs",
  "orchestrator.config.js",
];

/**
 * Load project-level config and merge with defaults.
 * @param {string} cwd - Project root directory
 * @param {object} [overrides] - CLI/runtime overrides (highest priority)
 * @returns {Promise<object>} Merged config
 */
export async function loadConfig(cwd, overrides = {}) {
  const projectConfig = await loadProjectConfig(cwd);

  // Merge: defaults < project config < runtime overrides
  const merged = { ...DEFAULT_CONFIG, ...projectConfig, ...overrides };

  // Normalize plugin paths
  if (merged.plugins) {
    merged.plugins = merged.plugins.map((p) =>
      p.startsWith(".") ? resolve(cwd, p) : p
    );
  }

  if (projectConfig._source) {
    console.log(`[CONFIG] Loaded from ${projectConfig._source}`);
  }

  return merged;
}

/**
 * Search for and load a project config file.
 * @param {string} cwd
 * @returns {Promise<object>}
 */
async function loadProjectConfig(cwd) {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(cwd, filename);
    if (!existsSync(configPath)) continue;

    try {
      const fileUrl = pathToFileURL(resolve(configPath)).href;

      if (filename.endsWith(".cjs")) {
        // CommonJS config
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const config = require(resolve(configPath));
        return { ...(config.default || config), _source: filename };
      }

      // ESM config
      const mod = await import(fileUrl);
      const config = mod.default || mod;
      return { ...config, _source: filename };
    } catch (e) {
      console.error(`[CONFIG] Failed to load ${filename}: ${e.message}`);
      return {};
    }
  }

  return {};
}

/**
 * Get the resolved config file path (if any).
 * @param {string} cwd
 * @returns {string|null}
 */
export function findConfigPath(cwd) {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(cwd, filename);
    if (existsSync(configPath)) return configPath;
  }
  return null;
}
