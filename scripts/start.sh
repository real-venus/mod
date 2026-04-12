#!/bin/bash
set -e

VENV_DIR="$HOME/.mod_venv"
MOD_DIR="${MOD_DIR:-$HOME/mod}"

echo "=== mod start.sh - the truth teller ==="

# ---- Rust ----
if ! command -v rustc &> /dev/null; then
    echo "[+] Installing Rust via rustup..."
    apt-get update && apt-get install -y --no-install-recommends curl build-essential
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    rm -rf /var/lib/apt/lists/*
fi
export PATH="$HOME/.cargo/bin:$PATH"
echo "[ok] rust $(rustc --version)"

# ---- Node + PM2 ----
if ! command -v node &> /dev/null; then
    echo "[+] Installing Node.js + npm..."
    apt-get update && apt-get install -y --no-install-recommends nodejs npm
    rm -rf /var/lib/apt/lists/*
fi
if ! command -v pm2 &> /dev/null; then
    echo "[+] Installing PM2..."
    npm install -g pm2
fi
echo "[ok] node $(node --version)"
echo "[ok] pm2 $(pm2 --version)"

# ---- Python venv ----
if [ ! -d "$VENV_DIR" ]; then
    echo "[+] Creating virtual environment at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
echo "[ok] venv active: $(which python3)"

# ---- Pip + mod ----
pip install --upgrade pip setuptools wheel -q

if [ -f "$MOD_DIR/setup.py" ]; then
    echo "[+] Installing mod in editable mode..."
    pip install -e "$MOD_DIR"
fi

# ---- Commune ----
if ! python3 -c "import commune" 2>/dev/null; then
    echo "[+] Installing commune..."
    pip install commune
fi
echo "[ok] commune installed"

echo "=== environment ready ==="

# ---- Stop existing processes ----
echo "[+] Stopping existing pm2 processes..."
pm2 kill 2>/dev/null || true

# ---- Start API + App via mod CLI (PM2) ----
echo "[+] Starting api + app via pm2..."
python3 -c "import mod; mod.start()"
echo "[ok] pm2 services started"
pm2 status

# Run whatever command was passed (or default to keeping container alive)
if [ $# -gt 0 ]; then
    exec "$@"
else
    # keep container alive while pm2 manages services
    exec pm2 logs --raw
fi
