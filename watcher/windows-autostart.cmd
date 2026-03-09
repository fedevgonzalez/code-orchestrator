@echo off
REM ══════════════════════════════════════════════════════════
REM  Register Claude Orchestrator to auto-start on Windows boot
REM  Uses Windows Task Scheduler (replaces pm2 startup on Linux)
REM
REM  Run this ONCE as Administrator:
REM    Right-click → Run as administrator
REM
REM  To remove:
REM    schtasks /Delete /TN "ClaudeOrchestrator" /F
REM ══════════════════════════════════════════════════════════

echo.
echo  Registering Claude Orchestrator for auto-start...
echo.

REM Find pm2 path
where pm2 > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pm2 not found. Install with: npm install -g pm2
    pause
    exit /b 1
)

REM Create the task - runs "pm2 resurrect" at logon
schtasks /Create /TN "ClaudeOrchestrator" /TR "cmd /c pm2 resurrect" /SC ONLOGON /RL HIGHEST /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo  SUCCESS! Claude Orchestrator will auto-start on login.
    echo.
    echo  How it works:
    echo    1. You run: pm2 start ... ^(starts the daemon^)
    echo    2. You run: pm2 save ^(saves current process list^)
    echo    3. On PC restart: Task Scheduler runs "pm2 resurrect"
    echo    4. PM2 restores all saved processes automatically
    echo.
    echo  To remove auto-start:
    echo    schtasks /Delete /TN "ClaudeOrchestrator" /F
) else (
    echo.
    echo  FAILED. Make sure you're running as Administrator.
)

echo.
pause
