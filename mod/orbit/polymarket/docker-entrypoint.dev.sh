#!/bin/bash
set -e

API_PORT=50091
APP_PORT=3091
GATEWAY_PORT="${GATEWAY_PORT:-3000}"

echo "── polymarket dev ──"

# ── Start Rust API ──
PORT=$API_PORT STRAT_HMAC_SECRET="${STRAT_HMAC_SECRET:-}" /app/bin/polymarket-api &
API_PID=$!
echo "API starting on :$API_PORT (pid $API_PID)"

# Wait for API to be ready
for i in $(seq 1 30); do
    if curl -sf http://localhost:$API_PORT/health > /dev/null 2>&1; then
        echo "API ready"
        break
    fi
    sleep 1
done

# ── Start Next.js (dev mode with hot-reload) ──
cd /app/src/app
POLYMARKET_API_URL="http://localhost:$API_PORT" \
NEXT_PUBLIC_API_URL="/api/polymarket" \
NEXT_PUBLIC_BASE_PATH="/polymarket" \
PORT=$APP_PORT \
npx next dev -p $APP_PORT &
APP_PID=$!
echo "App (dev) starting on :$APP_PORT (pid $APP_PID)"
cd /app

# Wait for app to be ready
for i in $(seq 1 60); do
    if curl -sf http://localhost:$APP_PORT/polymarket > /dev/null 2>&1; then
        echo "App ready"
        break
    fi
    sleep 1
done

# ── Generate Caddyfile ──
cat > /app/Caddyfile <<EOF
{
    admin off
}

:${GATEWAY_PORT} {
    @api path /api/polymarket /api/polymarket/*
    handle @api {
        uri strip_prefix /api/polymarket
        reverse_proxy localhost:${API_PORT}
    }
    handle /* {
        reverse_proxy localhost:${APP_PORT}
    }
}
EOF

# ── Start Caddy ──
caddy run --config /app/Caddyfile &
CADDY_PID=$!
echo "Gateway on :$GATEWAY_PORT (pid $CADDY_PID)"

echo ""
echo "  API:     http://localhost:$API_PORT/health"
echo "  App:     http://localhost:$APP_PORT/polymarket (dev mode)"
echo "  Gateway: http://localhost:$GATEWAY_PORT/polymarket"
echo ""

# ── Handle shutdown ──
cleanup() {
    echo "shutting down..."
    kill $CADDY_PID $APP_PID $API_PID 2>/dev/null
    wait $CADDY_PID $APP_PID $API_PID 2>/dev/null
}
trap cleanup SIGTERM SIGINT

# Wait for any process to exit
wait -n $API_PID $APP_PID $CADDY_PID
EXIT_CODE=$?
echo "process exited with code $EXIT_CODE — stopping all"
cleanup
exit $EXIT_CODE
