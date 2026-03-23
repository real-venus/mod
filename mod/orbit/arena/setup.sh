#!/bin/bash

# Arena Platform Setup Script
# Automates deployment and configuration

set -e

echo "🎮 Arena Platform Setup"
echo "======================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version)${NC}"
echo -e "${GREEN}✅ npm $(npm --version)${NC}"
echo ""

# Step 1: Install contract dependencies
echo "📦 Step 1/4: Installing contract dependencies..."
cd contracts
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Contract dependencies installed${NC}"
else
    echo -e "${YELLOW}⏭️  Dependencies already installed${NC}"
fi
echo ""

# Step 2: Compile contracts
echo "🔨 Step 2/4: Compiling smart contracts..."
if npx hardhat compile; then
    echo -e "${GREEN}✅ Contracts compiled successfully${NC}"
else
    echo -e "${RED}❌ Contract compilation failed${NC}"
    exit 1
fi
echo ""

# Step 3: Check for deployment
echo "🚀 Step 3/4: Deployment check..."
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${YELLOW}⚠️  PRIVATE_KEY not set${NC}"
    echo ""
    echo "To deploy contracts:"
    echo "  export PRIVATE_KEY=your_private_key"
    echo "  npm run deploy"
    echo ""
    echo -e "${YELLOW}Skipping deployment for now...${NC}"
else
    echo "Private key detected. Deploy contracts? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        if npm run deploy; then
            echo -e "${GREEN}✅ Contracts deployed successfully${NC}"

            # Check if deployment.json exists
            if [ -f "deployment.json" ]; then
                echo ""
                echo "Contract addresses:"
                cat deployment.json | grep -A 2 "contracts"
                echo ""
                echo -e "${YELLOW}📝 Please copy these addresses to app/config.json${NC}"
            fi
        else
            echo -e "${RED}❌ Deployment failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⏭️  Skipping deployment${NC}"
    fi
fi
echo ""

# Step 4: Install app dependencies
echo "📦 Step 4/4: Installing app dependencies..."
cd ../app
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ App dependencies installed${NC}"
else
    echo -e "${YELLOW}⏭️  Dependencies already installed${NC}"
fi
echo ""

# Final instructions
echo "═══════════════════════════════════════════"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "═══════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure contract addresses:"
echo "   - If you deployed contracts, copy addresses from contracts/deployment.json"
echo "   - Update app/config.json with your contract addresses"
echo ""
echo "2. Start the development server:"
echo "   cd app"
echo "   npm run dev"
echo ""
echo "3. Open http://localhost:3000"
echo ""
echo "4. Connect MetaMask wallet (Base Sepolia network)"
echo ""
echo "For more help:"
echo "  - Quick Start: ./QUICKSTART.md"
echo "  - Full Guide: ./DEPLOYMENT_GUIDE.md"
echo "  - Web App Info: ./WEB_APP_SUMMARY.md"
echo ""
echo -e "${GREEN}Happy competing! 🎮${NC}"
