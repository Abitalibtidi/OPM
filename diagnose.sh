#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  OPM Platform — Diagnostic Tool
#  Run this if you're having trouble starting the application.
#  It checks every requirement and tells you exactly what's wrong.
# ═══════════════════════════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       OPM Platform — Diagnostics                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅  $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌  $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️   $1"; WARN=$((WARN+1)); }

# ── Check 1: Node.js ──
echo "── Checking Node.js ──"
if command -v node &> /dev/null; then
    NODE_V=$(node -v)
    NODE_MAJOR=$(echo "$NODE_V" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        pass "Node.js installed: $NODE_V"
    else
        fail "Node.js too old: $NODE_V (need v18 or higher)"
        echo "       Fix: Download latest from https://nodejs.org"
    fi
else
    fail "Node.js is NOT installed"
    echo "       Fix: Download from https://nodejs.org"
fi

# ── Check 2: npm ──
if command -v npm &> /dev/null; then
    pass "npm installed: $(npm -v)"
else
    fail "npm is NOT installed (comes with Node.js)"
fi

# ── Check 3: Are we in the right folder? ──
echo ""
echo "── Checking project files ──"
if [ -f "package.json" ]; then
    PKG_NAME=$(node -e "console.log(require('./package.json').name)" 2>/dev/null)
    if [ "$PKG_NAME" = "opm-platform" ]; then
        pass "In correct project folder"
    else
        fail "package.json exists but this doesn't look like the OPM project"
        echo "       Fix: Make sure you're in the OPM folder, not a subfolder"
    fi
else
    fail "package.json not found — you're in the wrong folder"
    echo "       Current folder: $(pwd)"
    echo "       Fix: cd into the OPM project folder first"
fi

if [ -d "server" ] && [ -d "client" ] && [ -d "shared" ]; then
    pass "Project folders exist (server/, client/, shared/)"
else
    fail "Missing project folders"
    echo "       Fix: Make sure you downloaded/extracted the full project"
fi

# ── Check 4: Dependencies installed? ──
echo ""
echo "── Checking dependencies ──"
if [ -d "node_modules" ]; then
    pass "Root dependencies installed"
else
    fail "Root dependencies NOT installed"
    echo "       Fix: Run 'npm install' or 'bash setup.sh'"
fi

if [ -d "server/node_modules" ]; then
    pass "Server dependencies installed"
else
    fail "Server dependencies NOT installed"
    echo "       Fix: Run 'bash setup.sh' or 'cd server && npm install'"
fi

if [ -d "client/node_modules" ]; then
    pass "Client dependencies installed"
else
    fail "Client dependencies NOT installed"
    echo "       Fix: Run 'bash setup.sh' or 'cd client && npm install'"
fi

# ── Check 5: .env file ──
echo ""
echo "── Checking configuration ──"
if [ -f "server/.env" ]; then
    pass "server/.env file exists"
    if grep -q "DATABASE_URL" server/.env; then
        pass "DATABASE_URL is set"
    else
        fail "DATABASE_URL missing from server/.env"
    fi
    if grep -q "JWT_SECRET" server/.env; then
        pass "JWT_SECRET is set"
    else
        fail "JWT_SECRET missing from server/.env"
    fi
else
    fail "server/.env file is MISSING"
    echo "       Fix: Run 'bash setup.sh' or create it manually:"
    echo "            Copy server/.env.example to server/.env"
fi

# ── Check 6: Database ──
echo ""
echo "── Checking database ──"
if [ -f "server/prisma/dev.db" ]; then
    pass "Database file exists (server/prisma/dev.db)"
else
    fail "Database file not found"
    echo "       Fix: Run 'bash setup.sh' or:"
    echo "            cd server && npx prisma migrate dev"
fi

if [ -d "server/node_modules/.prisma" ]; then
    pass "Prisma client generated"
else
    fail "Prisma client not generated"
    echo "       Fix: cd server && npx prisma generate"
fi

# ── Check 7: Ports available? ──
echo ""
echo "── Checking ports ──"
if command -v lsof &> /dev/null; then
    if lsof -i :3000 &> /dev/null; then
        warn "Port 3000 is ALREADY IN USE (backend port)"
        echo "       Something else is using this port."
        echo "       Fix: Close other apps or restart your computer"
        lsof -i :3000 | head -3
    else
        pass "Port 3000 is available (backend)"
    fi

    if lsof -i :5173 &> /dev/null; then
        warn "Port 5173 is ALREADY IN USE (frontend port)"
        echo "       Something else is using this port."
        echo "       Fix: Close other apps or restart your computer"
        lsof -i :5173 | head -3
    else
        pass "Port 5173 is available (frontend)"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -an | grep -q ":3000 "; then
        warn "Port 3000 may be in use"
    else
        pass "Port 3000 appears available"
    fi
    if netstat -an | grep -q ":5173 "; then
        warn "Port 5173 may be in use"
    else
        pass "Port 5173 appears available"
    fi
else
    warn "Cannot check ports (lsof/netstat not available)"
fi

# ── Check 8: Try starting server briefly ──
echo ""
echo "── Quick server test ──"
echo "  Attempting to start backend for 5 seconds..."
cd server 2>/dev/null
if [ -f "src/index.ts" ]; then
    timeout 5 npx tsx src/index.ts > /tmp/opm_test.log 2>&1 &
    SERVER_PID=$!
    sleep 3

    if kill -0 $SERVER_PID 2>/dev/null; then
        # Server is running, try to reach it
        if command -v curl &> /dev/null; then
            RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
            if [ "$RESPONSE" = "200" ]; then
                pass "Backend server starts and responds correctly"
            else
                warn "Backend started but health check returned: $RESPONSE"
                echo "       Check /tmp/opm_test.log for details"
            fi
        else
            pass "Backend server process started (could not test HTTP)"
        fi
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
    else
        fail "Backend server FAILED to start"
        echo "       Error log:"
        cat /tmp/opm_test.log 2>/dev/null | tail -10
    fi
else
    fail "Cannot find server/src/index.ts"
fi
cd .. 2>/dev/null

# ── Summary ──
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  RESULTS:  ✅ $PASS passed    ❌ $FAIL failed    ⚠️  $WARN warnings"
echo "════════════════════════════════════════════════════════════"

if [ "$FAIL" -eq 0 ]; then
    echo ""
    echo "  Everything looks good! Try starting the app:"
    echo ""
    echo "    bash start.sh"
    echo ""
    echo "  Then open: http://localhost:5173"
    echo ""
elif [ "$FAIL" -le 2 ]; then
    echo ""
    echo "  A few issues found. Try running setup again:"
    echo ""
    echo "    bash setup.sh"
    echo ""
    echo "  Then try: bash start.sh"
    echo ""
else
    echo ""
    echo "  Multiple issues found. Please:"
    echo "  1. Make sure Node.js is installed from https://nodejs.org"
    echo "  2. Make sure you're in the correct project folder"
    echo "  3. Run: bash setup.sh"
    echo "  4. Then run: bash start.sh"
    echo ""
fi
