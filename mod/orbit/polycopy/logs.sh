#!/bin/bash
# Polycopy Logs Script - View logs with PM2

# Colors
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}Error: PM2 not installed${NC}"
    exit 1
fi

# Default: show all polycopy logs
SERVICE="${1:-polycopy}"

echo ""
echo -e "${YELLOW}Showing logs for: $SERVICE${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
echo ""

# Show logs (follows by default)
pm2 logs "$SERVICE" --lines 100
