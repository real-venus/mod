#!/usr/bin/env bash
#
# ClaudeGit Installation Script
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
AMBER='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warn() {
    echo -e "${AMBER}[!]${NC} $1"
}

err() {
    echo -e "${RED}[✕]${NC} $1"
}

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   CLAUDEGIT INSTALLATION             ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    err "Python 3 not found. Install Python 3.11+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
log "Python $PYTHON_VERSION found"

# Check pip
if ! command -v pip &>/dev/null && ! command -v pip3 &>/dev/null; then
    err "pip not found. Install pip"
    exit 1
fi

log "pip found"

# Install Python dependencies
log "Installing Python dependencies..."
cd "$ROOT_DIR"
pip install -r requirements.txt

log "✓ ClaudeGit installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Get GitHub token: https://github.com/settings/tokens"
echo "  2. Set environment variables:"
echo "     export GITHUB_TOKEN=ghp_your_token"
echo "     export GITHUB_REPO=username/repo"
echo "  3. Run: python -c 'from claudegit import Mod; c = Mod(); print(c)'"
echo ""
echo "See QUICKSTART.md for more details"
echo ""
