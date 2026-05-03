#!/bin/bash
set -e

MOD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MOD_DIR"

echo "=== mod setup ==="
echo "[..] root: $MOD_DIR"

# ---- System packages ----
if [ "$(id -u)" = "0" ] && command -v apt-get &> /dev/null; then
    NEED_PKGS=()
    for pkg in git curl build-essential python3 python3-pip python3-venv; do
        dpkg -s "$pkg" &> /dev/null || NEED_PKGS+=("$pkg")
    done
    if [ ${#NEED_PKGS[@]} -gt 0 ]; then
        echo "[+] apt install: ${NEED_PKGS[*]}"
        apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${NEED_PKGS[@]}"
    fi
fi

# ---- Rust ----
export PATH="$HOME/.cargo/bin:$PATH"
if ! command -v rustc &> /dev/null; then
    echo "[+] installing rust"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --quiet
    source "$HOME/.cargo/env" 2>/dev/null || true
fi
echo "[ok] $(rustc --version)"

# ---- Node + PM2 ----
if ! command -v node &> /dev/null; then
    echo "[+] installing nodejs + npm"
    if [ "$(id -u)" = "0" ] && command -v apt-get &> /dev/null; then
        apt-get install -y --no-install-recommends nodejs npm
    else
        echo "[!] node not found and not running as root — install node manually"
        exit 1
    fi
fi
echo "[ok] node $(node --version)"

if ! command -v pm2 &> /dev/null; then
    echo "[+] installing pm2"
    npm install -g pm2
fi
echo "[ok] pm2 $(pm2 --version)"

# ---- Python ----
PIP_FLAGS=()
if python3 -c "import sys; sys.exit(0 if sys.prefix == sys.base_prefix else 1)" 2>/dev/null; then
    # Not in a venv — handle PEP 668 (externally-managed-environment) on Debian/Ubuntu
    if python3 -m pip install --help 2>/dev/null | grep -q break-system-packages; then
        PIP_FLAGS+=(--break-system-packages)
    fi
fi

echo "[+] ensuring pip/setuptools/wheel"
# --ignore-installed avoids "RECORD file not found" when distro packages are present
python3 -m pip install "${PIP_FLAGS[@]}" --upgrade --ignore-installed pip setuptools wheel -q || \
    python3 -m pip install "${PIP_FLAGS[@]}" pip setuptools wheel -q

echo "[+] installing mod (editable)"
python3 -m pip install "${PIP_FLAGS[@]}" --ignore-installed -e "$MOD_DIR" -q

# ---- Node deps for this repo ----
if [ -f "$MOD_DIR/package.json" ]; then
    echo "[+] npm install"
    (cd "$MOD_DIR" && npm install --silent)
fi

# ---- Verify ----
echo "[..] verifying import"
python3 -c "import mod; print('[ok] mod', getattr(mod, '__version__', ''))"

echo "=== done ==="
echo "run 'm' or 'c' to start, or 'bash scripts/start.sh' to launch services"
