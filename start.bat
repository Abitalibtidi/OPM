@echo off
REM ═══════════════════════════════════════════════════════════════
REM  OPM Valuation Platform — Start Application (Windows)
REM ═══════════════════════════════════════════════════════════════
REM  Double-click this file to start the OPM web application.
REM  After starting, open your browser to: http://localhost:5173
REM ═══════════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║       OPM Valuation Platform — Starting...              ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo   The application will open at:
echo.
echo     http://localhost:5173
echo.
echo   Demo Accounts:
echo     Admin:    admin@opm.local    / admin123!
echo     Analyst:  analyst@opm.local  / analyst123!
echo     Reviewer: reviewer@opm.local / reviewer123!
echo.
echo   To stop the application: close this window
echo.
echo   Starting servers...
echo.

REM Open browser after a delay
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"

REM Start both servers
call npm run dev
