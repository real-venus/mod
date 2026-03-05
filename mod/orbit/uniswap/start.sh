#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Uniswap Module${NC}"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if .env exists
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example${NC}"
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please edit .env with your configuration${NC}"
    else
        echo -e "${YELLOW}⚠️  No .env file found. Proceeding with environment defaults${NC}"
    fi
fi

# Load environment variables if .env exists
if [ -f .env ]; then
    echo -e "${BLUE}📋 Loading environment variables${NC}"
    export $(grep -v '^#' .env | xargs)
fi

# Check if Python dependencies are installed
echo -e "${BLUE}🐍 Checking Python dependencies${NC}"
if [ -f server/requirements.txt ]; then
    pip3 install -q -r server/requirements.txt
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
fi

# Check if Node.js dependencies are installed
echo -e "${BLUE}📦 Checking Node.js dependencies${NC}"
if [ -d app ] && [ -f app/package.json ]; then
    if [ ! -d app/node_modules ]; then
        echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
        cd app
        npm install --silent
        cd ..
        echo -e "${GREEN}✓ Node.js dependencies installed${NC}"
    else
        echo -e "${GREEN}✓ Node.js dependencies already installed${NC}"
    fi

    # Build Next.js app if not already built
    if [ ! -d app/.next ]; then
        echo -e "${BLUE}🔨 Building Next.js app${NC}"
        cd app
        npm run build
        cd ..
        echo -e "${GREEN}✓ Next.js app built${NC}"
    fi
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed${NC}"
    echo -e "${YELLOW}Installing PM2 globally...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}"
fi

# Stop existing instances if running
echo -e "${BLUE}🛑 Stopping existing instances${NC}"
pm2 delete uniswap-server 2>/dev/null || true
pm2 delete uniswap-app 2>/dev/null || true

# Start services using PM2
echo -e "${BLUE}🚀 Starting services with PM2${NC}"
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Display status
echo ""
echo -e "${GREEN}✓ Services started successfully${NC}"
echo ""
pm2 list

echo ""
echo -e "${BLUE}📊 View logs:${NC}"
echo -e "  Server: ${YELLOW}pm2 logs uniswap-server${NC}"
echo -e "     App: ${YELLOW}pm2 logs uniswap-app${NC}"
echo -e "     All: ${YELLOW}pm2 logs${NC}"
echo ""
echo -e "${BLUE}📈 Monitor:${NC}"
echo -e "  ${YELLOW}pm2 monit${NC}"
echo ""
echo -e "${BLUE}🛑 Stop:${NC}"
echo -e "  ${YELLOW}./stop.sh${NC}"
echo ""
