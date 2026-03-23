#!/bin/bash

# Arena Web App Startup Script

echo "🎮 Starting Arena Web App..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if config.json has contract addresses
if grep -q "0x0000000000000000000000000000000000000000" config.json; then
    echo "⚠️  Warning: Contract addresses not configured in config.json"
    echo "Please deploy contracts first:"
    echo "  cd ../contracts"
    echo "  npm install"
    echo "  export PRIVATE_KEY=your_key"
    echo "  npm run deploy"
    echo "  # Then copy addresses to app/config.json"
    echo ""
fi

# Start development server
echo "🚀 Starting development server on http://localhost:3000"
npm run dev
