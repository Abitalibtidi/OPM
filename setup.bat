@echo off
REM ═══════════════════════════════════════════════════════════════
REM  OPM Valuation Platform — Setup (Windows)
REM  Double-click this file to set up everything.
REM ═══════════════════════════════════════════════════════════════

echo.
echo  Checking for Node.js...
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo   Node.js is NOT installed on your computer.
    echo.
    echo   Please:
    echo     1. Go to https://nodejs.org
    echo     2. Download the LTS version (green button)
    echo     3. Run the installer
    echo     4. RESTART your computer
    echo     5. Double-click this file again
    echo.
    pause
    exit /b 1
)

node install.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo   Setup encountered an error. See messages above.
    echo.
)

pause
