#!/bin/bash
# Entrypoint runs as root to set up the credential mount, then drops to a
# non-root user (`claude`, uid 1000) before launching anything that will
# spawn the `claude` CLI. Claude Code refuses --dangerously-skip-permissions
# when invoked as root, so the privilege drop is load-bearing.
set -e

API_PORT="${API_PORT:-8820}"
APP_PORT="${APP_PORT:-8821}"

CRED_SRC="/host-claude/.credentials.json"
CRED_DIR="/home/node/.claude"
CRED_DST="$CRED_DIR/.credentials.json"

mkdir -p "$CRED_DIR"

if [ -f "$CRED_SRC" ]; then
    # Symlink so the CLI reads the live host file and can write refreshed tokens
    ln -sf "$CRED_SRC" "$CRED_DST"
    # When OAuth creds are present, unset any inherited ANTHROPIC_API_KEY so
    # claude doesn't prefer a stale/external key over the subscription token.
    unset ANTHROPIC_API_KEY
    echo "credentials: linked from host mount (OAuth subscription, ANTHROPIC_API_KEY ignored)"
elif [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "credentials: using ANTHROPIC_API_KEY env (no host mount)"
else
    echo "credentials: NONE — claude CLI will fail until you mount ~/.claude/.credentials.json or set ANTHROPIC_API_KEY" >&2
fi

chown -R node:node "$CRED_DIR"

# Off-chain auth state (whitelist.json, gate.json, owner.json). Host-mounted at
# /home/node/.mod/claude — ensure it exists and is owned by `node` so the API
# (running as node) can read+write it.
PRIVATE_DIR="/home/node/.mod/claude"
mkdir -p "$PRIVATE_DIR"
chown -R node:node "$PRIVATE_DIR" 2>/dev/null || true

# Inner script runs as non-root: starts Rust API + Next.js, traps shutdown.
cat > /tmp/run-as-claude.sh <<EOF
#!/bin/bash
set -e
API_PORT=$API_PORT
APP_PORT=$APP_PORT

# runuser doesn't reset HOME by default — force it to node's home so the
# claude CLI can find ~/.claude/.credentials.json (the OAuth subscription token).
export HOME=/home/node
export USER=node

PORT=\$API_PORT /app/bin/claude-jobs &
API_PID=\$!
echo "claude-jobs API on :\$API_PORT (pid \$API_PID)"

for i in \$(seq 1 30); do
    if curl -sf "http://localhost:\$API_PORT/health" > /dev/null 2>&1; then
        echo "API ready"
        break
    fi
    sleep 1
done

cd /app/src/app
NEXT_PUBLIC_BASE_PATH="/claude" \\
PORT=\$APP_PORT \\
HOSTNAME="0.0.0.0" \\
npx next start -p \$APP_PORT -H 0.0.0.0 &
APP_PID=\$!
echo "next.js app on :\$APP_PORT (pid \$APP_PID)"

cleanup() {
    echo "shutting down..."
    kill \$APP_PID \$API_PID 2>/dev/null || true
    wait \$APP_PID \$API_PID 2>/dev/null || true
}
trap cleanup SIGTERM SIGINT

wait -n \$API_PID \$APP_PID
EXIT=\$?
cleanup
exit \$EXIT
EOF
chmod +x /tmp/run-as-claude.sh
chown node:node /tmp/run-as-claude.sh

exec runuser -u node -- /tmp/run-as-claude.sh
