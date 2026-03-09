#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Claude Orchestrator — Quick Start
#
# Usage:
#   ./start.sh <spec-path> <project-dir> [--fg]
#
# Examples:
#   # Background daemon (survives terminal close):
#   ./start.sh /path/to/spec.md /path/to/project
#
#   # Foreground (for debugging):
#   ./start.sh /path/to/spec.md /path/to/project --fg
#
#   # Status / logs / stop:
#   ./start.sh status
#   ./start.sh logs
#   ./start.sh stop
# ══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WATCHER_DIR="$SCRIPT_DIR/watcher"

# ── Helper commands ──────────────────────────────────────────
case "$1" in
  status)
    pm2 status
    exit 0
    ;;
  logs)
    pm2 logs claude-orchestrator --lines 50
    exit 0
    ;;
  stop)
    pm2 stop claude-orchestrator
    echo "Orchestrator stopped."
    exit 0
    ;;
  restart)
    pm2 restart claude-orchestrator
    echo "Orchestrator restarted."
    exit 0
    ;;
  monitor)
    pm2 monit
    exit 0
    ;;
  dashboard)
    echo "Opening dashboard..."
    # Try to detect the port from running process
    echo "http://localhost:3111"
    exit 0
    ;;
esac

# ── Main: start orchestration ────────────────────────────────
SPEC_PATH="$1"
PROJECT_CWD="$2"
MODE="${3:---bg}"  # default: background

if [ -z "$SPEC_PATH" ] || [ -z "$PROJECT_CWD" ]; then
  echo "Usage: ./start.sh <spec-path> <project-dir> [--fg|--bg]"
  echo ""
  echo "Commands:"
  echo "  ./start.sh status    — Show daemon status"
  echo "  ./start.sh logs      — View live logs"
  echo "  ./start.sh stop      — Stop daemon"
  echo "  ./start.sh restart   — Restart daemon"
  echo "  ./start.sh monitor   — PM2 monitoring dashboard"
  exit 1
fi

SPEC_PATH="$(cd "$(dirname "$SPEC_PATH")" && pwd)/$(basename "$SPEC_PATH")"
PROJECT_CWD="$(cd "$PROJECT_CWD" 2>/dev/null && pwd || echo "$PROJECT_CWD")"

# Ensure project dir exists
mkdir -p "$PROJECT_CWD"

# Install watcher deps if needed
if [ ! -d "$WATCHER_DIR/node_modules" ]; then
  echo "Installing watcher dependencies..."
  cd "$WATCHER_DIR" && npm install
fi

# Check if pm2 is installed (for daemon mode)
if [ "$MODE" != "--fg" ] && ! command -v pm2 &> /dev/null; then
  echo "Installing PM2 globally (required for daemon mode)..."
  npm install -g pm2
fi

echo ""
echo "┌──────────────────────────────────────────────────────────┐"
echo "│          CLAUDE ORCHESTRATOR — LAUNCHING                 │"
echo "└──────────────────────────────────────────────────────────┘"
echo "  Spec:      $SPEC_PATH"
echo "  Project:   $PROJECT_CWD"
echo "  Mode:      $([ "$MODE" = "--fg" ] && echo "Foreground" || echo "Background daemon (PM2)")"
echo "  Dashboard: http://localhost:3111"
echo ""

if [ "$MODE" = "--fg" ]; then
  # Foreground: direct node, dies with terminal
  cd "$WATCHER_DIR"
  node watcher.mjs --spec "$SPEC_PATH" --cwd "$PROJECT_CWD" --verbose
else
  # Background daemon via PM2
  cd "$WATCHER_DIR"

  # Stop any existing instance
  pm2 stop claude-orchestrator 2>/dev/null
  pm2 delete claude-orchestrator 2>/dev/null

  # Start with PM2
  pm2 start watcher.mjs \
    --name claude-orchestrator \
    --interpreter node \
    --kill-timeout 15000 \
    --max-restarts 10 \
    --restart-delay 5000 \
    --max-memory-restart 500M \
    --log-date-format "YYYY-MM-DD HH:mm:ss" \
    --output "$PROJECT_CWD/.orchestrator/logs/supervisor-out.log" \
    --error "$PROJECT_CWD/.orchestrator/logs/supervisor-error.log" \
    --merge-logs \
    -- --spec "$SPEC_PATH" --cwd "$PROJECT_CWD" --verbose

  # Save process list so pm2 resurrect works after PC restart
  pm2 save

  echo ""
  echo "Daemon started! You can close this terminal safely."
  echo ""
  echo "Commands:"
  echo "  ./start.sh logs      — View live logs"
  echo "  ./start.sh status    — Check status"
  echo "  ./start.sh stop      — Stop everything"
  echo "  ./start.sh monitor   — PM2 monitoring"
  echo ""
  echo "Dashboard: http://localhost:3111"
  echo ""

  # Show initial status
  pm2 status
fi
