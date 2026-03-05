#!/bin/bash
# Polycopy Restart Script - Restart services with PM2

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${YELLOW}Restarting Polycopy services...${NC}"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}Error: PM2 not installed${NC}"
    echo "Install with: npm install -g pm2"
    exit 1
fi

# Restart services
echo -e "${BLUE}Restarting PM2 services...${NC}"

if pm2 describe polycopy-api &>/dev/null; then
    echo "Restarting API server..."
    pm2 restart polycopy-api
    echo -e "${GREEN}✓ API server restarted${NC}"
else
    echo -e "${YELLOW}API server not running, starting it...${NC}"
    ./start.sh
    exit 0
fi

if pm2 describe polycopy-app &>/dev/null; then
    echo "Restarting Web UI..."
    pm2 restart polycopy-app
    echo -e "${GREEN}✓ Web UI restarted${NC}"
else
    echo -e "${YELLOW}Web UI not running${NC}"
fi

# Save PM2 state
pm2 save --force &>/dev/null

echo ""
echo -e "${GREEN}✓ Services restarted${NC}"
echo ""
echo -e "${YELLOW}Quick check:${NC}"
echo "  pm2 status"
echo "  pm2 logs polycopy"
echo ""
