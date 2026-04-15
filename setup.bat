@echo off
REM ═══════════════════════════════════════════════════════════════
REM  OPM Valuation Platform - Setup for Windows
REM  Double-click this file to set up everything.
REM ═══════════════════════════════════════════════════════════════

echo.
echo  OPM Valuation Platform - Setup
echo  ===============================
echo.
echo  Checking for Node.js...
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 goto NONODE

echo  Node.js found. Running setup...
echo.
node install.js
echo.
pause
goto END

:NONODE
echo.
echo  Node.js is NOT installed on your computer.
echo.
echo  Please do the following:
echo    1. Go to https://nodejs.org
echo    2. Download the LTS version
echo    3. Run the installer
echo    4. RESTART your computer
echo    5. Double-click this setup.bat file again
echo.
pause

:END
