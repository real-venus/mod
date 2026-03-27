#!/bin/bash
cd "$(dirname "$0")"

echo "Stopping claude services..."

# Stop API (port 8820)
bash api/stop.sh 2>/dev/null
# Stop App (port 8821)
bash app/stop.sh 2>/dev/null

echo "All claude services stopped."
