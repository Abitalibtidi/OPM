@echo off
REM ═══════════════════════════════════════════════════════════════
REM  OPM Valuation Platform — One-Click Setup (Windows)
REM ═══════════════════════════════════════════════════════════════
REM  Double-click this file to set up the OPM application.
REM ═══════════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║       OPM Valuation Platform — Setup                    ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM ── Step 1: Check if Node.js is installed ──
echo [1/5] Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo   ERROR: Node.js is NOT installed on your computer.
    echo.
    echo   Please install it first:
    echo     1. Go to: https://nodejs.org
    echo     2. Download the LTS version (the green button)
    echo     3. Run the installer and follow the prompts
    echo     4. RESTART your computer after installing
    echo     5. Double-click this setup.bat file again
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo   OK: Node.js found: %NODE_VERSION%

REM ── Step 2: Create the .env configuration file ──
echo [2/5] Setting up configuration...
if not exist server\.env (
    for /f "tokens=*" %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set SECRET=%%i
    (
        echo DATABASE_URL="file:./dev.db"
        echo JWT_SECRET="%SECRET%"
        echo PORT=3000
    ) > server\.env
    echo   OK: Configuration file created
) else (
    echo   OK: Configuration file already exists
)

REM ── Step 3: Install dependencies ──
echo [3/5] Installing dependencies (this may take 1-2 minutes)...
call npm install --silent
cd server
call npm install --silent
cd ..\client
call npm install --silent
cd ..
echo   OK: All dependencies installed

REM ── Step 4: Set up the database ──
echo [4/5] Setting up database...
cd server
call npx prisma generate --schema=prisma/schema.prisma
call npx prisma migrate dev --name init --schema=prisma/schema.prisma
cd ..
echo   OK: Database ready

REM ── Step 5: Seed demo data ──
echo [5/5] Loading demo data...
cd server
call npx prisma db seed
cd ..

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║  SETUP COMPLETE!                                        ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║                                                          ║
echo ║  To start the application:                               ║
echo ║    Double-click the  start.bat  file                     ║
echo ║                                                          ║
echo ║  Demo Accounts:                                          ║
echo ║    Admin:    admin@opm.local    / admin123!              ║
echo ║    Analyst:  analyst@opm.local  / analyst123!            ║
echo ║    Reviewer: reviewer@opm.local / reviewer123!           ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause
