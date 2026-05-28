#!/usr/bin/env bash
# multistore — `m serve` brings up both the Python API (port 50160) and the
# Next.js dashboard (port 50161) for us. Nothing else to orchestrate.
set -e

API_PORT="${API_PORT:-50160}"
LOG_DIR="${LOG_DIR:-/tmp/multistore}"
mkdir -p "$LOG_DIR"

echo "── multistore ───────────────────────────────────────"
echo "  API  : 0.0.0.0:${API_PORT}"
echo "  APP  : 0.0.0.0:${APP_PORT:-50161}  (auto-started by m serve)"
echo "─────────────────────────────────────────────────────"

# `m serve` is foreground — Flask blocks until SIGTERM and the Next.js app it
# spawned shuts down with it (it's a child process). PYTHONUNBUFFERED so the
# logs hit docker logs in real time.
exec env PYTHONUNBUFFERED=1 m serve port="$API_PORT" mod=multistore remote=0
