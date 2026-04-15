@echo off
REM ═══════════════════════════════════════════════════════════════
REM  OPM Valuation Platform - Start Application for Windows
REM  Double-click this file to start the app.
REM ═══════════════════════════════════════════════════════════════

echo.
echo  OPM Valuation Platform - Starting...
echo  =====================================
echo.
echo  After the servers start, open your browser to:
echo.
echo      http://localhost:5173
echo.
echo  Demo Accounts:
echo      Admin:    admin@opm.local    / admin123!
echo      Analyst:  analyst@opm.local  / analyst123!
echo      Reviewer: reviewer@opm.local / reviewer123!
echo.
echo  To stop: close this window
echo.

REM Open browser after 5 seconds
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"

REM Start the app
call npm run dev
