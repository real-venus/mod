#!/bin/bash
cd "$(dirname "$0")"

# Stop any existing instances
bash stop.sh 2>/dev/null

# Start API
bash api/start.sh &
API_PID=$!

# Start App
bash app/start.sh &
APP_PID=$!

trap "kill $API_PID $APP_PID 2>/dev/null" EXIT

echo "API:  http://localhost:8830"
echo "App:  http://localhost:8831"
echo "Press Ctrl+C to stop."

wait
