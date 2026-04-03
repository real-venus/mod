#!/usr/bin/env bash
#
# ╔════════════════════════════════════════════╗
# ║  REGISTRY — 8BIT STARTUP SCRIPT           ║
# ║  Multi-chain module registry (Base/NEAR/  ║
# ║  Solana/Offchain) with IPFS integration   ║
# ╚════════════════════════════════════════════╝
#
# Usage: ./scripts/start.sh [--test] [--demo] [--install]
#   --test     Run test suite
#   --demo     Run interactive demo
#   --install  Force reinstall dependencies
#   --clean    Clean up cache and artifacts

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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
    echo "  ║   REGISTRY // 8BIT TERMINAL          ║"
    echo "  ║   Multi-chain Module Registry        ║"
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

# ── Parse args ────────────────────────────────────────────────────────
RUN_TESTS=false
RUN_DEMO=false
FORCE_INSTALL=false
CLEAN=false

for arg in "$@"; do
    case "$arg" in
        --test)    RUN_TESTS=true ;;
        --demo)    RUN_DEMO=true ;;
        --install) FORCE_INSTALL=true ;;
        --clean)   CLEAN=true ;;
        --help|-h)
            echo "Usage: $0 [--test] [--demo] [--install] [--clean]"
            echo "  --test     Run test suite with pytest"
            echo "  --demo     Run interactive demo"
            echo "  --install  Force reinstall dependencies"
            echo "  --clean    Clean up __pycache__ and artifacts"
            exit 0
            ;;
    esac
done

# ── Main ──────────────────────────────────────────────────────────────

print_banner

# 0. Clean if requested
if [ "$CLEAN" = true ]; then
    info "Cleaning up cache and artifacts..."
    find "$ROOT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$ROOT_DIR" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
    find "$ROOT_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    log "Cleanup complete"
fi

# 1. Check prerequisites
info "Checking prerequisites..."

if ! command -v python3 &>/dev/null; then
    err "python3 not found — install Python 3.8+: https://python.org"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]); then
    err "Python 3.8+ required (found $PYTHON_VERSION)"
    exit 1
fi

log "Python $PYTHON_VERSION OK"

# 2. Setup PYTHONPATH
# Add registry module to Python path so imports work correctly
export PYTHONPATH="$ROOT_DIR${PYTHONPATH:+:$PYTHONPATH}"
log "PYTHONPATH configured"

# 3. Install dependencies
if [ "$FORCE_INSTALL" = true ] || [ ! -f "$ROOT_DIR/requirements.txt" ] || ! python3 -c "import web3" 2>/dev/null; then
    info "Installing dependencies from requirements.txt..."
    pip install -q --upgrade pip 2>&1 >/dev/null || warn "Could not upgrade pip"
    pip install -q -r "$ROOT_DIR/requirements.txt" 2>&1 || {
        err "Failed to install dependencies"
        exit 1
    }
    log "Dependencies installed"
else
    log "Dependencies OK"
fi

# 4. Verify mod framework is available
if ! python3 -c "import sys; sys.path.insert(0, '$(dirname $(dirname $(dirname $ROOT_DIR)))/core'); import mod" 2>/dev/null; then
    warn "mod framework not found in core — some features may not work"
    warn "Expected location: $(dirname $(dirname $(dirname $ROOT_DIR)))/core/mod.py"
else
    log "mod framework detected"
fi

# 5. Run tests if requested
if [ "$RUN_TESTS" = true ]; then
    echo ""
    info "Running test suite..."

    if ! command -v pytest &>/dev/null; then
        err "pytest not found — installing..."
        pip install -q pytest 2>&1 || {
            err "Failed to install pytest"
            exit 1
        }
    fi

    echo -e "  ${DIM}════════════════════════════════════════${NC}"
    # Run from root directory (PYTHONPATH already set above)
    cd "$ROOT_DIR"
    python3 -m pytest tests/ -q --tb=line || {
        err "Tests failed"
        exit 1
    }
    echo -e "  ${DIM}════════════════════════════════════════${NC}"
    echo ""
    log "All tests passed ✓"
