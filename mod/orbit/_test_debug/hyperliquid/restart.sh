#!/bin/bash
# Quick restart script

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Restarting Hyperliquid Dashboard...${NC}"

if [ "$1" == "api" ]; then
    pm2 restart hyperliquid-api
    echo -e "${GREEN}✓ API restarted${NC}"
elif [ "$1" == "app" ]; then
    pm2 restart hyperliquid-app
    echo -e "${GREEN}✓ App restarted${NC}"
else
    pm2 restart hyperliquid-api
    pm2 restart hyperliquid-app
    echo -e "${GREEN}✓ All services restarted${NC}"
fi

echo ""
pm2 status
