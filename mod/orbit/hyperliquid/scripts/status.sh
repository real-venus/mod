#!/bin/bash
# Hyperliquid Dashboard Status Script

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Hyperliquid Dashboard Status${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}✗ PM2 not installed${NC}"
    exit 1
fi

# Get PM2 status
pm2 list

echo ""
echo -e "${BLUE}Quick Commands:${NC}"
echo -e "  View logs:    ${YELLOW}pm2 logs hyperliquid${NC}"
echo -e "  Monitor:      ${YELLOW}pm2 monit${NC}"
echo -e "  Restart:      ${YELLOW}pm2 restart hyperliquid${NC}"
echo -e "  Stop:         ${YELLOW}./stop.sh${NC}"
echo ""

# Check if services are responding
echo -e "${BLUE}Service Health:${NC}"

# Check API
if curl -s http://localhost:8002/ > /dev/null 2>&1; then
    echo -e "  API:       ${GREEN}✓ Running${NC} (http://localhost:8002)"
else
    echo -e "  API:       ${RED}✗ Not responding${NC}"
fi

# Check App
if curl -s http://localhost:3002/ > /dev/null 2>&1; then
    echo -e "  Dashboard: ${GREEN}✓ Running${NC} (http://localhost:3002)"
else
    echo -e "  Dashboard: ${RED}✗ Not responding${NC}"
fi

echo ""
