# Claude Orchestrator

**Autonomous multi-mode developer tool powered by Claude Code.**

Build entire projects from a spec, add features, fix bugs, run audits, generate tests, review code, refactor — all autonomously with automatic code review, validation, and crash recovery.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org)

---

## What it does

Claude Orchestrator drives [Claude Code](https://docs.anthropic.com/en/docs/claude-code) through phased execution plans. Give it a task — from a full project spec to a vague bug report — and it will:

1. **Analyze** your codebase and request (framework, ORM, auth, styling, structure)
2. **Plan** a multi-phase execution strategy with detailed tasks
3. **Execute** each task via headless `claude -p` with session continuity
4. **Validate** output (build checks, file existence, custom commands)
5. **Review** code quality (score 1-10, auto-fix if rejected)
6. **Recover** from crashes (checkpoint after every task, auto-restart with backoff)

## Modes

| Mode | Command | Description |
|------|---------|-------------|
| **build** | `claude-orch build spec.md` | Full project from spec (24 phases, 0→100) |
| **feature** | `claude-orch feature "add dark mode"` | Add a feature to existing project |
| **fix** | `claude-orch fix "login is broken"` | Diagnose and fix a bug |
| **audit** | `claude-orch audit --type security` | Code audit (security, perf, quality, a11y) |
| **test** | `claude-orch test --fix` | Run/generate tests, fix failures |
| **review** | `claude-orch review` | Comprehensive code review with report |
| **refactor** | `claude-orch refactor "extract auth"` | Code refactoring with regression checks |
| **exec** | `claude-orch exec "update all deps"` | Generic prompt (catch-all) |

## Quick start

### Prerequisites

- **Node.js 18+**
- **Claude Code CLI** installed and authenticated ([install guide](https://docs.anthropic.com/en/docs/claude-code))
- **PM2** for background process management (`npm i -g pm2`)

### Install

```bash
npm install -g claude-orchestrator
```

Or run directly:

```bash
npx claude-orchestrator feature "add Stripe billing" --cwd /path/to/project
```

### Usage

```bash
# Build a full project from a spec file
claude-orch build spec.md

# Add a feature (analyzes your codebase first)
claude-orch feature "add user notifications with email and in-app" --cwd .

# Fix a bug (even vague descriptions work)
claude-orch fix "the login page looks ugly" --cwd .

# Security audit
claude-orch audit --type security --cwd .

# Generate and run tests
claude-orch test --fix --cwd .

# Full code review
claude-orch review --cwd .

# Refactor with regression checks
claude-orch refactor "migrate to App Router" --cwd .

# Any prompt
claude-orch exec "update all dependencies and fix breaking changes" --cwd .
```

### Monitor

```bash
claude-orch --status              # All running instances
claude-orch --logs myproject      # View live progress
claude-orch --stop myproject      # Stop an instance
claude-orch --resume /path/to    # Resume from crash checkpoint
```

Each instance also exposes a real-time **dashboard** at `http://localhost:<port>` with WebSocket updates.

## How it works

```
cli.mjs (subcommand routing)
└── watcher.mjs (supervisor)
    ├── HTTP + WebSocket server (dashboard + API)
    ├── Auto-restart with exponential backoff (5s → 60s)
    └── Orchestrator engine
        ├── Analyzer: scan codebase + interpret request → plan
        ├── Mode system: 8 specialized modes control plan generation
        ├── For each phase:
        │   ├── Execute tasks via claude -p --resume <sessionId>
        │   ├── Validate output (build, files, custom commands)
        │   ├── Review code (score 1-10, auto-fix if < 7)
        │   └── Checkpoint after every task
        ├── Phase-level validation (build, test, e2e)
        └── Final comprehensive review
```

### Smart Analyzer

For non-build modes, the analyzer runs before any code is written:

1. **Local scan** (no Claude call): detects framework, language, ORM, auth, styling, test framework, package manager
2. **Claude analysis** (1 call): interprets the request and produces a phased plan with success criteria

Even vague prompts like *"the login page looks ugly"* become detailed multi-phase plans:
- Phase 1: Diagnose current auth layout and identify issues
- Phase 2: Redesign with branded components and CSS
- Phase 3: Validate build passes after changes

### Session Continuity

All tasks within a run share a single Claude session via `--resume <sessionId>`. This means Claude retains full context of previous work — no redundant file reads or lost context between tasks.

### Crash Recovery

After every task, the orchestrator saves a checkpoint with:
- Current phase and task index
- All phase/task statuses
- Mode, prompt, and flags
- Claude session ID

On crash, auto-restart resumes from the exact task with the same session. The restart counter resets on each completed phase (real progress = not a crash loop).

## Configuration

### CLI Options

```
--cwd <dir>          Project directory (default: current)
--dev-port <port>    Dev server port for validation
--port <port>        Dashboard port
--type <type>        Audit type: security, performance, quality, a11y, full
--fix                Auto-fix issues (audit/test modes)
--no-review          Skip code review step
--max-restarts <n>   Max auto-restarts (default: 50)
--verbose            Verbose logging
```

### HTTP API

Each instance exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Instance health + uptime |
| `/state` | GET | Full orchestrator state |
| `/logs` | GET | Last 200 log entries |
| `/restart` | POST | Restart orchestrator |
| `/stop` | POST | Stop orchestrator |

### WebSocket Events

Connect to `ws://localhost:<port>` for real-time events:

- `plan_ready` — Execution plan generated
- `phase_start` / `phase_done` — Phase lifecycle
- `task_start` / `task_done` — Task lifecycle with scores
- `task_reviewed` — Code review results
- `run_complete` — Final status with task counts
- `error` — Error details

## Architecture

```
claude-orchestrator/
├── watcher/
│   ├── cli.mjs               # Multi-command CLI entry point
│   ├── watcher.mjs            # Supervisor: HTTP + WS + auto-restart
│   └── src/
│       ├── orchestrator.mjs   # Multi-mode execution engine
│       ├── analyzer.mjs       # Codebase + request analyzer
│       ├── planner.mjs        # Mode dispatcher
│       ├── claude-cli.mjs     # Headless claude -p adapter
│       ├── reviewer.mjs       # Code review via pipe mode
│       ├── validator.mjs      # Build, test, e2e validation
│       ├── spec.mjs           # Spec → 24-phase plan (build mode)
│       ├── checkpoint.mjs     # Crash recovery persistence
│       ├── models.mjs         # Constants + type definitions
│       ├── jsonl.mjs          # JSONL transcript monitoring
│       └── modes/
│           ├── base-mode.mjs  # Abstract base class
│           ├── build.mjs      # Full project from spec
│           ├── feature.mjs    # Add feature
│           ├── fix.mjs        # Fix bug
│           ├── audit.mjs      # Code audit
│           ├── test.mjs       # Testing
│           ├── review.mjs     # Code review
│           ├── refactor.mjs   # Refactoring
│           └── exec.mjs       # Generic prompt
├── dashboard/
│   └── static/
│       └── index.html         # Real-time monitoring dashboard
├── spec.example.md            # Example spec file
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
- Framework: Next.js with NextSpark
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

## Mode Details

### Build Mode (0→100)

Runs 24 predefined phases from scaffolding to launch assets:

Scaffold → Database → Auth → Core API → Payments → Frontend → Onboarding → Integration → UX Polish → Seed Data → Landing Page → SEO → Legal → Email → Analytics → Security → Support → Testing → Screenshots → Performance → CI/CD → Deploy → Launch Assets

### Feature / Fix / Refactor

The analyzer scans your codebase and creates a context-aware plan:

```
$ claude-orch feature "add appointment scheduling with calendar" --cwd .

[ANALYZER] Detected: next.js, typescript, drizzle
[ANALYZER] Analyzing request with Claude (mode: feature)...

Plan: 5 phases, 13 tasks
  P1: API & Service Layer for Scheduling (3 tasks)
  P2: Calendar Components (2 tasks)
  P3: Time Slot & Confirmation UI (4 tasks)
  P4: Page Integration & Navigation (2 tasks)
  P5: Tests (2 tasks)
```

### Audit / Review

Read-only analysis modes that skip build validation:

- **Audit**: Scans for security vulnerabilities, performance issues, code quality problems
- **Review**: Comprehensive architecture, code quality, and security review

Both generate detailed reports without modifying your code (unless `--fix` is used with audit).

## Platform Notes

- **Windows**: Claude CLI at `~/.claude/local/claude.exe` or on PATH
- **Linux/Mac**: Claude CLI on PATH
- Requires Node.js 18+ and PM2 for background execution
- Each `claude -p` invocation is a clean subprocess — no PTY, no zombie processes

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

[MIT](LICENSE) — Federico González
