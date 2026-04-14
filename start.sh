#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  OPM Valuation Platform — Start Application (Mac / Linux)
# ═══════════════════════════════════════════════════════════════
#  This script starts the OPM web application.
#  After running, open your browser to: http://localhost:5173
# ═══════════════════════════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       OPM Valuation Platform — Starting...              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  The application will open at:"
echo ""
echo "    👉  http://localhost:5173"
echo ""
echo "  Demo Accounts:"
echo "    Admin:    admin@opm.local    / admin123!"
echo "    Analyst:  analyst@opm.local  / analyst123!"
echo "    Reviewer: reviewer@opm.local / reviewer123!"
echo ""
echo "  To stop the application: press Ctrl+C"
echo ""
echo "  Starting servers..."
echo ""

# Try to open browser automatically
if command -v open &> /dev/null; then
    # macOS
    (sleep 4 && open "http://localhost:5173") &
elif command -v xdg-open &> /dev/null; then
    # Linux
    (sleep 4 && xdg-open "http://localhost:5173") &
fi

# Start both servers
npm run dev
