# Claude Orchestrator

**Give Claude a spec. Get a reviewed codebase back.**

Claude Orchestrator turns Claude Code into an autonomous multi-phase build system. It analyzes your project, generates a phased execution plan, runs each task via `claude -p`, self-reviews and scores every output, auto-fixes failures, and validates the result -- all with crash recovery and real-time monitoring.

[![CI](https://github.com/fedevgonzalez/claude-orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/fedevgonzalez/claude-orchestrator/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/claude-orchestrator)](https://www.npmjs.com/package/claude-orchestrator)

---

## Why This Tool?

Claude Code is powerful, but for large tasks it needs structure: phased plans, automatic validation, crash recovery, and self-review. Claude Orchestrator provides that structure.

| | Claude Code (raw) | Claude Orchestrator |
|---|---|---|
| Execution | Single prompt | Multi-phase plan with dependencies |
| Review | Manual | Auto-review + scoring (1-10) + auto-fix |
| Crash recovery | None | Checkpoint after every task, auto-restart |
| Validation | Manual | Build, test, E2E, custom validators per phase |
| Monitoring | Terminal output | Real-time WebSocket dashboard |
| Modes | General purpose | 8 specialized modes (build, fix, audit...) |

## Key Features

- **8 execution modes** -- build, feature, fix, audit, test, review, refactor, exec
- **Automatic code review** -- every task is reviewed and scored (1-10), auto-fixed if below threshold
- **Crash recovery** -- checkpoint after every task, auto-restart with exponential backoff
- **Multi-language support** -- Node.js, Python, Go, Rust, Java, Ruby, PHP, .NET
- **Parallel task execution** -- independent tasks can run concurrently when configured
- **Real-time dashboard** -- WebSocket-powered monitoring UI with live phase/task progress
- **Plugin system** -- custom validators and lifecycle hooks via project config
- **Dry-run mode** -- preview the generated plan without executing anything

## How It Works

For each run, the orchestrator follows this pipeline:

```
Analyze --> Plan --> Execute --> Review --> Validate
```

1. **Analyze** -- scans your codebase (framework, ORM, auth, styling, structure) and interprets the request
2. **Plan** -- generates a multi-phase execution plan with ordered tasks and dependencies
3. **Execute** -- runs each task via headless `claude -p` with session continuity (`--resume`)
4. **Review** -- self-reviews each task output (score 1-10), auto-fixes if score < 7
5. **Validate** -- runs build checks, test suites, file existence checks, and custom commands per phase

Crash recovery saves a checkpoint after every task. On failure, the supervisor auto-restarts from the exact point of interruption with exponential backoff (5s to 60s). The restart counter resets whenever a phase completes successfully.

## Quick Start

### Prerequisites

- **Node.js 18+**
- **Claude Code CLI** installed and authenticated ([install guide](https://docs.anthropic.com/en/docs/claude-code))
- **PM2** for background process management (`npm i -g pm2`)

### Install

```bash
npm install -g claude-orchestrator
```

Or run directly with npx:

```bash
npx claude-orchestrator feature "add dark mode" --cwd /path/to/project
```

### Usage by Mode

**Build** -- create a full project from a spec file (24 phases, from scaffolding to deployment):

```bash
claude-orch build spec.md
```

**Feature** -- add a feature to an existing project:

```bash
claude-orch feature "add Stripe billing with free/pro tiers" --cwd .
```

**Fix** -- diagnose and fix a bug (even vague descriptions work):

```bash
claude-orch fix "users can't reset their password" --cwd .
```

**Audit** -- run a code audit (security, performance, quality, accessibility):

```bash
claude-orch audit --type security --cwd .
claude-orch audit --fix --cwd .          # audit + auto-fix
```

**Test** -- run tests, generate missing tests, fix failures:

```bash
claude-orch test --fix --cwd .
```

**Review** -- comprehensive code review with detailed report:

```bash
claude-orch review --cwd .
```

**Refactor** -- refactor code with regression checks:

```bash
claude-orch refactor "extract auth into a standalone service" --cwd .
```

**Exec** -- generic prompt (catch-all for anything else):

```bash
claude-orch exec "update all dependencies and fix breaking changes" --cwd .
```

### Dry Run

Preview the execution plan without running any tasks:

```bash
claude-orch feature "add notifications" --cwd . --dry-run
```

### Monitor Running Instances

```bash
claude-orch --status              # list all running instances
claude-orch --logs myproject      # view live progress
claude-orch --stop myproject      # stop an instance
claude-orch --stop-all            # stop everything
claude-orch --restart myproject   # restart an instance
claude-orch --resume /path/to    # resume from checkpoint
```

### Auto-Recovery (Watchdog)

Install the system watchdog so orchestrator processes automatically restart after a reboot or crash:

```bash
claude-orch --install-watchdog    # register system-level auto-recovery
claude-orch --watchdog-status     # check if watchdog is active
claude-orch --uninstall-watchdog  # remove the watchdog
```

On Windows this creates a scheduled task that runs on logon. On Linux/macOS it adds a cron job (every 10 minutes). The watchdog calls `pm2 resurrect` to restore any saved orchestrator processes.

## Configuration

### Project Config File

Create `.orchestrator.config.mjs` (or `.orchestrator.config.js`) in your project root to customize behavior:

```js
export default {
  // Build and dev commands
  buildCommand: "pnpm run build",
  devCommand: "pnpm run dev",
  testCommand: "pnpm test",
  devServerPort: 5173,

  // Timeouts
  turnTimeout: 15 * 60_000,       // 15 min per task
  phaseTimeout: 2 * 3600_000,     // 2h per phase
  totalTimeout: 24 * 3600_000,    // 24h max run

  // Review thresholds
  minTaskScore: 7,                // minimum score to pass review
  maxReviewCycles: 2,             // max review iterations per task

  // Rate limiting / parallelism
  maxConcurrentClaude: 1,         // set > 1 for parallel task execution
  claudeMinDelayMs: 1000,         // minimum delay between Claude calls

  // Permissions
  allowUnsafePermissions: true,   // false = Claude will prompt for permission

  // Plugins
  plugins: ["./my-validator.mjs"],
};
```

Config files are searched in this order: `.orchestrator.config.mjs`, `.orchestrator.config.js`, `.orchestrator.config.cjs`, `orchestrator.config.mjs`, `orchestrator.config.js`.

### CLI Reference

**Subcommands:**

| Command | Description |
|---------|-------------|
| `build <spec.md>` | Build a full project from a markdown spec |
| `feature "<description>"` | Add a feature to an existing project |
| `fix "<description>"` | Diagnose and fix a bug |
| `audit` | Run a code audit |
| `test` | Run and generate tests |
| `review` | Full code review |
| `refactor "<description>"` | Refactor code |
| `exec "<prompt>"` | Execute any prompt |

**Flags:**

| Flag | Description |
|------|-------------|
| `--cwd <dir>` | Project directory (default: current directory) |
| `--dry-run` | Generate the plan without executing tasks |
| `--no-review` | Skip the code review step after each task |
| `--fix` | Auto-fix issues found during audit or test modes |
| `--type <type>` | Audit type: `security`, `performance`, `quality`, `a11y`, `full` |
| `--dev-port <port>` | Dev server port for validation (default: auto-assigned) |
| `--port <port>` | Dashboard HTTP port (default: auto-assigned from 3111) |
| `--max-restarts <n>` | Maximum auto-restart attempts (default: 50) |
| `--verbose` | Enable verbose logging |

**Management flags:**

| Flag | Description |
|------|-------------|
| `--status` | Show all running orchestrator instances |
| `--logs [name]` | View logs for an instance |
| `--stop [name]` | Stop an instance |
| `--stop-all` | Stop all instances |
| `--restart [name]` | Restart an instance |
| `--resume <project-dir>` | Resume from a saved checkpoint |
| `--install-watchdog` | Register system watchdog for auto-recovery after reboot |
| `--uninstall-watchdog` | Remove the system watchdog |
| `--watchdog-status` | Check if watchdog is active |

## Dashboard

Each orchestrator instance serves a real-time monitoring dashboard over HTTP. The default port is auto-assigned starting from 3111.

```
http://localhost:3111
```

<!-- TODO: Add dashboard screenshot -->

The dashboard shows live phase/task progress, log output, and review scores via WebSocket.

### Dashboard Authentication

Set the `ORCHESTRATOR_TOKEN` environment variable to require authentication:

```bash
export ORCHESTRATOR_TOKEN=my-secret-token
```

When set, all dashboard and API requests must include the token:

- Query parameter: `?token=my-secret-token`
- Header: `Authorization: Bearer my-secret-token`
- WebSocket: `ws://localhost:3111?token=my-secret-token`

The `/health` endpoint is always accessible without authentication.

### HTTP API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML |
| `/health` | GET | Instance health and uptime (no auth required) |
| `/state` | GET | Full orchestrator state, phases, history |
| `/logs` | GET | Last 200 log entries |
| `/restart` | POST | Restart the orchestrator |
| `/stop` | POST | Stop the orchestrator |

### WebSocket Events

Connect to `ws://localhost:<port>` for real-time events:

- `initial_state` -- sent on connection with current state
- `plan_ready` -- execution plan generated
- `phase_start` / `phase_done` -- phase lifecycle
- `task_start` / `task_done` -- task lifecycle with review scores
- `task_reviewed` -- code review results (score, approved, issues)
- `state_update` -- full state sync on key events
- `orchestrator_restarting` / `orchestrator_completed` -- supervisor events
- `run_complete` -- final status with task counts and elapsed time
- `error` -- error details

## Plugin System

Plugins add custom validators and lifecycle hooks. Create a plugin file that exports a `register` function:

```js
// my-validator.mjs
export function register(orch) {
  // Add a custom validator (runs during phase validation)
  orch.addValidator("my-check", async (cwd, config) => {
    // Run your checks here
    return { type: "my-check", ok: true, message: "All checks passed" };
  });

  // Add a lifecycle hook
  orch.addHook("afterTask", (task, phase) => {
    console.log(`Task ${task.id} completed with score ${task.reviewScore}`);
  });
}
```

Register plugins in your project config:

```js
// .orchestrator.config.mjs
export default {
  plugins: ["./my-validator.mjs"],
};
```

### Available Hook Events

| Hook | Arguments | Description |
|------|-----------|-------------|
| `beforeRun` | `(orchestrator)` | Before orchestration starts |
| `afterRun` | `(orchestrator, status)` | After orchestration ends |
| `beforePhase` | `(phase, phaseIdx)` | Before a phase starts |
| `afterPhase` | `(phase, phaseIdx)` | After a phase completes |
| `beforeTask` | `(task, phase)` | Before a task starts |
| `afterTask` | `(task, phase)` | After a task completes |
| `beforePhaseValidation` | `(phase, phaseIdx)` | Before phase validation runs |
| `onValidationFail` | `(result, phase)` | When a validation check fails |
| `onReviewComplete` | `(task, review)` | When a task review finishes |
| `onEvent` | `(event)` | All orchestrator events |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ORCHESTRATOR_TOKEN` | Dashboard and API authentication token. When set, all requests (except `/health`) require this token. |

## Multi-Language Support

The analyzer automatically detects your project's ecosystem and adjusts build/test/dev commands accordingly. Supported ecosystems:

| Ecosystem | Detection | Default Build | Default Test |
|-----------|-----------|---------------|--------------|
| **Node.js** | `package.json` | `npm run build` | `npm test` |
| **Python** | `pyproject.toml`, `requirements.txt`, `setup.py`, `Pipfile` | varies | `pytest` |
| **Go** | `go.mod` | `go build ./...` | `go test ./...` |
| **Rust** | `Cargo.toml` | `cargo build` | `cargo test` |
| **Java** | `pom.xml`, `build.gradle`, `build.gradle.kts` | `mvn package` / `gradle build` | `mvn test` / `gradle test` |
| **Ruby** | `Gemfile` | `bundle exec rake` | `bundle exec rspec` |
| **PHP** | `composer.json` | `composer install` | `vendor/bin/phpunit` |
| **.NET** | `*.csproj`, `*.sln` | `dotnet build` | `dotnet test` |

Override any detected command in your `.orchestrator.config.mjs`.

## Architecture Overview

```
claude-orchestrator/
├── watcher/
│   ├── cli.mjs                  # CLI entry point, subcommand routing, PM2 daemon management
│   ├── watcher.mjs              # Supervisor: HTTP/WS server, auto-restart, lifecycle
│   ├── package.json
│   └── src/
│       ├── orchestrator.mjs     # Core execution engine (phase/task loop)
│       ├── analyzer.mjs         # Two-phase codebase analyzer (local scan + Claude)
│       ├── planner.mjs          # Mode dispatcher
│       ├── claude-cli.mjs       # Headless claude -p adapter
│       ├── reviewer.mjs         # Code review via Claude pipe mode
│       ├── validator.mjs        # Build, test, e2e, custom validation
│       ├── spec.mjs             # Spec-to-plan converter (24-phase build pipeline)
│       ├── checkpoint.mjs       # Atomic checkpoint save/load for crash recovery
│       ├── rate-limiter.mjs     # Rate limiter for Claude API calls
│       ├── config.mjs           # Project config loader and merger
│       ├── plugins.mjs          # Plugin registry (validators + hooks)
│       ├── history.mjs          # Run history tracking and stats
│       ├── models.mjs           # Constants, enums, factory functions
│       ├── jsonl.mjs            # JSONL transcript writer
│       └── modes/
│           ├── base-mode.mjs    # Abstract base class for all modes
│           ├── build.mjs        # Full project from spec (24 phases)
│           ├── feature.mjs      # Add feature
│           ├── fix.mjs          # Fix bug
│           ├── audit.mjs        # Code audit
│           ├── test.mjs         # Testing
│           ├── review.mjs       # Code review
│           ├── refactor.mjs     # Refactoring
│           └── exec.mjs         # Generic prompt
├── dashboard/
│   └── static/
│       └── index.html           # Real-time monitoring dashboard
├── spec.example.md              # Example spec file for build mode
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Writing a Spec File

For `build` mode, create a markdown spec describing your project:

```markdown
# My SaaS App

## Overview
A project management tool for small teams.

## Tech Stack
- Framework: Next.js 14 with App Router
- Database: PostgreSQL with Drizzle ORM
- Auth: Better Auth with Google OAuth
- Payments: Stripe

## Entities
- Project: name, description, status, owner
- Task: title, description, priority, assignee, project
- Comment: text, author, task

## Features
- Dashboard with project overview and task board
- Kanban board with drag-and-drop
- Team member invitations via email
- Real-time notifications
- Stripe billing with free/pro/enterprise tiers
```

See [spec.example.md](spec.example.md) for a complete example.

## Platform Notes

- **Windows**: Claude CLI resolved at `~/.claude/local/claude.exe` or via PATH
- **Linux/macOS**: Claude CLI resolved via PATH
- Each `claude -p` invocation is a clean subprocess -- no PTY, no zombie processes
- PM2 is used for background process management and log persistence

## Cost Guidance

Claude Orchestrator calls `claude -p` for each task, review, and fix attempt. Costs depend on the mode and project complexity:

| Mode | Typical Claude Calls | Estimated Cost Range |
|------|---------------------|---------------------|
| `fix` (simple bug) | 3-8 | $0.10 - $0.50 |
| `feature` (medium) | 10-25 | $0.50 - $2.00 |
| `audit` | 5-15 | $0.30 - $1.50 |
| `build` (full project) | 50-200+ | $5.00 - $30.00+ |

Use `--dry-run` to preview the plan and estimate calls before executing. The dashboard shows real-time cost tracking during execution.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and what's coming next.

## Security

See [SECURITY.md](SECURITY.md) for the security model, permission modes, and responsible disclosure policy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

## License

[MIT](LICENSE)
