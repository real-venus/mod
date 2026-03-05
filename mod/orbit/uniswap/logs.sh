#!/bin/bash

# Colors for output
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Viewing PM2 logs (Ctrl+C to exit)${NC}"
echo ""

pm2 logs
