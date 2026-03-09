# Claude Orchestrator v2 — Project Brief

## What is this?

A Node.js CLI tool that orchestrates Claude Code sessions autonomously. It works
as a **multi-mode developer tool** — not just a project builder, but a complete
development assistant that can build, fix, audit, test, review, and refactor code.

It drives Claude Code through phased execution using headless `claude -p` (pipe
mode), with automatic code review, validation, and crash recovery.

## Modes

| Mode | Description | Example |
|------|-------------|---------|
| `build` | Full project from spec (24 phases, 0→100) | `node cli.mjs build spec.md` |
| `feature` | Add a feature to existing project | `node cli.mjs feature "add dark mode"` |
| `fix` | Diagnose and fix a bug | `node cli.mjs fix "login is broken"` |
| `audit` | Code audit (security, perf, quality) | `node cli.mjs audit --type security` |
| `test` | Run/generate tests, fix failures | `node cli.mjs test --fix` |
| `review` | Full code review with report | `node cli.mjs review` |
| `refactor` | Code refactoring with regression checks | `node cli.mjs refactor "extract auth"` |
| `exec` | Generic prompt (catch-all) | `node cli.mjs exec "update all deps"` |

## How it works

```
cli.mjs (subcommand routing)
└── watcher.mjs (supervisor)
    ├── HTTP + WebSocket server for dashboard / monitoring
    ├── Auto-restart with exponential backoff on crash
    └── Spawns Orchestrator engine
        └── orchestrator.mjs
            ├── [build mode] Parse spec → 24-phase plan (spec.mjs)
            ├── [other modes] Analyze codebase + request → smart plan (analyzer.mjs)
            ├── For each phase:
            │   ├── Execute tasks via `claude -p --resume <sessionId>`
            │   ├── Validate output (file checks, build, lint, DB, e2e)
            │   ├── Self-review via same Claude session
            │   ├── Fix rejected code automatically
            │   └── Gate check (required files, commands)
            ├── Final comprehensive review (if mode enables it)
            └── Checkpoint after every task for crash recovery
```

## Smart Analyzer

For non-build modes, before any code is written the analyzer:

1. **Scans the codebase locally** (no Claude call): detects framework, language,
   ORM, auth, styling, test framework, package manager, directory structure
2. **Calls Claude once** with the codebase summary + user request to produce:
   - Interpreted request (even if vague)
   - Affected files/areas
   - Phased execution plan with detailed tasks
   - Success criteria and validation strategy

Example: "the login page looks ugly" becomes:
- Phase 1: Diagnose (read current auth layout, identify Boilerplate branding)
- Phase 2: Override (create themed layout, add CSS variables, brand login page)
- Phase 3: Validate (rebuild registries, run build, verify in browser)
- Success: branded login, warm gradient, dark mode works, SSO unchanged

## Architecture

### Headless Claude CLI (`claude-cli.mjs`)

Each task is a separate `claude -p` invocation:
```
claude -p "prompt" --output-format json --resume <sessionId> --dangerously-skip-permissions
```

- **Session continuity**: `--session-id <uuid>` on first call, `--resume` after
- **Structured output**: Returns `{ result, session_id, cost_usd, duration_ms }`
- **No PTY**: Each invocation blocks until complete. No ANSI parsing, no zombies.
- **One JSONL per project**: Same session = one JSONL file = clean observers

### Supervisor (`watcher.mjs`)

- HTTP API: `/health`, `/state`, `/logs`, `/restart`, `/stop`
- WebSocket for real-time dashboard
- Auto-restart with exponential backoff (5s → 60s max)
- Progress-based restart counter reset on `phase_done`
- Accepts `--mode` and `--prompt` for non-build modes

### Orchestrator Engine (`orchestrator.mjs`)

- Dispatches to mode-specific plan generation or spec pipeline
- Maintains single Claude session across all phases via `--resume`
- Checkpoint: saves mode, prompt, flags, sessionId for crash recovery
- On resume: reconciles stale phase statuses + reconstructs mode instance

### Analyzer (`analyzer.mjs`)

- Local scan: package.json, directory structure, config files
- Claude call: interprets request, generates phased plan with success criteria
- Fallback: if Claude fails, creates single-phase plan from raw prompt

