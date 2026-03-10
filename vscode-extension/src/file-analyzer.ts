import * as fs from "fs";

interface AnalysisResult {
  mode: string;
  modeLabel: string;
  prompt: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  items: AnalyzedItem[];
}

interface AnalyzedItem {
  id: string;
  title: string;
  type: "bug" | "feature" | "task" | "refactor" | "test";
  priority: "critical" | "high" | "medium" | "low";
}

/**
 * Analyze a file's content to determine the best orchestration strategy.
 * Uses heuristics on the file structure and content to pick mode + generate prompt.
 */
export function analyzeFile(filePath: string): AnalysisResult {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const lower = content.toLowerCase();
  const fileName = filePath.split(/[/\\]/).pop() || "file";

  const items = extractItems(content);
  const bugs = items.filter((i) => i.type === "bug");
  const features = items.filter((i) => i.type === "feature");
  const tasks = items.filter((i) => i.type === "task");
  const refactors = items.filter((i) => i.type === "refactor");
  const tests = items.filter((i) => i.type === "test");

  // Detect file type patterns
  const isSpec = /spec|specification|prd|requirements/i.test(fileName) || /^#\s*(spec|specification|prd)/im.test(content);
  const isBacklog = /backlog|todo|tasks|issues|tickets/i.test(fileName) || /^#.*backlog/im.test(content);
  const isStatusReport = /status.report|mvp.status|audit.report/i.test(fileName);
  const isBugReport = /bug|error|issue|incident/i.test(fileName) && bugs.length > 0;
  const isTestPlan = /test.plan|test.cases|testing/i.test(fileName);
  const isRefactorPlan = /refactor|cleanup|tech.debt/i.test(fileName);
  const isChangelog = /changelog|changes|release.notes/i.test(fileName);

  // Count signal words
  const bugSignals = countMatches(lower, /\b(bug|fix|error|broken|crash|fail|issue|defect|regression)\b/g);
  const featureSignals = countMatches(lower, /\b(feature|implement|add|create|build|new|support|enable)\b/g);
  const reviewSignals = countMatches(lower, /\b(review|audit|check|verify|validate|inspect|assess|evaluate)\b/g);
  const refactorSignals = countMatches(lower, /\b(refactor|cleanup|simplify|extract|rename|reorganize|tech.debt)\b/g);
  const testSignals = countMatches(lower, /\b(test|spec|coverage|assert|expect|mock|e2e|integration|unit)\b/g);

  // Detect priority markers
  const hasCritical = /\b(p0|critical|blocker|urgent|asap)\b/i.test(content);
  const hasStatusColumn = /\bstatus\b.*\b(done|partial|missing|todo|pending)\b/i.test(content);
  const hasTable = content.includes("|") && content.includes("---");

  // Decision logic
  let mode: string;
  let modeLabel: string;
  let prompt: string;
  let summary: string;
  let confidence: "high" | "medium" | "low";

  if (isSpec) {
    mode = "build";
    modeLabel = "Build from Spec";
    prompt = filePath;
    summary = `Spec file detected with ${items.length} items. Will build the full project from this specification.`;
    confidence = "high";
  } else if (isStatusReport && hasStatusColumn) {
    // Status report with done/partial/missing — implement what's left
    const missing = items.filter((i) => i.priority === "critical" || i.priority === "high");
    mode = "exec";
    modeLabel = "Implement from Status Report";
    prompt = buildImplementPrompt(fileName, filePath, items, bugs, features);
    summary = `Status report with ${items.length} items (${bugs.length} bugs, ${features.length} features). ${missing.length} high-priority items to implement.`;
    confidence = "high";
  } else if (isBacklog) {
    if (bugs.length > features.length && bugs.length > 0) {
      mode = "fix";
      modeLabel = "Fix Bugs from Backlog";
      prompt = buildFixPrompt(fileName, filePath, bugs);
      summary = `Backlog with ${bugs.length} bugs and ${features.length} features. Prioritizing bug fixes first.`;
      confidence = "high";
    } else if (features.length > 0) {
      mode = "exec";
      modeLabel = "Build from Backlog";
      prompt = buildImplementPrompt(fileName, filePath, items, bugs, features);
      summary = `Backlog with ${items.length} items (${bugs.length} bugs, ${features.length} features). Will implement in priority order.`;
      confidence = "high";
    } else {
      mode = "exec";
      modeLabel = "Execute Backlog";
      prompt = `Read ${fileName} at ${filePath} and implement all items described. Work through them in the order listed, starting with the highest priority items.`;
      summary = `Backlog detected with ${items.length} items.`;
      confidence = "medium";
    }
  } else if (isBugReport || bugSignals > featureSignals * 2) {
    mode = "fix";
    modeLabel = "Fix Issues";
    prompt = buildFixPrompt(fileName, filePath, bugs.length > 0 ? bugs : items);
    summary = `${bugs.length || items.length} issues/bugs detected. Will fix in priority order.`;
    confidence = bugs.length > 0 ? "high" : "medium";
  } else if (isTestPlan || testSignals > featureSignals) {
    mode = "test";
    modeLabel = "Generate Tests";
    prompt = `Read ${fileName} at ${filePath} and generate all test cases described. Create comprehensive test files with proper assertions, mocks, and edge cases.`;
    summary = `Test plan detected with ${tests.length || items.length} test items.`;
    confidence = "medium";
  } else if (isRefactorPlan || refactorSignals > featureSignals) {
    mode = "refactor";
    modeLabel = "Refactor";
    prompt = `Read ${fileName} at ${filePath} and execute all refactoring tasks described. Follow the plan carefully, preserving existing behavior while improving code quality.`;
    summary = `Refactor plan with ${refactors.length || items.length} items.`;
    confidence = "medium";
  } else if (reviewSignals > featureSignals && reviewSignals > bugSignals) {
    mode = "review";
    modeLabel = "Review Code";
    prompt = `Read ${fileName} at ${filePath} and review the codebase as described. Produce a detailed report with findings, severity levels, and recommended fixes.`;
    summary = `Review/audit request detected.`;
    confidence = "medium";
  } else if (featureSignals > 0 || features.length > 0) {
    mode = "exec";
    modeLabel = "Implement Features";
    prompt = buildImplementPrompt(fileName, filePath, items, bugs, features);
    summary = `${features.length} features and ${bugs.length} bugs detected. Will implement all items.`;
    confidence = features.length > 0 ? "high" : "medium";
  } else {
    // Fallback: generic exec with the file as context
    mode = "exec";
    modeLabel = "Execute Plan";
    prompt = `Read ${fileName} at ${filePath} and execute all tasks, items, and changes described in it. Work through them systematically in the order presented.`;
    summary = `General plan detected with ${items.length} items. Will execute all tasks described.`;
    confidence = "low";
  }

  return { mode, modeLabel, prompt, summary, confidence, items };
}

