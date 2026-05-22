#!/usr/bin/env bash
# Entrypoint: start FastAPI gateway + Next.js app concurrently.
set -e

API_PORT="${STORE_API_PORT:-50150}"
APP_PORT="${STORE_APP_PORT:-50151}"

echo "── mod store ───────────────────────────────────────────────"
echo "  API : 0.0.0.0:${API_PORT}"
echo "  APP : 0.0.0.0:${APP_PORT}"
echo "  data: /data"
echo "────────────────────────────────────────────────────────────"

# Persist SQLite indexes under /data
export HOME=/data
mkdir -p /data/.store-mod /data/.filecoin-mod /data/.hippius-mod

cleanup() {
    echo "shutting down…"
    kill "${API_PID:-}" "${APP_PID:-}" 2>/dev/null || true
    wait 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

cd /app
uvicorn api.api:app --host 0.0.0.0 --port "${API_PORT}" --log-level info &
API_PID=$!
echo "  api  pid=${API_PID}"

cd /app/app
PORT="${APP_PORT}" HOSTNAME="0.0.0.0" npx next start -p "${APP_PORT}" -H 0.0.0.0 &
APP_PID=$!
echo "  app  pid=${APP_PID}"

# If either dies, propagate exit.
wait -n
EXIT_CODE=$?
echo "one process exited (code=${EXIT_CODE}); stopping the other"
cleanup
