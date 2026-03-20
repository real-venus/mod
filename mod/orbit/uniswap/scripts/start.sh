#!/bin/bash

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

source "$SCRIPT_DIR/ports.sh"

echo -e "${BLUE}Starting Uniswap Module${NC}"

# Load env
if [ ! -f .env ]; then
    [ -f .env.example ] && cp .env.example .env && echo -e "${YELLOW}Created .env from .env.example — edit it${NC}"
fi
[ -f .env ] && export $(grep -v '^#' .env | xargs)

ENGINE_PORT=${PORT:-8080}
APP_PORT=${APP_PORT:-3000}

# Kill existing PM2 processes
pm2 delete uniswap-engine 2>/dev/null || true
pm2 delete uniswap-app 2>/dev/null || true

# Ensure ports are free
ensure_port $ENGINE_PORT "engine"
ensure_port $APP_PORT "app"

# Install deps if needed
mkdir -p logs
if [ -f server/requirements.txt ]; then
    pip3 install -q -r server/requirements.txt
fi
if [ -d app ] && [ -f app/package.json ] && [ ! -d app/node_modules ]; then
    echo -e "${BLUE}Installing Node.js dependencies...${NC}"
    cd app && npm install --silent && cd ..
fi

# Build Next.js if needed
if [ -d app ] && [ ! -d app/.next ]; then
    echo -e "${BLUE}Building Next.js app...${NC}"
    cd app && npm run build && cd ..
fi

# Start with PM2
echo -e "${BLUE}Starting services on ports engine=$ENGINE_PORT app=$APP_PORT${NC}"
PORT=$ENGINE_PORT APP_PORT=$APP_PORT pm2 start ecosystem.config.js
pm2 save

echo ""
echo -e "${GREEN}✓ Services started${NC}"
echo -e "  Engine: http://localhost:$ENGINE_PORT"
echo -e "  App:    http://localhost:$APP_PORT"
echo ""
pm2 list
