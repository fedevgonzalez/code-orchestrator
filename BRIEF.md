# Claude Orchestrator — Project Brief

## What is this?

A cross-platform Python CLI tool that orchestrates Claude Code sessions autonomously.
It launches Claude Code in a real terminal (PTY), feeds it tasks one by one, and monitors
progress via the JSONL transcript files that Claude Code writes to `~/.claude/projects/`.

## How it works

```
orchestrator.py
├── Read tasks from tasks.json (or generate them via Claude API from a spec)
├── Spawn `claude --dangerously-skip-permissions` in a real PTY
├── Watch the JSONL file in ~/.claude/projects/<project-hash>/
├── Detect turn completion (record type=system, subtype=turn_duration)
├── Send next task via PTY stdin
├── Optionally validate output before continuing
└── Loop until all tasks complete
```

## Architecture

### PTY Layer (cross-platform)
- **Windows**: Use `pywinpty` (ConPTY) to spawn Claude Code in a real pseudo-terminal
- **Linux/Mac**: Use `pexpect` to spawn Claude Code in a Unix PTY
- Abstract behind a simple interface: `spawn(cmd, cwd)`, `send(text)`, `read()`, `close()`

### JSONL Watcher
- Claude Code writes JSONL transcripts to `~/.claude/projects/<hash>/<session-id>.jsonl`
- The hash is derived from the project path (e.g., `G:\GitHub\my-project` -> `G--GitHub-my-project`)
- Watch the newest `.jsonl` file in the project's directory
- Parse records to detect:
  - `type=system, subtype=turn_duration` → turn finished, agent is idle, ready for next input
  - `type=assistant, content[].type=tool_use` → agent is working (using tools)
  - `type=assistant, content[].type=text` → agent is responding with text
  - `type=user, content contains "<command-name>/exit</command-name>"` → session ended

### Task Queue
- Tasks are defined in a `tasks.json` file:
```json
{
  "project": "my-saas-app",
  "cwd": "G:/GitHub/my-saas-app",
  "tasks": [
    {
      "id": "init",
      "prompt": "Initialize a Next.js 15 project with TypeScript, Tailwind, and Prisma",
      "validate": "check file: package.json, tsconfig.json, prisma/schema.prisma"
    },
    {
      "id": "auth",
      "depends_on": "init",
      "prompt": "Implement JWT authentication with login/register endpoints",
      "validate": "run: npm test"
    },
    {
      "id": "tests",
      "depends_on": "auth",
      "prompt": "Write comprehensive tests for the auth module",
      "validate": "run: npm test"
    }
  ]
}
```

### Orchestrator Loop
```
1. Load tasks.json
2. Find next task (respecting depends_on)
3. Spawn Claude Code in project cwd (if not already running)
4. Wait for Claude to be ready (detect initial turn_duration in JSONL)
5. Send task prompt via PTY
6. Watch JSONL for turn_duration (task complete)
7. If validate is set:
   a. "check file: X" → verify file exists
   b. "run: cmd" → run command, check exit code
   c. If validation fails, send a follow-up: "The validation failed: {error}. Fix it."
8. Mark task as done, go to step 2
9. When all tasks complete, send /exit to Claude Code
```

## File Structure

```
claude-orchestrator/
├── orchestrator.py        # Main entry point + CLI
├── pty_adapter.py         # Cross-platform PTY abstraction (winpty / pexpect)
├── jsonl_watcher.py       # Watch JSONL files, parse Claude Code state
├── task_runner.py         # Task queue logic, validation, retry
├── tasks.json             # Example task file
├── requirements.txt       # pywinpty, pexpect (conditional)
└── README.md
```

## CLI Usage

```bash
# Run all tasks from a file
python orchestrator.py --tasks tasks.json

# Run with a spec file (generates tasks via Claude API first)
python orchestrator.py --spec "Build a TODO app with React and Express"

# Run a single task
python orchestrator.py --cwd ./my-project --prompt "Add user authentication"

# Dry run (show what would be executed)
python orchestrator.py --tasks tasks.json --dry-run

# Verbose mode (show JSONL events in real time)
python orchestrator.py --tasks tasks.json --verbose
```

## Key Design Decisions

1. **Real PTY, not pipes** — Claude Code uses ink (React TUI) which requires a real terminal.
   Pipes break the rendering. PTY gives Claude Code a real terminal environment.

2. **JSONL for state, not stdout parsing** — Claude Code's stdout has ANSI escape codes
   and TUI rendering. Parsing it is fragile. The JSONL files are structured, reliable,
   and already contain everything we need.

3. **One session per project** — Don't spawn multiple Claude Code instances in the same
   project directory. Claude Code uses file locks. One session at a time.

4. **Validation is optional** — Simple tasks don't need validation. Complex tasks can
   verify files exist or run test suites.

5. **No Claude API dependency** — The orchestrator itself doesn't call Claude API.
   It just drives Claude Code CLI. The optional `--spec` mode could use the API to
   generate tasks, but that's a future enhancement.

## Platform Notes

- **Windows**: Requires `pywinpty`. Install via `pip install pywinpty`.
  The claude CLI is at `C:\Users\<user>\.claude\local\claude.exe` or on PATH.
- **Linux/Mac**: Uses `pexpect` (usually pre-installed). The claude CLI is on PATH.
- **JSONL path**: `~/.claude/projects/<hash>/` where hash is the cwd with separators replaced by dashes.

## Dependencies

```
pywinpty>=2.0; sys_platform == 'win32'
pexpect>=4.8; sys_platform != 'win32'
```

No other dependencies. Pure Python 3.10+.
