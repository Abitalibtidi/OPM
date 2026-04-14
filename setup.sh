#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  OPM Valuation Platform — One-Click Setup (Mac / Linux)
# ═══════════════════════════════════════════════════════════════
#  This script sets up everything you need to run the OPM app.
#  Just double-click this file or run: bash setup.sh
# ═══════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       OPM Valuation Platform — Setup                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Check if Node.js is installed ──
echo "[1/5] Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "  ❌  Node.js is NOT installed on your computer."
    echo ""
    echo "  Please install it first:"
    echo "    1. Go to: https://nodejs.org"
    echo "    2. Download the LTS version (the green button)"
    echo "    3. Run the installer and follow the prompts"
    echo "    4. Close this window and run this script again"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo "  ✅  Node.js found: $NODE_VERSION"

# Check minimum version (need 18+)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo ""
    echo "  ⚠️   Node.js version 18 or higher is required."
    echo "  You have: $NODE_VERSION"
    echo "  Please update at: https://nodejs.org"
    echo ""
    exit 1
fi

# ── Step 2: Create the .env configuration file ──
echo "[2/5] Setting up configuration..."
if [ ! -f server/.env ]; then
    # Generate a random secret key
    SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    cat > server/.env << ENVFILE
DATABASE_URL="file:./dev.db"
JWT_SECRET="${SECRET}"
PORT=3000
ENVFILE
    echo "  ✅  Configuration file created (server/.env)"
else
    echo "  ✅  Configuration file already exists"
fi

# ── Step 3: Install dependencies ──
echo "[3/5] Installing dependencies (this may take 1-2 minutes)..."
npm install --silent 2>&1 | tail -1
cd server && npm install --silent 2>&1 | tail -1
cd ../client && npm install --silent 2>&1 | tail -1
cd ..
echo "  ✅  All dependencies installed"

# ── Step 4: Set up the database ──
echo "[4/5] Setting up database..."
cd server
npx prisma generate --schema=prisma/schema.prisma 2>&1 | grep -E "Generated|✔" || true
npx prisma migrate dev --name init --schema=prisma/schema.prisma 2>&1 | grep -E "applied|in sync|migration" || true
cd ..
echo "  ✅  Database ready"

# ── Step 5: Seed demo data ──
echo "[5/5] Loading demo data..."
cd server
npx prisma db seed 2>&1 | grep -E "Seed|Default|Admin|Analyst|Reviewer" || true
cd ..

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  SETUP COMPLETE!                                    ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  To start the application, run:                          ║"
echo "║                                                          ║"
echo "║    bash start.sh                                         ║"
echo "║                                                          ║"
echo "║  Or on Mac, just double-click the start.sh file.         ║"
echo "║                                                          ║"
echo "║  Demo Accounts:                                          ║"
echo "║    Admin:    admin@opm.local    / admin123!              ║"
echo "║    Analyst:  analyst@opm.local  / analyst123!            ║"
echo "║    Reviewer: reviewer@opm.local / reviewer123!           ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
