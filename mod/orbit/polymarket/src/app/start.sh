#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3091}"
API_PORT="${API_PORT:-50091}"

cd "$DIR"

[ ! -d node_modules ] && npm install --no-audit --no-fund

export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT"
export NEXT_PUBLIC_BASE_PATH="/polymarket"
exec npx next dev -p "$PORT"
