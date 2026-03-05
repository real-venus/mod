#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Uniswap Module${NC}"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed${NC}"
    exit 1
fi

# Stop all uniswap services
echo -e "${YELLOW}Stopping services...${NC}"
pm2 delete uniswap-server 2>/dev/null && echo -e "${GREEN}✓ Stopped uniswap-server${NC}" || echo -e "${YELLOW}⚠️  uniswap-server not running${NC}"
pm2 delete uniswap-app 2>/dev/null && echo -e "${GREEN}✓ Stopped uniswap-app${NC}" || echo -e "${YELLOW}⚠️  uniswap-app not running${NC}"

# Save PM2 configuration
pm2 save --force

echo ""
echo -e "${GREEN}✓ All services stopped${NC}"
echo ""

# Show remaining PM2 processes
if pm2 list | grep -q "online"; then
    echo -e "${BLUE}📊 Remaining PM2 processes:${NC}"
    pm2 list
else
    echo -e "${BLUE}No PM2 processes running${NC}"
fi
