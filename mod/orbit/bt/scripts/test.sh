#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$DIR/bt"
python3 -m pytest test_bt.py -v --tb=short "$@"
