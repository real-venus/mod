#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Install frontend deps if needed
if [ ! -d "$DIR/app/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd "$DIR/app" && npm install
fi

# Find a free port starting from 3090
PORT=3090
while lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

# Start Next.js app
echo "Starting bt-copytrade app on port $PORT..."
cd "$DIR/app" && PORT="$PORT" npm run dev
