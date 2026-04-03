#!/bin/bash

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/ports.sh"

echo -e "${BLUE}Uniswap Module Status${NC}"
echo ""

pm2 list

# Load env for port numbers
[ -f "$ROOT_DIR/.env" ] && export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
ENGINE_PORT=${PORT:-8080}
APP_PORT=${APP_PORT:-3000}

echo ""
echo -e "${BLUE}Ports:${NC}"
pid=$(port_pid $ENGINE_PORT)
[ -n "$pid" ] && echo -e "  Engine ($ENGINE_PORT): ${GREEN}in use (pid $pid)${NC}" || echo -e "  Engine ($ENGINE_PORT): ${YELLOW}free${NC}"
pid=$(port_pid $APP_PORT)
[ -n "$pid" ] && echo -e "  App    ($APP_PORT): ${GREEN}in use (pid $pid)${NC}" || echo -e "  App    ($APP_PORT): ${YELLOW}free${NC}"

echo ""
echo -e "${BLUE}Commands:${NC}"
echo "  scripts/start.sh   scripts/stop.sh   scripts/restart.sh   scripts/logs.sh"
