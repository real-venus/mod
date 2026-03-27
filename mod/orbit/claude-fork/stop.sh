#!/bin/bash
cd "$(dirname "$0")"

echo "Stopping claude-fork services..."

# Stop API (port 8830)
bash api/stop.sh 2>/dev/null
# Stop App (port 8831)
bash app/stop.sh 2>/dev/null

echo "All claude-fork services stopped."
