#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-3001}"

# Kill anything already listening on the port
lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null

# Start the Python server in the background
cd "$DIR"
source .venv/bin/activate 2>/dev/null
python -m polycopy.mod &
SERVER_PID=$!

# Start the Next.js app on the specified port
cd "$DIR/app"
npm run dev -- -p "$PORT" &
APP_PID=$!

echo "Server PID: $SERVER_PID"
echo "App PID: $APP_PID"
echo "App: http://localhost:$PORT"

# Trap exit to kill both
trap "kill $SERVER_PID $APP_PID 2>/dev/null" EXIT

wait
