#!/bin/bash
# Hyperliquid Dashboard Start Script
# Usage: ./start.sh [testnet|mainnet]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
NETWORK="${1:-testnet}"
PORT_API=8002
PORT_APP=3002

# Banner
echo -e "${BLUE}"
cat << "EOF"
  _   _                       _ _             _     _
 | | | |_   _ _ __   ___ _ __| (_) __ _ _   _(_) __| |
 | |_| | | | | '_ \ / _ \ '__| | |/ _` | | | | |/ _` |
 |  _  | |_| | |_) |  __/ |  | | | (_| | |_| | | (_| |
 |_| |_|\__, | .__/ \___|_|  |_|_|\__, |\__,_|_|\__,_|
        |___/|_|                     |_|
EOF
echo -e "${NC}"

echo -e "${GREEN}Starting Hyperliquid Trading Dashboard${NC}"
echo -e "${YELLOW}Network: ${NETWORK}${NC}"
echo -e "${YELLOW}Mode: PM2${NC}"
echo ""

# Validate network
if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
    echo -e "${RED}Error: Network must be 'testnet' or 'mainnet'${NC}"
    echo "Usage: ./start.sh [testnet|mainnet]"
    exit 1
fi

# Network warning
if [ "$NETWORK" == "mainnet" ]; then
    echo -e "${RED}⚠️  WARNING: MAINNET MODE - REAL FUNDS AT RISK${NC}"
    echo -e "${RED}⚠️  Ensure you have configured your API keys properly${NC}"
    read -p "Continue with mainnet? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
    export HYPERLIQUID_TESTNET="false"
else
    echo -e "${GREEN}✓ Testnet mode - Safe for testing${NC}"
    export HYPERLIQUID_TESTNET="true"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing PM2...${NC}"
    npm install -g pm2
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 not installed${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not installed${NC}"
    exit 1
fi

# Create necessary directories
mkdir -p logs pids

echo ""
echo -e "${BLUE}Setting up environment...${NC}"

# Install Python dependencies
echo "Installing Python dependencies..."
cd server && pip3 install -q -r requirements.txt && cd ..

# Install Node dependencies
echo "Installing Node.js dependencies..."
cd app && npm install && cd ..

# Stop any existing hyperliquid processes
echo "Stopping existing processes..."
pm2 delete hyperliquid-api 2>/dev/null || true
pm2 delete hyperliquid-app 2>/dev/null || true
sleep 2

echo ""
echo -e "${BLUE}Starting services with PM2...${NC}"

# Use ecosystem config for easier management
if [ "$NETWORK" == "mainnet" ]; then
    pm2 start ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js
fi

# Wait for API to be ready
echo "Waiting for API to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:$PORT_API/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API server is ready${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}Failed to start API server${NC}"
    echo ""
    echo -e "${YELLOW}Check logs with:${NC} pm2 logs hyperliquid-api"
    exit 1
fi

# Save PM2 process list
pm2 save

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Hyperliquid Dashboard is running!${NC}"
echo ""
echo -e "  ${BLUE}Dashboard:${NC}  http://localhost:$PORT_APP"
echo -e "  ${BLUE}API:${NC}        http://localhost:$PORT_API"
echo -e "  ${BLUE}API Docs:${NC}   http://localhost:$PORT_API/docs"
echo ""
echo -e "  ${YELLOW}PM2 Commands:${NC}"
echo -e "    Status:     pm2 status"
echo -e "    Logs:       pm2 logs hyperliquid"
echo -e "    API logs:   pm2 logs hyperliquid-api"
echo -e "    App logs:   pm2 logs hyperliquid-app"
echo -e "    Restart:    pm2 restart hyperliquid"
echo -e "    Stop:       ./stop.sh"
echo ""
echo -e "  ${YELLOW}Quick access:${NC}"
echo -e "    pm2 monit  - Monitor all processes"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
