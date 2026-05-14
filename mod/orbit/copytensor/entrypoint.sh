#!/bin/bash
set -e

PORT=${PORT:-50150}
APP_PORT=${APP_PORT:-3150}

# Start the Rust API in the background
echo "starting copytensor-api on port $PORT..."
cd /app
./copytensor-api &
API_PID=$!

# Wait for API to be ready
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
        echo "api ready"
        break
    fi
    sleep 1
done

# Start Next.js frontend
echo "starting frontend on port $APP_PORT..."
cd /app/frontend
NEXT_PUBLIC_API_URL="http://localhost:$PORT" npx next start -p "$APP_PORT" &
NEXT_PID=$!

echo "copytensor running — api=$PORT app=$APP_PORT"

# Wait for either process to exit
wait -n $API_PID $NEXT_PID
