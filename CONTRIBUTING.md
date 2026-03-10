# Contributing to Claude Orchestrator

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/fedevgonzalez/claude-orchestrator.git
cd claude-orchestrator/watcher
npm install
npm test
```

**Prerequisites:** Node.js >= 18, Claude Code CLI installed (`claude --version`).

## Project Structure

```
watcher/
  cli.mjs          # CLI entry point + PM2 daemon management
  watcher.mjs      # Main supervisor (HTTP/WS server, orchestration loop)
  src/
    models.mjs     # Constants, enums, factory functions
    planner.mjs    # Mode system (8 modes: build, feature, fix, etc.)
    analyzer.mjs   # Two-phase codebase analyzer (local scan + Claude)
    orchestrator.mjs # Core orchestration engine
    claude-cli.mjs # Claude pipe-mode adapter
    reviewer.mjs   # Code review via Claude
    validator.mjs  # Phase validators (build, test, lint, etc.)
    checkpoint.mjs # Atomic checkpoint save/load
    jsonl.mjs      # JSONL log watcher
    spec.mjs       # 24-phase build pipeline templates
    modes/         # Mode implementations (BaseMode subclasses)
dashboard/
  static/          # Real-time dashboard (HTML + WebSocket)
```

## Running Tests

```bash
cd watcher
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Tests use Jest with ESM. All test files live in `watcher/tests/`.

## Adding a New Mode

1. Create `watcher/src/modes/your-mode.mjs` extending `BaseMode`
2. Register it in `watcher/src/planner.mjs` in the `MODE_MAP`
3. Add to `OrchestratorMode` enum in `watcher/src/models.mjs`
4. Add tests in `watcher/tests/modes.test.mjs`

## Adding a Validator

Validators run after each phase to verify work quality. Edit `watcher/src/validator.mjs`:

1. Add your validator function to `VALIDATORS`
2. Map it to phases in `PHASE_VALIDATORS`

## Code Style

- ESM modules (`.mjs` extension, `import`/`export`)
- No TypeScript — plain JavaScript with JSDoc where helpful
- Keep functions small and focused
- Log with `[MODULE_NAME]` prefixes for easy filtering

## Pull Requests

1. Fork and create a feature branch from `master`
2. Make your changes with tests
3. Run `npm test` and ensure all tests pass
4. Open a PR with a clear description of what and why

## Reporting Issues

Open an issue at https://github.com/fedevgonzalez/claude-orchestrator/issues with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
- Relevant log output (from `claude-orch --logs`)
