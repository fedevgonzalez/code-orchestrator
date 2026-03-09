# Watchdog — Checks every N minutes via Task Scheduler.
# If an orchestrator project has a checkpoint with status "running" but
# no process is alive, it relaunches automatically.
# Runs fully hidden via watchdog.vbs wrapper.
#
# Uses a PID lockfile instead of PM2 queries to avoid daemon mismatch issues.
# Reads dev-port from checkpoint config if available.

$ErrorActionPreference = "SilentlyContinue"

$watcherDir = "G:\GitHub\claude-orchestrator\watcher"
$projectsDir = "G:\GitHub\nextspark\projects"
$env:PM2_HOME = "C:\Users\Federocp\.pm2"

Set-Location $watcherDir

$projects = Get-ChildItem -Path $projectsDir -Directory -ErrorAction SilentlyContinue

foreach ($proj in $projects) {
    $checkpoint = Join-Path $proj.FullName ".orchestrator\checkpoint.json"
    if (-not (Test-Path $checkpoint)) { continue }

    try {
        $data = Get-Content $checkpoint -Raw | ConvertFrom-Json
        $status = $data.status
    } catch {
        continue
    }

    # Only relaunch if status is "running"
    if ($status -ne "running") { continue }

    $name = "orch-$($proj.Name)"
    $pidFile = Join-Path $proj.FullName ".orchestrator\orchestrator.pid"

    # Check if the process is actually alive via PID file
    $alive = $false
    if (Test-Path $pidFile) {
        $pid = [int](Get-Content $pidFile -Raw).Trim()
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc -and -not $proc.HasExited) {
            $alive = $true
        }
    }

    if (-not $alive) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

        # Log to a file so we can debug
        $logFile = Join-Path $watcherDir "watchdog.log"
        Add-Content $logFile "[$timestamp] Relaunching $name (pid not alive, checkpoint=$status)"

        # Read dev-port from config if saved
        $devPortFile = Join-Path $proj.FullName ".orchestrator\dev-port"
        $devPortArg = ""
        if (Test-Path $devPortFile) {
            $devPort = (Get-Content $devPortFile -Raw).Trim()
            $devPortArg = "--dev-port $devPort"
        }

        # Clean up stale PM2 entry and relaunch
        pm2 delete $name 2>$null
        $cmd = "node cli.mjs --resume `"$($proj.FullName)`" $devPortArg"
        Invoke-Expression $cmd
        Start-Sleep -Seconds 3
    }
}

pm2 save --force 2>$null
