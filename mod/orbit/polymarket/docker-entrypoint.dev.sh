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

# ── Build CID + onchain pin ──
# Prefer the localfs/IPFS CID published onchain via
# `m polymarket/publish_build` (recorded in /app/config.json under
# build_onchain). Falls back to a deterministic sha256 manifest so a
# never-published build still has a verifiable hash.
BUILD_CID=""
BUILD_TX=""
BUILD_SCAN=""
if [ -f /app/config.json ]; then
    BUILD_CID=$(python3 -c "import json; print(json.load(open('/app/config.json')).get('build_onchain',{}).get('cid',''))" 2>/dev/null || echo "")
    BUILD_TX=$(python3 -c "import json; print(json.load(open('/app/config.json')).get('build_onchain',{}).get('tx_hash',''))" 2>/dev/null || echo "")
    BUILD_SCAN=$(python3 -c "import json; print(json.load(open('/app/config.json')).get('build_onchain',{}).get('scan',''))" 2>/dev/null || echo "")
fi
cd /app/src/app
if [ -z "$BUILD_CID" ]; then
    if command -v sha256sum > /dev/null 2>&1; then
        BUILD_HASH=$(find app -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' \) \
            | sort \
            | xargs sha256sum 2>/dev/null \
            | sha256sum \
            | cut -d' ' -f1)
        BUILD_CID="sha256:${BUILD_HASH}"
    else
        BUILD_CID="dev-$(date +%s)"
    fi
fi
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Build CID: $BUILD_CID${BUILD_TX:+ (tx: $BUILD_TX)}"

# ── Start Next.js (dev mode with hot-reload) ──
POLYMARKET_API_URL="http://localhost:$API_PORT" \
NEXT_PUBLIC_API_URL="/api/polymarket" \
NEXT_PUBLIC_BASE_PATH="/polymarket" \
NEXT_PUBLIC_BUILD_CID="$BUILD_CID" \
NEXT_PUBLIC_BUILD_TIME="$BUILD_TIME" \
NEXT_PUBLIC_BUILD_TX="$BUILD_TX" \
NEXT_PUBLIC_BUILD_SCAN="$BUILD_SCAN" \
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
# Host-side sibling modules (e.g. whitepaper) are reached via host.docker.internal.
WHITEPAPER_HOST="${WHITEPAPER_HOST:-host.docker.internal}"
WHITEPAPER_HOST_API_PORT="${WHITEPAPER_HOST_API_PORT:-50106}"
WHITEPAPER_HOST_APP_PORT="${WHITEPAPER_HOST_APP_PORT:-3106}"

cat > /app/Caddyfile <<EOF
{
    admin localhost:2019
}

:${GATEWAY_PORT} {
    # polymarket API
    @api path /api/polymarket /api/polymarket/*
    handle @api {
        uri strip_prefix /api/polymarket
        reverse_proxy localhost:${API_PORT}
    }

    # polymarket CLOB L2 passthrough (order/balance/orders/cancel).
    # Browser can't hit clob.polymarket.com directly (no CORS), so we
    # transparently reverse-proxy authenticated L2 calls to upstream.
    @l2 path /api/polymarket-l2 /api/polymarket-l2/*
    handle @l2 {
        uri strip_prefix /api/polymarket-l2
        reverse_proxy https://clob.polymarket.com {
            header_up Host clob.polymarket.com
        }
    }

    # whitepaper (sibling orbit module on the host)
    @whitepaper_api path /api/whitepaper /api/whitepaper/*
    handle @whitepaper_api {
        uri strip_prefix /api/whitepaper
        reverse_proxy ${WHITEPAPER_HOST}:${WHITEPAPER_HOST_API_PORT}
    }
    handle /whitepaper* {
        reverse_proxy ${WHITEPAPER_HOST}:${WHITEPAPER_HOST_APP_PORT}
    }

    # polymarket catchall (must remain last)
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
