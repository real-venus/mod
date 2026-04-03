#!/usr/bin/env bash
set -euo pipefail

# ── Registry App Starter ─────────────────────────────────────────────────────
# Usage:
#   ./start.sh              # Start the app (install deps if needed)
#   ./start.sh deploy       # Deploy contracts first, then start
#   ./start.sh deploy-only  # Deploy contracts only (no app start)
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"

echo "═══════════════════════════════════════════════════"
echo "  Registry"
echo "═══════════════════════════════════════════════════"

# Deploy if requested
if [[ "${1:-}" == "deploy" || "${1:-}" == "deploy-only" ]]; then
    echo ""
    echo "▸ Deploying contracts..."
    python3 "$SCRIPT_DIR/deploy.py" --network "${2:-evm}" --env "${3:-testnet}"

    if [[ "${1:-}" == "deploy-only" ]]; then
        echo "Deploy complete."
        exit 0
    fi
fi

# Install npm deps if needed
if [[ ! -d "$APP_DIR/node_modules" ]]; then
    echo ""
    echo "▸ Installing app dependencies..."
    cd "$APP_DIR" && npm install
fi

# Start the app
echo ""
echo "▸ Starting app on http://localhost:3420"
cd "$APP_DIR" && npm run dev
