#!/bin/bash

# Arweave Module Status Check

cd "$(dirname "$0")/.." || exit 1

echo "🔍 Arweave Module Status Check"
echo "================================"
echo ""

# Check Python module
echo "📦 Python Module:"
if [ -f "arweave.py" ]; then
    echo "  ✅ arweave.py found"
    lines=$(wc -l < arweave.py | tr -d ' ')
    echo "  📄 $lines lines"
else
    echo "  ❌ arweave.py not found"
fi
echo ""

# Check app directory
echo "🌐 Web App:"
if [ -d "app" ]; then
    echo "  ✅ app directory found"

    if [ -f "app/package.json" ]; then
        echo "  ✅ package.json present"
    fi

    if [ -d "app/node_modules" ]; then
        count=$(ls -1 app/node_modules | wc -l | tr -d ' ')
        echo "  ✅ node_modules installed ($count packages)"
    else
        echo "  ⚠️  node_modules not installed (run: npm install)"
    fi

    if [ -d "app/.next" ]; then
        echo "  ✅ Build artifacts present"
    else
        echo "  ℹ️  Not built yet (run: npm run build)"
    fi
else
    echo "  ❌ app directory not found"
fi
echo ""

# Check if server is running
echo "🚀 Server Status:"
if lsof -Pi :8850 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  ✅ Server running on port 8850"
    echo "  🔗 http://localhost:8850"
else
    echo "  ⚠️  Server not running"
    echo "  💡 Start with: ./scripts/start.sh"
fi
echo ""

# Check source files
echo "📁 Source Files:"
tsx_count=$(find app/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
echo "  📄 TypeScript files: $tsx_count"
echo ""

echo "✨ Status check complete!"
