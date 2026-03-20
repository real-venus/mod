#!/bin/bash

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

source "$SCRIPT_DIR/ports.sh"

echo -e "${BLUE}Stopping Uniswap Module${NC}"

# Load env for port numbers
[ -f .env ] && export $(grep -v '^#' .env | xargs)
ENGINE_PORT=${PORT:-8080}
APP_PORT=${APP_PORT:-3000}

# Stop PM2 processes
pm2 delete uniswap-engine 2>/dev/null && echo -e "${GREEN}✓ Stopped uniswap-engine${NC}" || echo -e "${YELLOW}uniswap-engine not running${NC}"
pm2 delete uniswap-app 2>/dev/null && echo -e "${GREEN}✓ Stopped uniswap-app${NC}" || echo -e "${YELLOW}uniswap-app not running${NC}"

# Also kill anything lingering on the ports
kill_port $ENGINE_PORT
kill_port $APP_PORT

pm2 save --force
echo -e "${GREEN}✓ All services stopped${NC}"
