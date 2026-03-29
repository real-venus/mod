#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

API_PORT=5001
GATEWAY_PORT=8080
SERVE_PORT=50079

# Check if IPFS daemon is already running
if curl -sf "http://127.0.0.1:$API_PORT/api/v0/id" -X POST > /dev/null 2>&1; then
    echo "[ipfs] daemon already running"
else
    echo "[ipfs] starting daemon..."

    # Install Kubo if not present
    if ! command -v ipfs &> /dev/null; then
        echo "[ipfs] installing Kubo..."
        python3 -c "from ipfs.ipfs import IpfsClient; IpfsClient(autostart=False).install()"
    fi

    # Init repo if needed
    if [ ! -d ~/.ipfs ]; then
        ipfs init
    fi

    # Start daemon in background
    export IPFS_PATH=~/.ipfs
    nohup ipfs daemon > ~/.ipfs/daemon.log 2>&1 &
    DAEMON_PID=$!
    echo "$DAEMON_PID" > ~/.ipfs/daemon.pid
    echo "[ipfs] daemon started (pid $DAEMON_PID)"

    # Wait for API to come up
    for i in $(seq 1 15); do
        if curl -sf "http://127.0.0.1:$API_PORT/api/v0/id" -X POST > /dev/null 2>&1; then
            echo "[ipfs] API ready"
            break
        fi
        sleep 1
    done
fi

# Start mod serve
echo "[ipfs] starting mod serve on port $SERVE_PORT"
m serve port=$SERVE_PORT key=ipfs remote=0 mod=ipfs
