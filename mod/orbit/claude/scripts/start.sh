#!/usr/bin/env bash
#
# ╔══════════════════════════════════════════╗
# ║  CLAUDE JOBS — 8BIT STARTUP SCRIPT      ║
# ║  Starts Rust backend + Next.js frontend  ║
# ╚══════════════════════════════════════════╝
#
# Usage: ./scripts/start.sh [--build] [--dev]
#   --build   Force rebuild of Rust server
#   --dev     Run Next.js in dev mode (default)
#   --prod    Build and run Next.js in production mode

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$ROOT_DIR/api"
APP_DIR="$ROOT_DIR/app"

BACKEND_PID=""
FRONTEND_PID=""

BACKEND_PORT=8820
FRONTEND_PORT=8821

# ── Colors ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
AMBER='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
    echo -e "${GREEN}"
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║   CLAUDE JOBS // 8BIT TERMINAL          ║"
    echo "  ║   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║"
    echo "  ╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

log() {
    echo -e "  ${GREEN}[✓]${NC} $1"
}

warn() {
    echo -e "  ${AMBER}[!]${NC} $1"
}

err() {
    echo -e "  ${RED}[✕]${NC} $1"
}

info() {
    echo -e "  ${BLUE}[·]${NC} $1"
}

# ── Cleanup on exit ───────────────────────────────────────────────────
cleanup() {
    echo ""
    warn "Shutting down..."

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        info "Stopping frontend (PID $FRONTEND_PID)"
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
    fi

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        info "Stopping backend (PID $BACKEND_PID)"
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi

    log "All processes stopped. Bismillah."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ── Parse args ────────────────────────────────────────────────────────
FORCE_BUILD=false
PROD_MODE=false

for arg in "$@"; do
    case "$arg" in
        --build) FORCE_BUILD=true ;;
        --prod)  PROD_MODE=true ;;
        --dev)   PROD_MODE=false ;;
        --help|-h)
            echo "Usage: $0 [--build] [--dev|--prod]"
            echo "  --build   Force rebuild Rust server"
            echo "  --dev     Next.js dev mode (default)"
            echo "  --prod    Build + start Next.js production"
            exit 0
            ;;
    esac
done

# ── Kill existing processes ───────────────────────────────────────────
kill_existing() {
    local port=$1
    local name=$2
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        warn "Killing existing $name on port $port (PIDs: $pids)"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
}

# ── Main ──────────────────────────────────────────────────────────────

print_banner

# 0. Kill any existing claude-jobs / next.js on our ports
kill_existing 8820 "backend"
kill_existing 8821 "frontend"
# Also kill any leftover claude-jobs binary
pkill -f "claude-jobs" 2>/dev/null || true

# 1. Check prerequisites
info "Checking prerequisites..."

if ! command -v cargo &>/dev/null; then
    err "cargo not found — install Rust: https://rustup.rs"
    exit 1
fi

if ! command -v node &>/dev/null; then
    err "node not found — install Node.js: https://nodejs.org"
    exit 1
fi

if ! command -v npm &>/dev/null; then
    err "npm not found"
    exit 1
fi

log "Prerequisites OK (cargo + node + npm)"

# 2. Build Rust backend
BINARY="$SERVER_DIR/target/release/claude-jobs"

if [ "$FORCE_BUILD" = true ] || [ ! -f "$BINARY" ]; then
    info "Building Rust backend (release)..."
    (cd "$SERVER_DIR" && cargo build --release 2>&1) || {
        err "Rust build failed"
        exit 1
    }
    log "Backend built: $BINARY"
else
    log "Backend binary found (use --build to rebuild)"
fi

# 3. Install frontend deps
if [ ! -d "$APP_DIR/node_modules" ]; then
    info "Installing frontend dependencies..."
    (cd "$APP_DIR" && npm install 2>&1) || {
        err "npm install failed"
        exit 1
    }
    log "Frontend deps installed"
else
    log "Frontend deps OK"
fi

# 4. Start Rust backend
info "Starting backend on port $BACKEND_PORT..."
export CLAUDE_JOBS_LOCAL=1
"$BINARY" "$BACKEND_PORT" &
BACKEND_PID=$!
sleep 1

if kill -0 "$BACKEND_PID" 2>/dev/null; then
    log "Backend running (PID $BACKEND_PID) → http://localhost:$BACKEND_PORT"
else
    err "Backend failed to start"
    exit 1
fi

# 5. Start Next.js frontend
if [ "$PROD_MODE" = true ]; then
    info "Building frontend for production..."
    (cd "$APP_DIR" && npm run build 2>&1) || {
        err "Frontend build failed"
        exit 1
    }
    info "Starting frontend in production mode on port $FRONTEND_PORT..."
    (cd "$APP_DIR" && npx next start -p "$FRONTEND_PORT") &
    FRONTEND_PID=$!
else
    info "Starting frontend in dev mode on port $FRONTEND_PORT..."
    (cd "$APP_DIR" && npx next dev -p "$FRONTEND_PORT") &
    FRONTEND_PID=$!
fi

sleep 2

if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log "Frontend running (PID $FRONTEND_PID) → http://localhost:$FRONTEND_PORT"
else
    err "Frontend failed to start"
    exit 1
fi

# 6. Ready
echo ""
echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "  ${GREEN}${BOLD}  CLAUDE JOBS IS RUNNING${NC}"
echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo ""
echo -e "  ${AMBER}Frontend${NC}  → ${BOLD}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  ${BLUE}Backend${NC}   → ${BOLD}http://localhost:$BACKEND_PORT${NC}"
echo -e "  ${DIM}Health${NC}    → http://localhost:$BACKEND_PORT/health"
echo ""
echo -e "  ${DIM}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait forever (cleanup runs on SIGINT/SIGTERM)
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
    sleep 2
done
