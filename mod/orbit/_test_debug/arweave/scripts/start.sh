#!/bin/bash

# Arweave App Startup Script

cd "$(dirname "$0")/../app" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the development server
echo "Starting Arweave app on http://localhost:8850"
npm run dev
