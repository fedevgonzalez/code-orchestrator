/**
 * Analyzer — Analyzes the codebase and user request before plan generation.
 *
 * Two-phase analysis:
 *   1. Local scan (no Claude call): detect tech stack, structure, patterns
 *   2. Claude analysis (1 call): interpret request, suggest plan, define success criteria
 *
 * The analyzer runs BEFORE the main Claude session starts, using isolated
 * callClaudePipe calls (no session persistence) to avoid polluting context.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, basename, extname } from "path";
import { callClaudePipe } from "./reviewer.mjs";

// ── Local codebase scanning (no Claude call) ────────────────────────────

/**
 * Scan package.json for tech stack detection.
 */
function detectFromPackageJson(cwd) {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    return {
      name: pkg.name || basename(cwd),
      framework: deps["next"] ? "next.js" : deps["react"] ? "react" : deps["vue"] ? "vue" : deps["express"] ? "express" : "unknown",
      language: deps["typescript"] ? "typescript" : "javascript",
      styling: deps["tailwindcss"] ? "tailwind" : deps["styled-components"] ? "styled-components" : deps["@emotion/react"] ? "emotion" : "css",
      orm: deps["drizzle-orm"] ? "drizzle" : deps["prisma"] ? "prisma" : deps["@prisma/client"] ? "prisma" : deps["typeorm"] ? "typeorm" : null,
      auth: deps["better-auth"] ? "better-auth" : deps["next-auth"] ? "next-auth" : deps["@auth/core"] ? "auth.js" : null,
      testing: deps["vitest"] ? "vitest" : deps["jest"] ? "jest" : deps["playwright"] ? "playwright" : null,
      payments: deps["stripe"] ? "stripe" : null,
      stateManagement: deps["zustand"] ? "zustand" : deps["jotai"] ? "jotai" : deps["redux"] ? "redux" : null,
      packageManager: existsSync(join(cwd, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(cwd, "yarn.lock")) ? "yarn" : existsSync(join(cwd, "bun.lockb")) ? "bun" : "npm",
      scripts: pkg.scripts || {},
      allDeps: Object.keys(deps),
    };
  } catch {
    return null;
  }
}

/**
 * Scan directory structure (max depth).
 */
function scanStructure(dir, maxDepth = 3, currentDepth = 0, prefix = "") {
  if (currentDepth >= maxDepth) return [];
  const entries = [];

  try {
    const items = readdirSync(dir)
      .filter(f => !f.startsWith(".") && f !== "node_modules" && f !== ".next" && f !== "dist" && f !== "build" && f !== "__pycache__");

    for (const item of items.slice(0, 30)) {
      const fullPath = join(dir, item);
      const relativePath = prefix ? `${prefix}/${item}` : item;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          entries.push({ path: relativePath, type: "dir" });
          entries.push(...scanStructure(fullPath, maxDepth, currentDepth + 1, relativePath));
        } else {
          entries.push({ path: relativePath, type: "file" });
        }
      } catch {}
    }
  } catch {}

  return entries;
}

/**
 * Detect config files.
 */
function detectConfigs(cwd) {
  const configs = {};
  const checks = [
    ["next.config.mjs", "next.config.ts", "next.config.js"],
    ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs"],
    ["drizzle.config.ts", "drizzle.config.js"],
    ["prisma/schema.prisma"],
    ["playwright.config.ts", "playwright.config.js"],
    ["vitest.config.ts", "vitest.config.js"],
    ["tsconfig.json"],
    [".env", ".env.local", ".env.example"],
    ["docker-compose.yml", "docker-compose.yaml", "Dockerfile"],
    [".github/workflows"],
    ["CLAUDE.md", ".claude/settings.json"],
  ];

  for (const group of checks) {
    for (const file of group) {
      if (existsSync(join(cwd, file))) {
        const key = file.split("/")[0].split(".")[0] || file;
        configs[key] = file;
        break;
      }
    }
  }

  return configs;
}

/**
 * Find files relevant to a search query (basic keyword matching in filenames).
 */
function findRelevantFiles(cwd, keywords, maxFiles = 20) {
  const structure = scanStructure(cwd, 4);
  const files = structure.filter(e => e.type === "file");
  const lower = keywords.map(k => k.toLowerCase());

  return files
    .filter(f => {
      const name = f.path.toLowerCase();
      return lower.some(k => name.includes(k));
    })
    .slice(0, maxFiles)
    .map(f => f.path);
}

// ── Full analysis ──────────────────────────────────────────────────────

/**
 * Run full codebase + request analysis.
 *
 * @param {string} cwd - Project directory
 * @param {string} userPrompt - User's raw request
 * @param {string} mode - Orchestrator mode (feature, fix, audit, etc.)
 * @returns {object} Analysis result
 */
