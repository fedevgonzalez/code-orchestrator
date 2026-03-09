Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""G:\GitHub\claude-orchestrator\watcher\watchdog.ps1""", 0, True
