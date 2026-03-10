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
 * Detect the primary ecosystem of the project.
 * Supports: Node.js, Python, Go, Rust, Java, Ruby, .NET, PHP.
 */
function detectEcosystem(cwd) {
  const markers = [
    { file: "package.json", ecosystem: "node" },
    { file: "pyproject.toml", ecosystem: "python" },
    { file: "requirements.txt", ecosystem: "python" },
    { file: "setup.py", ecosystem: "python" },
    { file: "Pipfile", ecosystem: "python" },
    { file: "go.mod", ecosystem: "go" },
    { file: "Cargo.toml", ecosystem: "rust" },
    { file: "pom.xml", ecosystem: "java" },
    { file: "build.gradle", ecosystem: "java" },
    { file: "build.gradle.kts", ecosystem: "java" },
    { file: "Gemfile", ecosystem: "ruby" },
    { file: "composer.json", ecosystem: "php" },
    { file: "*.csproj", ecosystem: "dotnet" },
    { file: "*.sln", ecosystem: "dotnet" },
  ];

  const detected = [];
  for (const m of markers) {
    if (m.file.includes("*")) {
      // Glob-like check (just check if any matching file exists in root)
      try {
        const files = readdirSync(cwd);
        const ext = m.file.replace("*", "");
        if (files.some(f => f.endsWith(ext))) detected.push(m.ecosystem);
      } catch { /* ignore */ }
    } else if (existsSync(join(cwd, m.file))) {
      detected.push(m.ecosystem);
    }
  }

  // Deduplicate
  return [...new Set(detected)];
}

/**
 * Detect project info for non-Node ecosystems.
 */
function detectNonNodeProject(cwd, ecosystem) {
  const info = {
    name: basename(cwd),
    ecosystem,
    language: ecosystem,
    framework: "unknown",
    buildCommand: null,
    testCommand: null,
    packageManager: null,
  };

  try {
    switch (ecosystem) {
      case "python": {
        if (existsSync(join(cwd, "pyproject.toml"))) {
          const toml = readFileSync(join(cwd, "pyproject.toml"), "utf-8");
          if (toml.includes("django")) info.framework = "django";
          else if (toml.includes("fastapi")) info.framework = "fastapi";
          else if (toml.includes("flask")) info.framework = "flask";
          info.packageManager = toml.includes("[tool.poetry]") ? "poetry" : "pip";
        }
        info.buildCommand = "python -m pytest --co -q"; // collect-only as build check
        info.testCommand = "python -m pytest";
        break;
      }
      case "go": {
        if (existsSync(join(cwd, "go.mod"))) {
          const mod = readFileSync(join(cwd, "go.mod"), "utf-8");
          const modMatch = mod.match(/module\s+(\S+)/);
          if (modMatch) info.name = modMatch[1].split("/").pop();
          if (mod.includes("gin-gonic")) info.framework = "gin";
          else if (mod.includes("labstack/echo")) info.framework = "echo";
          else if (mod.includes("gofiber")) info.framework = "fiber";
        }
        info.buildCommand = "go build ./...";
        info.testCommand = "go test ./...";
        info.packageManager = "go mod";
        break;
      }
      case "rust": {
        if (existsSync(join(cwd, "Cargo.toml"))) {
          const cargo = readFileSync(join(cwd, "Cargo.toml"), "utf-8");
          const nameMatch = cargo.match(/name\s*=\s*"([^"]+)"/);
          if (nameMatch) info.name = nameMatch[1];
          if (cargo.includes("actix-web")) info.framework = "actix";
          else if (cargo.includes("axum")) info.framework = "axum";
          else if (cargo.includes("rocket")) info.framework = "rocket";
        }
        info.buildCommand = "cargo build";
        info.testCommand = "cargo test";
        info.packageManager = "cargo";
        break;
      }
      case "java": {
        if (existsSync(join(cwd, "pom.xml"))) {
          const pom = readFileSync(join(cwd, "pom.xml"), "utf-8");
          if (pom.includes("spring-boot")) info.framework = "spring-boot";
          info.buildCommand = "mvn compile";
          info.testCommand = "mvn test";
          info.packageManager = "maven";
        } else if (existsSync(join(cwd, "build.gradle")) || existsSync(join(cwd, "build.gradle.kts"))) {
          info.framework = "gradle";
          info.buildCommand = "./gradlew build";
          info.testCommand = "./gradlew test";
          info.packageManager = "gradle";
        }
        break;
      }
      case "ruby": {
        if (existsSync(join(cwd, "Gemfile"))) {
          const gemfile = readFileSync(join(cwd, "Gemfile"), "utf-8");
          if (gemfile.includes("rails")) info.framework = "rails";
          else if (gemfile.includes("sinatra")) info.framework = "sinatra";
        }
        info.buildCommand = "bundle exec rake";
        info.testCommand = "bundle exec rspec";
        info.packageManager = "bundler";
        break;
      }
      case "php": {
        if (existsSync(join(cwd, "composer.json"))) {
          const composer = JSON.parse(readFileSync(join(cwd, "composer.json"), "utf-8"));
          const deps = { ...composer.require, ...composer["require-dev"] };
          if (deps["laravel/framework"]) info.framework = "laravel";
          else if (deps["symfony/framework-bundle"]) info.framework = "symfony";
        }
        info.buildCommand = "composer install --no-dev";
        info.testCommand = "vendor/bin/phpunit";
        info.packageManager = "composer";
        break;
      }
      case "dotnet": {
        info.framework = "dotnet";
        info.buildCommand = "dotnet build";
        info.testCommand = "dotnet test";
        info.packageManager = "nuget";
        break;
      }
    }
  } catch (e) {
    console.log(`[ANALYZER] Error detecting ${ecosystem} project: ${e.message}`);
  }

  return info;
}

