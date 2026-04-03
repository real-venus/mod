#!/bin/bash
# Polymarket 8-Bit Terminal — start via pm2

APP_NAME="polymarket-8bit"
APP_DIR="$(cd "$(dirname "$0")/../app" && pwd)"
PORT=3030

# Find an open port starting from 3030
while lsof -i :"$PORT" >/dev/null 2>&1; do
  echo "Port $PORT in use, trying next..."
  PORT=$((PORT + 1))
done

# Kill existing pm2 process if it exists
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "Stopping existing $APP_NAME..."
  pm2 delete "$APP_NAME"
fi

echo "Starting $APP_NAME on port $PORT..."

cd "$APP_DIR" && pm2 start npm \
  --name "$APP_NAME" \
  -- run dev -- -p "$PORT"

echo ""
echo "================================"
echo "  POLYMARKET 8BIT TERMINAL"
echo "  http://localhost:$PORT"
echo "================================"
echo ""

pm2 logs "$APP_NAME" --lines 5 --nostream
