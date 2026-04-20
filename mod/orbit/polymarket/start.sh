#!/bin/bash
# Polymarket — start API + App
DIR="$(cd "$(dirname "$0")" && pwd)"

API_PORT=50091
APP_PORT=3091

echo "Starting Polymarket..."

# API (FastAPI/uvicorn)
cd "$DIR/polymarket"
pm2 delete polymarket-api 2>/dev/null
pm2 start "uvicorn server:app --host 0.0.0.0 --port $API_PORT --reload" --name polymarket-api
echo "  API  → http://localhost:$API_PORT"

# App (Next.js)
cd "$DIR/app"
[ ! -d node_modules ] && npm install
pm2 delete polymarket-app 2>/dev/null
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" pm2 start "npm run dev -- -p $APP_PORT" --name polymarket-app
echo "  App  → http://localhost:$APP_PORT"

echo ""
pm2 status | grep polymarket