### Mode System (`modes/`)

Each mode extends `BaseMode` and controls:
- Plan generation (phases + tasks)
- Validators per phase
- Config overrides (timeouts, retries)
- Whether to run task reviews and final review

### Reviewer (`reviewer.mjs`)

- Isolated `claude -p` calls (no session persistence)
- Cleans up reviewer-created JSONL files
- Supports `outputFormat` and `maxTurns` options

### Validator (`validator.mjs`)

Per-phase validation: file checks, build, lint, TypeScript, DB connection,
E2E tests, custom validators (onboarding, email, seed, env, seo, legal)

## File Structure

```
claude-orchestrator/
├── BRIEF.md
├── spec.example.md
├── watcher/
│   ├── watcher.mjs           # Supervisor: HTTP + WS + auto-restart
│   ├── cli.mjs               # Multi-command CLI
│   ├── package.json
│   └── src/
│       ├── orchestrator.mjs  # Multi-mode execution engine
│       ├── analyzer.mjs      # Codebase + request analyzer
│       ├── planner.mjs       # Mode dispatcher
│       ├── modes/
│       │   ├── base-mode.mjs # Abstract base class
│       │   ├── build.mjs     # Full project from spec
│       │   ├── feature.mjs   # Add feature
│       │   ├── fix.mjs       # Fix bug
│       │   ├── audit.mjs     # Code audit
│       │   ├── test.mjs      # Testing
│       │   ├── review.mjs    # Code review
│       │   ├── refactor.mjs  # Refactoring
│       │   └── exec.mjs      # Generic prompt
│       ├── claude-cli.mjs    # Headless claude -p adapter
│       ├── reviewer.mjs      # Code review via claude -p
│       ├── validator.mjs     # Per-phase validation
│       ├── spec.mjs          # Spec → 24-phase plan (build mode)
│       ├── checkpoint.mjs    # Checkpoint save/load
│       ├── models.mjs        # Constants + OrchestratorMode
│       ├── jsonl.mjs         # JSONL directory helpers
│       ├── pty.mjs           # Legacy (deprecated)
│       └── interactive.mjs   # Legacy (deprecated)
```

## Usage

```bash
# Build from spec (0→100)
node cli.mjs build spec.md
node cli.mjs spec.md                              # shorthand

# Add a feature
node cli.mjs feature "add Stripe billing" --cwd /path/to/project

# Fix a bug
node cli.mjs fix "users can't reset password" --cwd .

# Code audit
node cli.mjs audit --cwd . --type security        # security only
node cli.mjs audit --fix --cwd .                   # audit + auto-fix

# Testing
node cli.mjs test --cwd .                          # run + generate tests
node cli.mjs test --fix --cwd .                    # also fix failures

# Code review
node cli.mjs review --cwd .

# Refactoring
node cli.mjs refactor "migrate Pages to App Router" --cwd .

# Generic
node cli.mjs exec "update all dependencies" --cwd .

# Resume from checkpoint
node cli.mjs --resume /path/to/project

# Monitor
node cli.mjs --status
node cli.mjs --logs myproject
node cli.mjs --stop myproject
```

## Key Design Decisions

1. **Multi-mode, not just build** — Same engine serves build, feature, fix,
   audit, test, review, refactor tasks. Modes control plan generation,
   validation, and review behavior.

2. **Smart analyzer for vague prompts** — Before any task goes to Claude, the
   analyzer scans the codebase and uses Claude to transform vague requests into
   detailed, context-aware execution plans with exact file paths.

3. **Headless `claude -p`** — No PTY. Each invocation is a clean process that
   blocks until complete. Session continuity via `--resume`.

4. **One JSONL per project** — Stable filename prevents observer pollution.

5. **Checkpoint after every task** — Crash recovery resumes from exact task
   with same Claude session. Mode and flags persist in checkpoint.

6. **Two-level completion check** — Phase-level or task-level, handles stale
   status from crashed sessions.

7. **Auto-restart with progress reset** — Counter resets on each phase done.

## Platform Notes

- **Windows**: Claude CLI at `~/.claude/local/claude.exe` or on PATH
- **Linux/Mac**: Claude CLI on PATH
- **JSONL path**: `~/.claude/projects/<hash>/`
- Node.js 18+ required
