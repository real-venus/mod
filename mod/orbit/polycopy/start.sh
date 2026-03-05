#!/bin/bash
# Polycopy Start Script - Monitor and copy Polymarket trades with PM2
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
PORT_API=8001
PORT_WEB=3001
CONFIG_FILE="$HOME/.mod/polycopy/config"

# Banner
echo -e "${BLUE}"
cat << "EOF"
  ____       _
 |  _ \ ___ | |_   _  ___ ___  _ __  _   _
 | |_) / _ \| | | | |/ __/ _ \| '_ \| | | |
 |  __/ (_) | | |_| | (_| (_) | |_) | |_| |
 |_|   \___/|_|\__, |\___\___/| .__/ \__, |
               |___/           |_|    |___/
EOF
echo -e "${NC}"

echo -e "${GREEN}Starting Polycopy Copy Trading System${NC}"
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
    echo -e "${RED}⚠️  Ensure you have reviewed all configurations${NC}"
    read -p "Continue with mainnet? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
    export POLYCOPY_NETWORK="mainnet"
    export POLYCOPY_DRY_RUN="false"
else
    echo -e "${GREEN}✓ Testnet mode - Safe for testing${NC}"
    export POLYCOPY_NETWORK="testnet"
    export POLYCOPY_DRY_RUN="true"
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
mkdir -p logs pids ~/.mod/polycopy

echo ""
echo -e "${BLUE}Setting up environment...${NC}"

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -q -r requirements.txt
if [ -f "server/requirements.txt" ]; then
    echo "Installing server dependencies..."
    pip3 install -q -r server/requirements.txt
fi

# Install Node dependencies
echo "Installing Node.js dependencies..."
cd app && npm install -q && cd ..

# Stop any existing polycopy processes
echo "Stopping existing processes..."
pm2 delete polycopy-api 2>/dev/null || true
pm2 delete polycopy-app 2>/dev/null || true
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
    echo -e "${YELLOW}Check logs with:${NC} pm2 logs polycopy-api"
    exit 1
fi

# Save PM2 process list
pm2 save

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Polycopy is running with PM2!${NC}"
echo ""
echo -e "  ${BLUE}Web UI:${NC}  http://localhost:$PORT_WEB"
echo -e "  ${BLUE}API:${NC}     http://localhost:$PORT_API"
echo -e "  ${BLUE}Docs:${NC}    http://localhost:$PORT_API/docs"
echo ""
echo -e "  ${YELLOW}PM2 Commands:${NC}"
echo -e "    Status:   pm2 status"
echo -e "    Logs:     pm2 logs polycopy"
echo -e "    API logs: pm2 logs polycopy-api"
echo -e "    Web logs: pm2 logs polycopy-app"
echo -e "    Restart:  pm2 restart polycopy"
echo -e "    Stop:     ./stop.sh"
echo ""
echo -e "  ${YELLOW}Quick access:${NC}"
echo -e "    pm2 monit  - Monitor all processes"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
