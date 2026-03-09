#!/bin/bash
# Launch all 4 Kuore projects simultaneously
# Each gets a unique dev server port for validation/health checks
# Databases are created automatically by nextspark during scaffold phase
#
# Usage: bash launch-kuore.sh
# Stop all: node cli.mjs --stop-all

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECTS_DIR="G:/GitHub/nextspark/projects"

cd "$SCRIPT_DIR"

echo ""
echo "========================================================"
echo "       KUORE SUITE — Launching 4 Projects"
echo "========================================================"
echo ""

# Launch each project with its own dev port
declare -A PROJECTS=(
  ["kuore-wellness"]="3001"
  ["kuore-health"]="3002"
  ["kuore-pets"]="3003"
  ["kuore-crm"]="3004"
)

for project in kuore-wellness kuore-health kuore-pets kuore-crm; do
  port="${PROJECTS[$project]}"
  spec="$PROJECTS_DIR/$project/spec.md"

  if [ ! -f "$spec" ]; then
    echo "[SKIP] $project — no spec.md found"
    continue
  fi

  echo "[LAUNCH] $project (dev port: $port)"
  node cli.mjs "$spec" --dev-port "$port"
  echo ""
  sleep 2
done

echo ""
echo "========================================================"
echo "       All 4 projects launched!"
echo "========================================================"
echo ""
echo "  Monitor:"
echo "    node cli.mjs --status              All instances"
echo "    node cli.mjs --logs kuore-wellness  View specific logs"
echo ""
echo "  Stop:"
echo "    node cli.mjs --stop kuore-wellness  Stop one"
echo "    node cli.mjs --stop-all             Stop all"
echo ""
echo "  You can close this terminal safely."
echo "  The watchdog will keep everything running."
echo ""
