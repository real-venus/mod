#!/bin/bash
# Hyperliquid Dashboard Stop Script - Gracefully shutdown all services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${YELLOW}Stopping Hyperliquid Dashboard...${NC}"
echo ""

# Check if PM2 is running our services
if command -v pm2 &> /dev/null; then
    PM2_LIST=$(pm2 jlist 2>/dev/null || echo "[]")

    if echo "$PM2_LIST" | grep -q "hyperliquid-api\|hyperliquid-app"; then
        echo -e "${BLUE}Stopping PM2 services...${NC}"

        # Stop API
        if pm2 describe hyperliquid-api &>/dev/null; then
            echo -e "${BLUE}Stopping API server...${NC}"
            pm2 delete hyperliquid-api
            echo -e "${GREEN}✓ API server stopped${NC}"
        fi

        # Stop App
        if pm2 describe hyperliquid-app &>/dev/null; then
            echo -e "${BLUE}Stopping Dashboard app...${NC}"
            pm2 delete hyperliquid-app
            echo -e "${GREEN}✓ Dashboard app stopped${NC}"
        fi

        # Save PM2 process list
        pm2 save --force &>/dev/null || true
    else
        echo -e "${YELLOW}No PM2 services running${NC}"
    fi
else
    echo -e "${YELLOW}PM2 not found, skipping PM2 cleanup${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Hyperliquid Dashboard stopped successfully${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
