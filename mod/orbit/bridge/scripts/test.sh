#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

# Ensure node_modules exist - symlink from chain root if available
CHAIN_DIR="$DIR/../../core/chain"
if [ ! -d "$DIR/node_modules" ] && [ -d "$CHAIN_DIR/node_modules" ]; then
  echo "Symlinking node_modules from chain..."
  ln -s "$CHAIN_DIR/node_modules" "$DIR/node_modules"
fi

# Install if still no node_modules
if [ ! -d "$DIR/node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Compiling contracts..."
npx hardhat compile

echo ""
echo "Running tests..."
npx hardhat test "$@"
