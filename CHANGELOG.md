# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.1] - 2026-03-10

### Added
- **VS Code / Cursor extension** (`vscode-extension/`) with:
  - Right-click `.md` files to orchestrate with smart file analysis
  - Automatic mode recommendation based on file content (spec, backlog, status report, bug report, etc.)
  - Item extraction (B1, F2, etc.) with type and priority detection
  - Embedded sidebar dashboard via WebSocket
  - Status bar progress indicator (task count, percentage, cost)
  - Command palette integration for all 8 modes
  - Run history tree view
  - Duplicate run protection -- checks PM2 before starting, requires confirmation
  - Binary resolution: local cli.mjs, global npm, which/where, npx fallback

### Changed
- **Premium dashboard UI overhaul** -- OKLCH color system, Inter + JetBrains Mono typography, 8pt grid spacing tokens, task status chips and score pill badges, hub-and-spoke logo icon, active phase left-accent border, refined 6px progress bar with material easing, split log timestamps, accessible keyboard navigation, ARIA roles, prefers-reduced-motion support, responsive auto-fit grid

### Fixed
- **Cost tracking always showing $0** -- Claude CLI returns cost in `total_cost_usd` field, parser now checks this key first

## [2.2.0] - 2026-03-10

### Added
- **SECURITY.md** -- documents security model, permission modes, and responsible disclosure
- **Cost guidance** in README with per-mode estimates
- **"Why This Tool?"** section and comparison table in README

### Fixed
- **CRITICAL: Command injection** -- sanitized PM2 instance names (cli.mjs), task validation commands (validator.mjs), gate check commands (orchestrator.mjs), and database connection strings (validator.mjs)
- **Plugin validators not invoked** -- custom validators registered via `addValidator()` are now executed during phase validation
- **Mode validators dead code** -- `getValidators()` returns from mode classes are now wired into phase validation
- **Parallel session race condition** -- parallel tasks now use isolated Claude sessions instead of sharing `this.sessionId`
- **CORS wildcard** -- dashboard API now restricts CORS to localhost origins only

### Changed
- Removed dead code: `reviewTask()`, `finalReview()`, `parseReviewJson()` from reviewer.mjs (inline review in orchestrator replaced them)
- Removed unused `optionalDependencies` (`node-pty`, `pg`) from package.json
- `runPhaseValidation()` now accepts optional `pluginRegistry` parameter for end-to-end plugin validator support

## [2.1.0] - 2026-03-10

### Added
- **Rate limiter** for Claude API calls with configurable concurrency, minimum delay, and queue size (`maxConcurrentClaude`, `claudeMinDelayMs`, `claudeMaxQueueSize`)
- **Parallel task execution** -- independent tasks within a phase can run concurrently when `maxConcurrentClaude > 1`
- **Multi-language support** -- automatic ecosystem detection for Node.js, Python, Go, Rust, Java, Ruby, PHP, and .NET projects
- **Dry-run mode** (`--dry-run`) -- generate and display the execution plan without running any tasks
- **Dashboard authentication** via `ORCHESTRATOR_TOKEN` environment variable (Bearer token or query parameter)
- **Plugin system** -- custom validators and lifecycle hooks loaded from project config (`plugins` array)
- **Run history tracking** -- persistent history with success rate statistics shown on dashboard
- **JSONL transcript writer** for structured logging and external reporting
- **Configurable permissions** -- `allowUnsafePermissions` flag to control whether Claude auto-approves or prompts for permission
- **Auto-restart resilience** -- restart counter resets on phase completion; raised max restart limit to 50
- **Phase-level validation** with automatic Playwright E2E test setup when not configured

### Changed
- Improved crash recovery: auto-restart treats non-completed orchestrator exits as crashes
- Supervisor now writes PID file and dev-port file for external watchdog integration
- Config loader supports `.cjs` format in addition to `.mjs` and `.js`
- Build/test commands auto-detected for non-Node ecosystems
- Phase timeout enforced: phases exceeding `phaseTimeout` skip remaining tasks
- Dashboard shows real-time cost tracking and auth support
- Empty catch blocks replaced with descriptive comments (~15 instances)
- Task retry logic resets task status properly for batch retry loops
- Review scores no longer artificially inflated after fix attempts
- `_executeTask` returns false on Claude call failure (enables retries)
- 71 tests across 9 test suites (including orchestrator integration tests)

### Fixed
- Fixed PTY death causing false "completed" status
- Fixed watcher stopping instead of auto-restarting on PTY death
- Fixed race condition in history save (reference to null orchestrator)
- Fixed dashboard not included in npm package (path resolution)
- Fixed cost tracking always showing $0 (accumulator wired in orchestrator)

## [2.0.0] - 2025-03-01

### Changed
- **Full rewrite from PTY-based to headless `claude -p` mode** -- each task is a clean subprocess invocation, eliminating zombie processes and PTY reliability issues
- Session continuity via `claude -p --resume <sessionId>` instead of PTY input injection
- Replaced single-mode build pipeline with **8 specialized modes**: build, feature, fix, audit, test, review, refactor, exec
- New **two-phase analyzer** (local codebase scan + single Claude call) runs before plan generation for non-build modes
- Mode system with `BaseMode` abstract class -- each mode controls plan generation, config overrides, and review behavior
- Checkpoint format updated to include mode, prompt, flags, and session ID

### Added
- `feature` mode -- add features to existing projects with context-aware planning
- `fix` mode -- diagnose and fix bugs from vague descriptions
- `audit` mode -- code audits (security, performance, quality, accessibility) with optional `--fix`
- `test` mode -- run tests, generate missing tests, fix failures
- `review` mode -- comprehensive code review with architecture and security analysis
- `refactor` mode -- refactoring with regression checks
- `exec` mode -- generic prompt execution (catch-all)
- CLI subcommand interface (`claude-orch <mode> "<prompt>"`)
- PM2-based background daemon management (`--status`, `--logs`, `--stop`, `--restart`)
- Project-level config file support (`.orchestrator.config.mjs`)
- Real-time dashboard with WebSocket events
- HTTP API endpoints (`/health`, `/state`, `/logs`, `/restart`, `/stop`)

### Removed
- PTY-based Claude interaction (replaced by headless `-p` mode)
- Python supervisor script (replaced by Node.js `watcher.mjs`)
