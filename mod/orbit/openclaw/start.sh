#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"

trap 'kill 0; exit' SIGINT SIGTERM

# api
cd "$DIR"
uvicorn api:app --host 0.0.0.0 --port 50120 --reload &

# app
cd "$DIR/app"
npm run dev &

echo ""
echo "openclaw running"
echo "  api: http://localhost:50120"
echo "  app: http://localhost:3120"
echo ""

wait
