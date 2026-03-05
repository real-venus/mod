#!/bin/bash

# Sr25519 Bridge Startup Script
# This script helps you start the bridge backend

set -e

echo "
╔═══════════════════════════════════════╗
║   Sr25519 to ERC20 Bridge Backend     ║
╚═══════════════════════════════════════╝
"

# Check if bridge_config.json exists
if [ ! -f "bridge_config.json" ]; then
    echo "❌ Error: bridge_config.json not found"
    echo ""
    echo "Please run deployment first:"
    echo "  npm run deploy:testnet"
    echo ""
    echo "Or create bridge_config.json manually with:"
    echo "  {
    \"rpc_url\": \"https://sepolia.base.org\",
    \"bridge_contract\": \"0x...\",
    \"token_contract\": \"0x...\",
    \"operator_key\": \"your_private_key\",
    \"snapshot_path\": \"bridge/total_balances.json\",
    \"signature_timeout\": 300
  }"
    exit 1
fi

# Check if snapshot exists
SNAPSHOT_PATH=$(cat bridge_config.json | grep snapshot_path | cut -d'"' -f4)
if [ -n "$SNAPSHOT_PATH" ] && [ ! -f "$SNAPSHOT_PATH" ]; then
    echo "⚠️  Warning: Snapshot file not found at: $SNAPSHOT_PATH"
    echo ""
    echo "Generate snapshot with:"
    echo "  cd bridge && cargo run -- snap --show-report"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python version: $PYTHON_VERSION"

# Check if dependencies are installed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "❌ Error: Python dependencies not installed"
    echo ""
    echo "Install with:"
    echo "  pip install -r requirements.txt"
    exit 1
fi

echo "✓ Dependencies installed"

# Display configuration
echo ""
echo "Configuration:"
RPC_URL=$(cat bridge_config.json | grep rpc_url | cut -d'"' -f4)
BRIDGE=$(cat bridge_config.json | grep bridge_contract | cut -d'"' -f4)
TOKEN=$(cat bridge_config.json | grep token_contract | cut -d'"' -f4)

echo "  RPC: $RPC_URL"
echo "  Bridge: $BRIDGE"
echo "  Token: $TOKEN"
echo ""

# Start backend
echo "Starting backend on http://localhost:8000"
echo ""
echo "Endpoints:"
echo "  POST /claim      - Submit claim"
echo "  GET  /balance/:addr - Check balance"
echo "  POST /process    - Process claims (operator)"
echo "  GET  /stats      - Bridge stats"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python3 mod.py
