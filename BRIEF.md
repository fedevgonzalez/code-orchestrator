# Claude Orchestrator v2 — Project Brief

## What is this?

A Node.js CLI tool that orchestrates Claude Code sessions autonomously to build
entire SaaS applications from a spec file. It drives Claude Code through phased
execution using headless `claude -p` (pipe mode), with automatic code review,
validation, and crash recovery.

## How it works

```
watcher.mjs (supervisor)
├── HTTP + WebSocket server for dashboard / monitoring
├── Auto-restart with exponential backoff on crash
└── Spawns Orchestrator engine
    └── orchestrator.mjs
        ├── Parse spec → generate phased execution plan
        ├── For each phase:
        │   ├── Execute tasks via `claude -p --resume <sessionId>`
        │   ├── Validate output (file checks, build, lint, DB, e2e)
        │   ├── Self-review via same Claude session
        │   ├── Fix rejected code automatically
        │   └── Gate check (required files, commands)
        ├── Final comprehensive review
        └── Checkpoint after every task for crash recovery
```

## Architecture

### Headless Claude CLI (`claude-cli.mjs`)

Instead of spawning Claude Code in a PTY (which caused ConPTY crashes on Windows
under PM2), each task is executed as a separate `claude -p` invocation:

```
claude -p "prompt" --output-format json --resume <sessionId> --dangerously-skip-permissions
```

- **Session continuity**: `--session-id <uuid>` on first call, `--resume <uuid>`
  on subsequent calls. Full conversation context (files read, tools used, history)
  is maintained across all prompts within a project.
- **Structured output**: Returns `{ result, session_id, cost_usd, duration_ms }`
  as JSON for programmatic parsing.
- **No PTY, no ANSI parsing**: Each invocation blocks until complete and returns
  clean structured data.
- **One JSONL per project**: Claude Code creates one JSONL file per session. Since
  we reuse the same session across all prompts, only one JSONL file is created per
  project — keeping pixel.lab/observers clean.

### Supervisor (`watcher.mjs`)

- Parses CLI args (`--cwd`, `--spec`, `--resume`, `--port`, `--dev-port`, etc.)
- Starts HTTP server with REST API (`/health`, `/state`, `/logs`, `/restart`, `/stop`)
- WebSocket for real-time dashboard updates
- Auto-restart with exponential backoff (5s → 10s → 20s → ... max 60s)
- Progress-based restart counter reset: counter resets to 0 on each `phase_done`
- Max restarts: 50 (configurable via `--max-restarts`)
- PID file + dev-port file for external watchdog integration

### Orchestrator Engine (`orchestrator.mjs`)

- Loads or builds execution plan from spec file
- Maintains single Claude session across all phases via `--resume`
- Checkpoint persistence: saves state after every task including `sessionId`
- On resume: reconciles stale phase statuses (phases from crashed sessions whose
  tasks are all done get marked as DONE automatically)
- Completion check: considers both phase-level and task-level completion

### Reviewer (`reviewer.mjs`)

- Uses separate `claude -p` calls (no session persistence) for code review
- Cleans up reviewer-created JSONL files to avoid ghost agents in observers
- Task review: checks correctness, completeness, quality (score 7+ = approved)
- Final review: architecture, security, test coverage (score 8+ = production-ready)

### Validator (`validator.mjs`)

Per-phase validation with multiple check types:
- **File checks**: Verify expected files exist
- **Build check**: `npm run build` must succeed
- **Lint check**: `npx next lint` must pass
- **TypeScript check**: `npx tsc --noEmit` must pass
- **Database check**: Verify connection and migrations
- **E2E tests**: Playwright smoke tests
- **Custom validators**: onboarding-files, email-files, seed-files, env, seo, legal

### Spec Parser (`spec.mjs`)

Converts a markdown spec file into a phased execution plan with 24 phases:
scaffold → database → auth → core-api → payments → frontend → onboarding →
integration → ux-polish → nextspark-polish → seed-data → landing → seo →
legal → email → analytics → security → support → testing → screenshots →
performance → cicd → deploy → launch-assets

## File Structure

```
claude-orchestrator/
├── BRIEF.md                  # This file
├── spec.example.md           # Example spec file
├── watcher/
│   ├── watcher.mjs           # Supervisor: HTTP + WS + auto-restart
│   ├── cli.mjs               # CLI wrapper (PM2 management)
│   ├── package.json
│   └── src/
│       ├── orchestrator.mjs  # Main engine: phased execution loop
│       ├── claude-cli.mjs    # Headless claude -p adapter
│       ├── pty.mjs           # Legacy PTY adapter (deprecated)
│       ├── reviewer.mjs      # Code review via claude -p
│       ├── validator.mjs     # Per-phase validation checks
│       ├── spec.mjs          # Spec parser → execution plan
│       ├── checkpoint.mjs    # Checkpoint save/load
│       ├── models.mjs        # Constants (TaskStatus, PhaseStatus, etc.)
│       ├── jsonl.mjs         # JSONL directory helpers
│       └── interactive.mjs   # Legacy interactive detector (deprecated)
```

## Usage

```bash
# Start a new project from spec
node watcher.mjs --cwd /path/to/project --spec spec.md

# Resume from checkpoint after crash
node watcher.mjs --cwd /path/to/project --resume

# With PM2 (recommended for long-running builds)
npx pm2 start watcher.mjs --name orch-myproject -- \
  --cwd /path/to/project --spec spec.md --port 3171 --dev-port 3001 --verbose

# Check status
curl http://localhost:3171/health
curl http://localhost:3171/state

# Monitor logs
npx pm2 logs orch-myproject
```

## Key Design Decisions

1. **Headless `claude -p`, not PTY** — PTY (ConPTY) crashed under PM2 on Windows
   due to `AttachConsole failed`. Each `claude -p` invocation is a clean process
   that blocks until complete. No ANSI parsing, no zombie processes.

2. **Session continuity via `--resume`** — All prompts within a project share one
   Claude session. Context (files read, tools used, conversation) persists across
   all 24 phases. On crash recovery, the session resumes from where it left off.

3. **One JSONL per project** — Stable filename (`orchestrator-<project>.jsonl`)
   prevents observers like pixel.lab from seeing multiple agents per project.

4. **Checkpoint after every task** — If the process dies, it resumes from the
   exact task where it left off, with the same Claude session.

5. **Two-level completion check** — Marks run as completed if all phases are DONE
   *or* if all tasks are DONE (handles stale phase status from crashed sessions).

6. **Auto-restart with progress reset** — Restart counter resets on each phase
   completion, so transient failures don't exhaust the restart budget.

## Platform Notes

- **Windows**: Claude CLI at `~/.claude/local/claude.exe` or on PATH. Uses
  `taskkill /PID /T /F` for process tree cleanup.
- **Linux/Mac**: Claude CLI on PATH. Standard process signals for cleanup.
- **JSONL path**: `~/.claude/projects/<hash>/` where hash is the cwd with
  separators replaced by dashes (e.g., `G--GitHub-my-project`).

## Dependencies

```json
{
  "chokidar": "^3.6.0",    // File watching (validators)
  "node-pty": "^1.0.0",    // Legacy PTY (deprecated, kept for compat)
  "pg": "^8.20.0",         // Database validation
  "which": "^4.0.0",       // Find claude binary
  "ws": "^8.16.0"          // WebSocket server
}
```

Node.js 18+ required. No Python dependencies.
