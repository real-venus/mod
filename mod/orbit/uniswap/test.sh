#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Uniswap Module${NC}"
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}

    echo -ne "  Testing ${name}... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$4" 2>/dev/null)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED (HTTP $http_code)${NC}"
        return 1
    fi
}

# Check if services are running
echo -e "${BLUE}1. Checking PM2 Status${NC}"
if pm2 list | grep -q "uniswap"; then
    echo -e "${GREEN}✓ PM2 processes found${NC}"
    pm2 list | grep "uniswap"
else
    echo -e "${RED}✗ No Uniswap processes running${NC}"
    echo -e "${YELLOW}Starting services...${NC}"
    ./start.sh
    sleep 5
fi

echo ""
echo -e "${BLUE}2. Testing Server Endpoints${NC}"

# Test server health
test_endpoint "Health Check" "http://localhost:8080/health"

# Test root endpoint
test_endpoint "Server Root" "http://localhost:8080/"

# Test quote endpoint
test_endpoint "Quote API" "http://localhost:8080/quote?token_in=0x4200000000000000000000000000000000000006&token_out=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=0.01"

echo ""
echo -e "${BLUE}3. Testing Next.js App${NC}"

# Test app
test_endpoint "App Homepage" "http://localhost:3000/"

echo ""
echo -e "${BLUE}4. Checking Logs${NC}"

# Check for errors in logs
if [ -d logs ]; then
    error_count=$(grep -i "error" logs/*.log 2>/dev/null | wc -l | xargs)
    if [ "$error_count" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $error_count error entries in logs${NC}"
        echo -e "${YELLOW}Check logs with: ./logs.sh${NC}"
    else
        echo -e "${GREEN}✓ No errors found in logs${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No logs directory found${NC}"
fi

echo ""
echo -e "${BLUE}5. Resource Usage${NC}"

# Show PM2 resource usage
pm2 describe uniswap-server | grep -E "(memory|cpu)" || true
pm2 describe uniswap-app | grep -E "(memory|cpu)" || true

echo ""
echo -e "${GREEN}✓ Testing complete${NC}"
echo ""
echo -e "${BLUE}📋 Quick Commands:${NC}"
echo -e "  Status:  ${YELLOW}./status.sh${NC}"
echo -e "  Logs:    ${YELLOW}./logs.sh${NC}"
echo -e "  Restart: ${YELLOW}./restart.sh${NC}"
echo -e "  Stop:    ${YELLOW}./stop.sh${NC}"
echo ""
