#!/bin/bash
cd "$(dirname "$0")"

PORT="${1:-8821}"

# Stop existing
bash "$(dirname "$0")/stop.sh" "$PORT" 2>/dev/null

# Install deps if needed
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install || exit 1
fi

echo "Starting app on port $PORT..."
exec npx next dev -p "$PORT"
