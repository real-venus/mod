#!/bin/bash
PORT="${1:-8830}"

pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
if [ -n "$pids" ]; then
    echo "Stopping API on port $PORT (PIDs: $pids)"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 0.5
    # Force kill stragglers
    pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
    [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
else
    echo "No API running on port $PORT"
fi

# Also kill any claude-fork-jobs binary
pkill -f "claude-fork-jobs" 2>/dev/null || true