function buildImplementPrompt(
  fileName: string,
  filePath: string,
  items: AnalyzedItem[],
  bugs: AnalyzedItem[],
  features: AnalyzedItem[]
): string {
  const parts = [`Read ${fileName} at ${filePath} and implement ALL items described.`];

  if (bugs.length > 0) {
    const critical = bugs.filter((b) => b.priority === "critical");
    if (critical.length > 0) {
      parts.push(`Start with ${critical.length} critical bugs: ${critical.map((b) => b.id).join(", ")}.`);
    } else {
      parts.push(`Fix ${bugs.length} bugs first: ${bugs.map((b) => b.id).join(", ")}.`);
    }
  }

  if (features.length > 0) {
    parts.push(`Then implement ${features.length} features: ${features.map((f) => f.id).join(", ")}.`);
  }

  parts.push("Follow the exact file paths, line numbers, and changes described in the document. Create migrations, components, and update existing files as needed.");

  return parts.join(" ");
}

function buildFixPrompt(
  fileName: string,
  filePath: string,
  bugs: AnalyzedItem[]
): string {
  const ids = bugs.map((b) => b.id).join(", ");
  return `Read ${fileName} at ${filePath} and fix all bugs/issues described: ${ids}. Follow the exact file paths and changes specified for each item.`;
}

function extractItems(content: string): AnalyzedItem[] {
  const items: AnalyzedItem[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match patterns like: B1, B2, F1, F2, T1, etc. in tables or lists
    const tableMatch = line.match(/\|\s*(B\d+[a-z]?|F\d+[a-z]?|T\d+|R\d+|#\d+)\s*\|/i);
    const listMatch = line.match(/^[\s*-]*\*?\*?(B\d+[a-z]?|F\d+[a-z]?|T\d+|R\d+)\*?\*?\s*[:\-–—|]/i);
    const headerMatch = line.match(/^#{1,4}\s*.*?(B\d+[a-z]?|F\d+[a-z]?|T\d+|R\d+)/i);

    const match = tableMatch || listMatch || headerMatch;
    if (!match) continue;

    const id = match[1].toUpperCase();
    if (items.some((i) => i.id === id)) continue;

    // Determine type from ID prefix
    let type: AnalyzedItem["type"] = "task";
    if (id.startsWith("B")) type = "bug";
    else if (id.startsWith("F")) type = "feature";
    else if (id.startsWith("T")) type = "test";
    else if (id.startsWith("R")) type = "refactor";

    // Extract title from the line
    const titleMatch = line.match(/\|\s*[^|]+\|\s*([^|]+)/);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 80) : line.slice(0, 80).trim();

    // Determine priority
    let priority: AnalyzedItem["priority"] = "medium";
    const lowerLine = line.toLowerCase();
    if (/\b(p0|critical|blocker)\b/.test(lowerLine)) priority = "critical";
    else if (/\b(p1|high|missing)\b/.test(lowerLine)) priority = "high";
    else if (/\b(p2|medium|partial)\b/.test(lowerLine)) priority = "medium";
    else if (/\b(p3|low|nice.to.have|done)\b/.test(lowerLine)) priority = "low";
    // Bugs default to high, features to medium
    else if (type === "bug") priority = "high";

    items.push({ id, title, type, priority });
  }

  return items;
}

function countMatches(text: string, regex: RegExp): number {
  return (text.match(regex) || []).length;
}
