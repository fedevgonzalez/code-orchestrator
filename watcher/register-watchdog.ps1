# Register the watchdog as a Windows Scheduled Task (run every 3 minutes)
# Run this script once as Administrator.

$taskName = "ClaudeOrchestratorWatchdog"
$scriptPath = "G:\GitHub\claude-orchestrator\watcher\watchdog.ps1"

# Use VBS wrapper for truly hidden execution (no flash)
$vbsPath = "G:\GitHub\claude-orchestrator\watcher\watchdog.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 3) `
    -RepetitionDuration (New-TimeSpan -Days 365)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Remove existing if any
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Watchdog: relaunches Claude Orchestrator projects if killed" `
    -Force

Write-Output ""
Write-Output "Registered: $taskName (every 3 minutes)"
Get-ScheduledTask -TaskName $taskName | Format-Table TaskName, State -AutoSize
