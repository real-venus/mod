#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Install frontend deps if needed
if [ ! -d "$DIR/app/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd "$DIR/app" && npm install
fi

# Start Next.js app
echo "Starting bt-copytrade app on port 3090..."
cd "$DIR/app" && npm run dev
