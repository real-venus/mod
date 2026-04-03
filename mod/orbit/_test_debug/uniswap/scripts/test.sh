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

[ -f .env ] && export $(grep -v '^#' .env | xargs)
ENGINE_PORT=${PORT:-8080}
APP_PORT=${APP_PORT:-3000}

test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    echo -ne "  $name... "
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$4" 2>/dev/null)
    fi
    http_code=$(echo "$response" | tail -n1)
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}FAILED (HTTP $http_code)${NC}"
        return 1
    fi
}

echo -e "${BLUE}Testing Uniswap Module${NC}"
echo ""

echo -e "${BLUE}1. PM2 Status${NC}"
if pm2 list | grep -q "uniswap"; then
    echo -e "${GREEN}✓ PM2 processes found${NC}"
else
    echo -e "${RED}✗ No processes running — starting...${NC}"
    "$SCRIPT_DIR/start.sh"
    sleep 5
fi

echo ""
echo -e "${BLUE}2. Engine Endpoints (port $ENGINE_PORT)${NC}"
test_endpoint "Health" "http://localhost:$ENGINE_PORT/health"
test_endpoint "Root" "http://localhost:$ENGINE_PORT/"
test_endpoint "Quote" "http://localhost:$ENGINE_PORT/quote?token_in=0x4200000000000000000000000000000000000006&token_out=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=0.01"

echo ""
echo -e "${BLUE}3. App (port $APP_PORT)${NC}"
test_endpoint "Homepage" "http://localhost:$APP_PORT/"

echo ""
echo -e "${GREEN}✓ Tests complete${NC}"
