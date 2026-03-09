/**
 * Shared constants, defaults, and type-like structures.
 */

export const TaskStatus = {
  PENDING: "pending",
  RUNNING: "running",
  REVIEWING: "reviewing",
  VALIDATING: "validating",
  FIXING: "fixing",
  DONE: "done",
  FAILED: "failed",
  SKIPPED: "skipped",
};

export const PhaseStatus = {
  PENDING: "pending",
  RUNNING: "running",
  GATE_CHECK: "gate_check",
  DONE: "done",
  FAILED: "failed",
};

export const AgentState = {
  UNKNOWN: "unknown",
  WORKING: "working",
  RESPONDING: "responding",
  IDLE: "idle",
  EXITED: "exited",
};

export const OrchestratorMode = {
  BUILD: "build",
  FEATURE: "feature",
  FIX: "fix",
  AUDIT: "audit",
  TEST: "test",
  REVIEW: "review",
  REFACTOR: "refactor",
  EXEC: "exec",
};

export const DEFAULT_CONFIG = {
  // Timeouts (ms)
  turnTimeout: 10 * 60_000,       // 10 min per task turn
  phaseTimeout: 2 * 3600_000,     // 2h per phase
  totalTimeout: 24 * 3600_000,    // 24h max run
  healthCheckInterval: 30_000,     // 30s
  jsonlAppearTimeout: 120_000,     // 2 min
  initialSettleTime: 5_000,        // 5s
  serverStartTimeout: 60_000,      // 1 min

  // Review
  minTaskScore: 7,
  minFinalScore: 8,
  maxReviewCycles: 3,
  maxTaskRetries: 2,

  // Validation
  validationEnabled: true,
  buildCommand: "npm run build",
  testCommand: "npm test",
  devCommand: "npm run dev",
  devServerPort: 3000,
  buildTimeout: 300_000,
  testTimeout: 300_000,
  e2eTimeout: 300_000,
  healthCheckEndpoints: ["/"],
  maxValidationRetries: 1,

  // Dashboard
  dashboardPort: 3111,

  // Interactive prompt rules
  interactiveRules: {
    "Would you like to use TypeScript": "Yes",
    "Would you like to use ESLint": "Yes",
    "Would you like to use Tailwind CSS": "Yes",
    "Would you like to use `src/` directory": "Yes",
    "Would you like to use App Router": "Yes",
    "Would you like to use Turbopack": "No",
    "Would you like to customize the import alias": "No",
    "Select a preset": "saas",
    "Select a theme": "default",
    "Select project type": "web",
    "Select team mode": "multi-tenant",
    "Select billing model": "freemium",
    "Initialize git repository": "y",
    "Packages: +": "y",
    "package manager": "pnpm",
    "Ok to proceed": "y",
    "Need to install the following packages": "y",
    "Is this OK": "y",
    "(y/N)": "y",
    "(Y/n)": "y",
    "Press Enter to continue": "",
    "press ENTER": "",
    "Overwrite": "y",
    "Continue?": "y",
    "Proceed": "y",
  },
};

/** Create a fresh task object */
export function createTask(data) {
  return {
    id: data.id,
    prompt: data.prompt,
    phaseId: data.phaseId || null,
    dependsOn: data.dependsOn || data.depends_on || null,
    validate: data.validate || null,
    status: TaskStatus.PENDING,
    retries: 0,
    maxRetries: data.maxRetries || data.max_retries || 2,
    reviewCycles: 0,
    maxReviewCycles: data.maxReviewCycles || data.max_review_cycles || 3,
    reviewScore: 0,
    error: null,
  };
}

/** Create a fresh phase object */
export function createPhase(data) {
  return {
    id: data.id,
    name: data.name,
    tasks: (data.tasks || []).map(createTask),
    gate: data.gate || { fileChecks: [], commandChecks: [] },
    status: PhaseStatus.PENDING,
  };
}
