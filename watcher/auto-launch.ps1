# Auto-launch Claude Orchestrator on Windows startup
# Runs as a hidden background process — survives terminal closure.
# Place a shortcut to this script in: shell:startup
# Also works as the watchdog's boot-time counterpart.

$ErrorActionPreference = "SilentlyContinue"

# Wait for system to settle after boot
Start-Sleep -Seconds 15

Set-Location "G:\GitHub\claude-orchestrator\watcher"
$env:PM2_HOME = "C:\Users\Federocp\.pm2"

# Scan all projects and resume any with status "running"
$projectsDir = "G:\GitHub\nextspark\projects"
$projects = Get-ChildItem -Path $projectsDir -Directory -ErrorAction SilentlyContinue

foreach ($proj in $projects) {
    $checkpoint = Join-Path $proj.FullName ".orchestrator\checkpoint.json"
    if (-not (Test-Path $checkpoint)) { continue }

    try {
        $data = Get-Content $checkpoint -Raw | ConvertFrom-Json
        if ($data.status -ne "running") { continue }
    } catch { continue }

    $name = "orch-$($proj.Name)"
    npx pm2 delete $name 2>$null
    node cli.mjs --resume $proj.FullName
    Start-Sleep -Seconds 3
}

npx pm2 save --force 2>$null
