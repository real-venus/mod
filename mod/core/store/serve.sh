#!/usr/bin/env bash
# Launch mod store: FastAPI gateway + Next.js app
# Usage: ./serve.sh [--no-app] [--no-api]
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

API_PORT=${STORE_API_PORT:-50150}
APP_PORT=${STORE_APP_PORT:-50151}
LOG_DIR=${STORE_LOG_DIR:-/tmp/store}
mkdir -p "$LOG_DIR"

run_api=1
run_app=1
for arg in "$@"; do
  case $arg in
    --no-app) run_app=0 ;;
    --no-api) run_api=0 ;;
  esac
done

if [ "$run_api" = "1" ]; then
  echo "→ API   http://localhost:$API_PORT   (log: $LOG_DIR/api.log)"
  (cd "$DIR" && uvicorn api.api:app --host 0.0.0.0 --port "$API_PORT" --reload >"$LOG_DIR/api.log" 2>&1) &
  API_PID=$!
  echo "  pid=$API_PID"
fi

if [ "$run_app" = "1" ]; then
  echo "→ APP   http://localhost:$APP_PORT   (log: $LOG_DIR/app.log)"
  if [ ! -d "$DIR/app/node_modules" ]; then
    echo "  installing node deps (first run)…"
    (cd "$DIR/app" && npm install >"$LOG_DIR/install.log" 2>&1)
  fi
  (cd "$DIR/app" && PORT="$APP_PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" npm run dev >"$LOG_DIR/app.log" 2>&1) &
  APP_PID=$!
  echo "  pid=$APP_PID"
fi

trap 'echo; echo "stopping…"; kill ${API_PID:-} ${APP_PID:-} 2>/dev/null || true; exit 0' INT TERM
wait
