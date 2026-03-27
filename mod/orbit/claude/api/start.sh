#!/bin/bash
cd "$(dirname "$0")"

PORT="${1:-8820}"

# Stop existing
bash "$(dirname "$0")/stop.sh" "$PORT" 2>/dev/null

# Build if no binary
if [ ! -f target/release/claude-jobs ]; then
    echo "Building API (release)..."
    cargo build --release || exit 1
fi

export CLAUDE_JOBS_LOCAL=1
echo "Starting API on port $PORT..."
exec ./target/release/claude-jobs "$PORT"
