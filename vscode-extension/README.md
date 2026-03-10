# Code Orchestrator — VS Code Extension

Orchestrate AI coding agents directly from your editor.

## Features

- **Right-click any `.md` file** to run it through the orchestrator (build, fix, audit, review, etc.)
- **Sidebar dashboard** with real-time progress via WebSocket
- **Status bar** showing task progress and cost
- **Command palette** for all 8 orchestration modes
- **Run history** tree view in the sidebar

## Requirements

- [Code Orchestrator CLI](https://www.npmjs.com/package/code-orchestrator) (`npm install -g code-orchestrator`)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- PM2 (`npm install -g pm2`)

## Quick Start

1. Install the extension
2. Open a project folder
3. Right-click a spec or backlog `.md` file
4. Select "Run with Code Orchestrator"
5. Pick a mode (build, fix, audit, etc.)
6. Watch progress in the sidebar dashboard

## Commands

| Command | Description |
|---------|-------------|
| `Code Orchestrator: Exec` | Run a custom prompt |
| `Code Orchestrator: Build from Spec` | Build from a spec file |
| `Code Orchestrator: Fix` | Fix issues |
| `Code Orchestrator: Audit` | Audit codebase |
| `Code Orchestrator: Review` | Review code |
| `Code Orchestrator: Refactor` | Refactor code |
| `Code Orchestrator: Test` | Generate tests |
| `Code Orchestrator: Feature` | Implement features |
| `Code Orchestrator: Stop` | Stop current run |
| `Code Orchestrator: Open Dashboard` | Open full dashboard in browser |
| `Code Orchestrator: View Logs` | Open logs in terminal |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeOrchestrator.dashboardPort` | `3160` | Dashboard WebSocket port |
| `codeOrchestrator.autoOpenDashboard` | `true` | Auto-open sidebar on run start |
| `codeOrchestrator.defaultMode` | `exec` | Default mode for right-click |
| `codeOrchestrator.token` | `""` | Auth token for secured dashboard |
