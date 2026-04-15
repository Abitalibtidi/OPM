@echo off
REM ═══════════════════════════════════════════════════════════════
REM  OPM Platform — Diagnostic Tool (Windows)
REM  Double-click this if you're having trouble starting the app.
REM ═══════════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║       OPM Platform — Diagnostics                        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

set PASS=0
set FAIL=0

REM ── Check 1: Node.js ──
echo -- Checking Node.js --
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   FAIL: Node.js is NOT installed
    echo         Fix: Download from https://nodejs.org
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%i in ('node -v') do echo   OK: Node.js installed: %%i
    set /a PASS+=1
)

REM ── Check 2: npm ──
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   FAIL: npm is NOT installed
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%i in ('npm -v') do echo   OK: npm installed: %%i
    set /a PASS+=1
)

REM ── Check 3: Project files ──
echo.
echo -- Checking project files --
if exist package.json (
    echo   OK: package.json found
    set /a PASS+=1
) else (
    echo   FAIL: package.json not found - wrong folder!
    echo         Current folder: %CD%
    echo         Fix: Navigate to the OPM project folder
    set /a FAIL+=1
)

if exist server\package.json (
    echo   OK: server folder found
    set /a PASS+=1
) else (
    echo   FAIL: server folder missing
    set /a FAIL+=1
)

if exist client\package.json (
    echo   OK: client folder found
    set /a PASS+=1
) else (
    echo   FAIL: client folder missing
    set /a FAIL+=1
)

REM ── Check 4: Dependencies ──
echo.
echo -- Checking dependencies --
if exist node_modules (
    echo   OK: Root dependencies installed
    set /a PASS+=1
) else (
    echo   FAIL: Root dependencies NOT installed
    echo         Fix: Run setup.bat
    set /a FAIL+=1
)

if exist server\node_modules (
    echo   OK: Server dependencies installed
    set /a PASS+=1
) else (
    echo   FAIL: Server dependencies NOT installed
    echo         Fix: Run setup.bat
    set /a FAIL+=1
)

if exist client\node_modules (
    echo   OK: Client dependencies installed
    set /a PASS+=1
) else (
    echo   FAIL: Client dependencies NOT installed
    echo         Fix: Run setup.bat
    set /a FAIL+=1
)

REM ── Check 5: .env file ──
echo.
echo -- Checking configuration --
if exist server\.env (
    echo   OK: server\.env file exists
    set /a PASS+=1
) else (
    echo   FAIL: server\.env file is MISSING
    echo         Fix: Run setup.bat or copy server\.env.example to server\.env
    set /a FAIL+=1
)

REM ── Check 6: Database ──
echo.
echo -- Checking database --
if exist server\prisma\dev.db (
    echo   OK: Database file exists
    set /a PASS+=1
) else (
    echo   FAIL: Database file not found
    echo         Fix: Run setup.bat
    set /a FAIL+=1
)

REM ── Check 7: Ports ──
echo.
echo -- Checking ports --
netstat -an | findstr ":3000 " >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo   WARNING: Port 3000 is ALREADY IN USE
    echo            Close other apps or restart your computer
) else (
    echo   OK: Port 3000 is available
    set /a PASS+=1
)

netstat -an | findstr ":5173 " >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo   WARNING: Port 5173 is ALREADY IN USE
    echo            Close other apps or restart your computer
) else (
    echo   OK: Port 5173 is available
    set /a PASS+=1
)

REM ── Summary ──
echo.
echo ════════════════════════════════════════════════════════════
echo   RESULTS:  %PASS% passed,  %FAIL% failed
echo ════════════════════════════════════════════════════════════

if %FAIL% equ 0 (
    echo.
    echo   Everything looks good! Double-click start.bat to run the app.
    echo   Then open: http://localhost:5173
) else (
    echo.
    echo   Issues found. Please:
    echo   1. Make sure Node.js is installed from https://nodejs.org
    echo   2. Make sure you are in the correct project folder
    echo   3. Double-click setup.bat to run setup again
    echo   4. Then double-click start.bat
)

echo.
pause
