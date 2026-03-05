#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Uniswap Module Status${NC}"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed${NC}"
    exit 1
fi

# Show PM2 status
pm2 list

echo ""
echo -e "${BLUE}📋 Quick Commands:${NC}"
echo -e "  Start:   ${YELLOW}./start.sh${NC}"
echo -e "  Stop:    ${YELLOW}./stop.sh${NC}"
echo -e "  Restart: ${YELLOW}pm2 restart all${NC}"
echo -e "  Logs:    ${YELLOW}pm2 logs${NC}"
echo -e "  Monitor: ${YELLOW}pm2 monit${NC}"
echo ""