fi

# 6. Run demo if requested
if [ "$RUN_DEMO" = true ]; then
    echo ""
    info "Running interactive demo..."
    echo ""

    python3 <<'EOF'
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from registry.mod import Mod

print("  ╔════════════════════════════════════════╗")
print("  ║  REGISTRY INTERACTIVE DEMO             ║")
print("  ╚════════════════════════════════════════╝\n")

# Initialize registry with offchain backend
print("  [·] Initializing registry (offchain backend)...")
reg = Mod(backend='offchain', storage='ipfs')
print("  [✓] Registry initialized\n")

# Show available backends
print("  [·] Available backends:", reg.backends())
print("  [·] Storage providers:", reg.storage_providers())
print()

# Register a test module
print("  [·] Registering test module 'hello-world'...")
try:
    mod_id = reg.register(
        'hello-world',
        {'version': '1.0.0', 'description': 'A test module'},
        owner='demo_user'
    )
    print(f"  [✓] Module registered with ID: {mod_id}\n")
except Exception as e:
    print(f"  [!] Registration failed: {e}")
    print("  [!] Note: This is expected if storage modules (ipfs/lighthouse) are not configured\n")

# List all modules
print("  [·] Listing all registered modules...")
try:
    mods = reg.list_all()
    print(f"  [✓] Found {len(mods)} module(s)\n")
    for mod in mods:
        print(f"      • {mod.get('name')} (ID: {mod.get('id')}, Owner: {mod.get('owner')})")
except Exception as e:
    print(f"  [!] Listing failed: {e}\n")

print("\n  ╔════════════════════════════════════════╗")
print("  ║  Demo complete! Try using the registry ║")
print("  ║  via mod framework:                    ║")
print("  ║  >>> import mod as m                   ║")
print("  ║  >>> reg = m.mod('registry')()         ║")
print("  ║  >>> reg.register('mymod', {...})      ║")
print("  ╚════════════════════════════════════════╝\n")
EOF
fi

# 7. Show usage info
if [ "$RUN_TESTS" = false ] && [ "$RUN_DEMO" = false ]; then
    echo ""
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD}  REGISTRY IS READY${NC}"
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BLUE}Usage via mod framework:${NC}"
    echo -e "  ${DIM}  import mod as m"
    echo -e "  ${DIM}  reg = m.mod('registry')()"
    echo -e "  ${DIM}  reg.register('mymod', {'version': '1.0'})"
    echo ""
    echo -e "  ${BLUE}Available backends:${NC}"
    echo -e "  ${DIM}  • offchain (local file storage)"
    echo -e "  ${DIM}  • evm      (Base/Ethereum)"
    echo -e "  ${DIM}  • solana   (Solana blockchain)"
    echo -e "  ${DIM}  • near     (NEAR blockchain)"
    echo ""
    echo -e "  ${BLUE}Storage providers:${NC}"
    echo -e "  ${DIM}  • ipfs       (IPFS via mod/orbit/ipfs)"
    echo -e "  ${DIM}  • lighthouse (Lighthouse via mod/orbit/lighthouse)"
    echo -e "  ${DIM}  • filecoin   (Filecoin via mod/orbit/filecoin)"
    echo ""
    echo -e "  ${BLUE}Quick commands:${NC}"
    echo -e "  ${DIM}  ./scripts/start.sh --test    # Run test suite"
    echo -e "  ${DIM}  ./scripts/start.sh --demo    # Interactive demo"
    echo -e "  ${DIM}  ./scripts/start.sh --clean   # Clean up artifacts"
    echo ""
    echo -e "  ${AMBER}Documentation:${NC}"
    echo -e "  ${DIM}  README.md          # Module overview"
    echo -e "  ${DIM}  tests/test_mod.py  # Usage examples"
    echo ""
fi

exit 0
