#!/bin/bash
set -e

MOD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MOD_DIR"

echo "=== mod tests ==="

PIP_FLAGS=()
if python3 -c "import sys; sys.exit(0 if sys.prefix == sys.base_prefix else 1)" 2>/dev/null; then
    if python3 -m pip install --help 2>/dev/null | grep -q break-system-packages; then
        PIP_FLAGS+=(--break-system-packages)
    fi
fi

if ! python3 -c "import pytest" 2>/dev/null; then
    echo "[+] installing pytest"
    python3 -m pip install "${PIP_FLAGS[@]}" -q "pytest>=7.2.0"
fi

exec python3 -m pytest "$MOD_DIR/tests" "$@"
