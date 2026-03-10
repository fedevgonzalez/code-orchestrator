# Contributing to Code Orchestrator

Contributions are welcome. This guide covers development setup, code conventions, and the PR process.

## Development Setup

```bash
git clone https://github.com/fedevgonzalez/code-orchestrator.git
cd code-orchestrator/watcher
npm install
```

**Prerequisites:**

- Node.js >= 18
- Claude Code CLI installed and authenticated (`claude --version`)
- PM2 installed globally for integration testing (`npm i -g pm2`)

## Running Tests

Tests use Jest with ESM modules. All test files live in `watcher/tests/`.

```bash
cd watcher

# Run all tests
node --experimental-vm-modules ./node_modules/jest/bin/jest.js

# Or via npm script
npm test

# Watch mode
npm run test:watch
```

The `--experimental-vm-modules` flag is required because the project uses native ESM (`.mjs` files).

## Code Style

- **ESM modules** -- use `.mjs` file extension with `import`/`export` syntax
- **No TypeScript** -- plain JavaScript only. Use JSDoc comments for type documentation where it helps readability
- **Small functions** -- keep functions focused and under ~50 lines where practical
- **Log prefixes** -- use `[MODULE_NAME]` prefixes in all console output for easy filtering (e.g., `[ORCH]`, `[VALIDATE]`, `[PLUGIN]`)
- **No build step** -- the project runs directly from source with Node.js

## Project Structure

```
watcher/                         # Core CLI + engine (npm package: code-orchestrator)
  cli.mjs                        # CLI entry point, subcommand routing, PM2 daemon
  watcher.mjs                    # Supervisor: HTTP/WS server, auto-restart loop
  watchdog.mjs                   # System watchdog (reboot recovery)
  dashboard/index.html           # Real-time monitoring dashboard
  src/
    orchestrator.mjs             # Core execution engine (phase/task loop)
    analyzer.mjs                 # Two-phase codebase analyzer (local scan + Claude)
    claude-cli.mjs               # Headless claude -p adapter with cost tracking
    reviewer.mjs                 # Code review via Claude pipe mode
    validator.mjs                # Phase validators (build, test, e2e, custom)
    checkpoint.mjs               # Atomic checkpoint save/load for crash recovery
    rate-limiter.mjs             # Rate limiter for Claude API calls
    config.mjs                   # Project config loader
    plugins.mjs                  # Plugin registry (validators + hooks)
    history.mjs                  # Run history tracking
    planner.mjs                  # Mode dispatcher
    models.mjs                   # Constants, enums, defaults
    jsonl.mjs                    # JSONL transcript writer
    spec.mjs                     # Spec parser for build mode (24-phase pipeline)
    modes/                       # 8 execution modes
  tests/                         # Jest test files
vscode-extension/                # VS Code / Cursor extension (TypeScript)
  src/
    extension.ts                 # Extension entry, commands, webview dashboard
    file-analyzer.ts             # Smart .md analyzer (mode + prompt generation)
    runner.ts                    # CLI runner with binary resolution
    status-bar.ts                # Status bar progress indicator
    run-history.ts               # Run history tree view
```

### Developing the VS Code Extension

```bash
cd vscode-extension
npm install
npm run compile          # Build TypeScript
npx @vscode/vsce package # Create .vsix
# Install in VS Code/Cursor: Extensions > ... > Install from VSIX
```

## How to Add a New Mode

1. Create `watcher/src/modes/your-mode.mjs` that extends `BaseMode` from `base-mode.mjs`:

```js
import { BaseMode } from "./base-mode.mjs";

export class YourMode extends BaseMode {
  constructor(opts) {
    super(opts);
    // Mode-specific initialization
  }

  async buildPlan(analysis) {
    // Return { phases: [...], specText: "", analysis }
    // Each phase has: id, name, tasks[], gate
    // Each task has: id, prompt, dependsOn, validate
  }

  getConfigOverrides() {
    // Return config overrides for this mode (e.g., skip validation)
    return {};
  }

  // Optional: control review behavior
  get runTaskReview() { return true; }
  get runFinalReview() { return true; }
  get skipPhaseValidation() { return false; }
}
```

2. Register the mode in `watcher/src/planner.mjs`:

```js
import { YourMode } from "./modes/your-mode.mjs";

const MODE_CLASSES = {
  // ... existing modes
  [OrchestratorMode.YOUR_MODE]: YourMode,
};
```

3. Add the mode constant to `OrchestratorMode` in `watcher/src/models.mjs`:

```js
export const OrchestratorMode = {
  // ... existing modes
  YOUR_MODE: "your-mode",
};
```

4. Add the mode to the `MODES` array in `watcher/cli.mjs`.

5. Add tests in `watcher/tests/`.

## How to Write a Plugin

Plugins are loaded from the `plugins` array in the project config file. Each plugin exports a `register` function that receives a `PluginRegistry` instance.

```js
// my-plugin.mjs
export function register(orch) {
  // Register a custom validator
  orch.addValidator("my-check", async (cwd, config) => {
    // Perform validation
    return {
      type: "my-check",
      ok: true,           // true if validation passed
      message: "All good",
      output: "",          // optional: command output for debugging
    };
  });

  // Register lifecycle hooks
  orch.addHook("afterTask", (task, phase) => {
    console.log(`[MY-PLUGIN] Task ${task.id} scored ${task.reviewScore}`);
  });

  orch.addHook("beforePhaseValidation", (phase, phaseIdx) => {
    console.log(`[MY-PLUGIN] About to validate phase ${phase.id}`);
  });
}
```

Register in your project config:

```js
// .orchestrator.config.mjs
export default {
  plugins: ["./my-plugin.mjs"],
};
```

Available hook events: `beforeRun`, `afterRun`, `beforePhase`, `afterPhase`, `beforeTask`, `afterTask`, `beforePhaseValidation`, `onValidationFail`, `onReviewComplete`, `onEvent`.

## Pull Request Process

1. Fork the repository and create a feature branch from `master`
2. Make your changes
3. Add or update tests as needed
4. Run the test suite and confirm all tests pass: `npm test`
5. Open a pull request with a clear description of what changed and why

## Reporting Issues

Open an issue at https://github.com/fedevgonzalez/code-orchestrator/issues with:

- Steps to reproduce the problem
- Expected vs. actual behavior
- Node.js version and operating system
- Relevant log output (from `code-orch --logs`)