/**
 * Scan package.json for tech stack detection (Node.js projects).
 */
function detectFromPackageJson(cwd) {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    return {
      name: pkg.name || basename(cwd),
      ecosystem: "node",
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
      } catch (e) {
        console.log(`[ANALYZER] Failed to stat ${fullPath}: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`[ANALYZER] Failed to read directory ${dir}: ${e.message}`);
  }

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
    // Multi-language configs
    ["pyproject.toml", "setup.py", "requirements.txt"],
    ["go.mod"],
    ["Cargo.toml"],
    ["pom.xml", "build.gradle", "build.gradle.kts"],
    ["Gemfile"],
    ["composer.json"],
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
// Export for testing
export { detectEcosystem, detectNonNodeProject, detectFromPackageJson };

export async function analyze(cwd, userPrompt, mode) {
  console.log(`[ANALYZER] Scanning codebase at ${cwd}...`);

  // Phase 1: Local scan — detect ecosystems (Node, Python, Go, Rust, etc.)
  const ecosystems = detectEcosystem(cwd);
  const pkg = detectFromPackageJson(cwd);

  // For non-Node ecosystems, detect project info
  const nonNodeProjects = ecosystems
    .filter(e => e !== "node")
    .map(e => detectNonNodeProject(cwd, e));

  const structure = scanStructure(cwd, 3);
  const configs = detectConfigs(cwd);

  const codebase = {
    exists: pkg !== null || ecosystems.length > 0,
    ecosystems,
    package: pkg,
    nonNodeProjects,
    configs,
    structure: structure.slice(0, 100), // Cap for prompt size
    structureSummary: summarizeStructure(structure),
  };

  const primaryEco = pkg?.framework || nonNodeProjects[0]?.framework || "no framework";
  const primaryLang = pkg?.language || ecosystems[0] || "unknown";
  console.log(`[ANALYZER] Ecosystems: ${ecosystems.join(", ") || "none detected"}`);
  console.log(`[ANALYZER] Detected: ${primaryEco}, ${primaryLang}, ${pkg?.orm || "no orm"}`);
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
  const nonNode = codebase.nonNodeProjects || [];
  const ecoSummary = nonNode.length > 0
    ? nonNode.map(p => `${p.ecosystem}/${p.framework}`).join(", ")
    : "";

  const prompt = `You are a senior architect. Plan this ${mode.toUpperCase()} task on an existing ${pkg?.framework || nonNode[0]?.framework || "unknown"} (${pkg?.language || nonNode[0]?.language || "unknown"}) project.

REQUEST: "${userPrompt}"
PROJECT: ${pkg?.name || nonNode[0]?.name || basename(cwd)} | ORM: ${pkg?.orm || "none"} | Auth: ${pkg?.auth || "none"} | Style: ${pkg?.styling || "css"} | Test: ${pkg?.testing || "none"} | PM: ${pkg?.packageManager || nonNode[0]?.packageManager || "npm"}${ecoSummary ? `\nECOSYSTEMS: ${codebase.ecosystems.join(", ")} (${ecoSummary})` : ""}
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
