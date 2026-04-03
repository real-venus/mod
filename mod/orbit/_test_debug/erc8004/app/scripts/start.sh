#!/bin/bash

# ERC-8004 Frontend Start Script

echo "🚀 Starting ERC-8004 Frontend..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  No .env.local found, copying from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please update contract addresses in .env.local"
fi

# Start development server
echo "🎨 Starting Next.js development server..."
npm run dev
