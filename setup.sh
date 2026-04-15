#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  OPM Valuation Platform — Setup (Mac / Linux)
#  Run with: bash setup.sh
# ═══════════════════════════════════════════════════════════════

echo ""
echo "  Checking for Node.js..."
echo ""

if ! command -v node &> /dev/null; then
    echo "  Node.js is NOT installed."
    echo ""
    echo "  Please:"
    echo "    1. Go to https://nodejs.org"
    echo "    2. Download the LTS version (green button)"
    echo "    3. Run the installer"
    echo "    4. Run this script again"
    echo ""
    exit 1
fi

node install.js