export async function analyze(cwd, userPrompt, mode) {
  console.log(`[ANALYZER] Scanning codebase at ${cwd}...`);

  // Phase 1: Local scan
  const pkg = detectFromPackageJson(cwd);
  const structure = scanStructure(cwd, 3);
  const configs = detectConfigs(cwd);

  const codebase = {
    exists: pkg !== null,
    package: pkg,
    configs,
    structure: structure.slice(0, 100), // Cap for prompt size
    structureSummary: summarizeStructure(structure),
  };

  console.log(`[ANALYZER] Detected: ${pkg?.framework || "no framework"}, ${pkg?.language || "unknown lang"}, ${pkg?.orm || "no orm"}`);
  console.log(`[ANALYZER] Files: ${structure.filter(e => e.type === "file").length}, Dirs: ${structure.filter(e => e.type === "dir").length}`);

  // Phase 2: Claude analysis (interpret request + suggest plan)
  console.log(`[ANALYZER] Analyzing request with Claude (mode: ${mode})...`);

  const claudeAnalysis = analyzeWithClaude(cwd, userPrompt, mode, codebase);

  return {
    codebase,
    request: claudeAnalysis.request,
    plan: claudeAnalysis.plan,
    raw: claudeAnalysis,
  };
}

function summarizeStructure(structure) {
  const dirs = structure.filter(e => e.type === "dir").map(e => e.path);
  const files = structure.filter(e => e.type === "file");

  // Group files by extension
  const byExt = {};
  for (const f of files) {
    const ext = extname(f.path) || "no-ext";
    byExt[ext] = (byExt[ext] || 0) + 1;
  }

  return { topDirs: dirs.slice(0, 20), fileTypes: byExt, totalFiles: files.length };
}

/**
 * Call Claude to interpret the user's request and suggest an execution plan.
 * Uses callClaudePipe (isolated, no session persistence).
 */
function analyzeWithClaude(cwd, userPrompt, mode, codebase) {
  const topDirs = codebase.structureSummary.topDirs.slice(0, 15).join(", ");
  const pkg = codebase.package;

  const prompt = `You are a senior architect. Plan this ${mode.toUpperCase()} task on an existing ${pkg?.framework || "unknown"} (${pkg?.language || "js"}) project.

REQUEST: "${userPrompt}"
PROJECT: ${pkg?.name || basename(cwd)} | ORM: ${pkg?.orm || "none"} | Auth: ${pkg?.auth || "none"} | Style: ${pkg?.styling || "css"} | Test: ${pkg?.testing || "none"} | PM: ${pkg?.packageManager || "npm"}
DIRS: ${topDirs}

RULES:
- 1-6 phases, 1-4 tasks each. Task prompts: detailed but MAX 300 chars each. Include file paths.
- If the request is vague, infer full scope. Include validation per task ("check file: X" or "run: npm run build").
- ${mode === "feature" ? "Include: backend + frontend + integration + tests" : ""}${mode === "fix" ? "Include: diagnosis + fix + regression test" : ""}${mode === "audit" ? "Include: scan + report. Keep prompts focused on analysis." : ""}${mode === "test" ? "Include: test generation + run + fix failures" : ""}${mode === "review" ? "Include: deep analysis + markdown report" : ""}${mode === "refactor" ? "Include: analysis + incremental refactor + verify" : ""}${mode === "exec" ? "Plan whatever makes sense for the request." : ""}

Respond ONLY with compact JSON (no markdown, no explanation):
{"request":{"intent":"${mode}","summary":"...","affectedAreas":["..."],"complexity":"low|medium|high","estimatedPhases":2},"plan":{"phases":[{"id":"...","name":"...","tasks":[{"id":"...","prompt":"DETAILED prompt...","validate":"run: npm run build"}]}],"successCriteria":["..."],"validationStrategy":["build"]}}`;

  const raw = callClaudePipe(prompt, cwd);

  try {
    return extractJson(raw);
  } catch (e) {
    console.error(`[ANALYZER] Failed to parse Claude analysis: ${e.message}`);
    return {
      request: {
        intent: mode,
        summary: userPrompt,
        affectedAreas: ["unknown"],
        complexity: "medium",
        estimatedPhases: 1,
      },
      plan: {
        phases: [{
          id: `${mode}-1`,
          name: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Task`,
          tasks: [{
            id: `${mode}-1-1`,
            prompt: userPrompt,
            validate: null,
          }],
        }],
        successCriteria: ["Task completed"],
        validationStrategy: ["build"],
      },
    };
  }
}

/**
 * Extract JSON from Claude's response (handles markdown fences).
 */
function extractJson(raw) {
  let s = raw;
  if (raw.includes("```json")) {
    const start = raw.indexOf("```json") + 7;
    const end = raw.indexOf("```", start);
    s = raw.slice(start, end).trim();
  } else if (raw.includes("```")) {
    const start = raw.indexOf("```") + 3;
    const end = raw.indexOf("```", start);
    s = raw.slice(start, end).trim();
  } else if (raw.includes("{")) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    s = raw.slice(start, end);
  }
  return JSON.parse(s);
}
