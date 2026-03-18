#!/usr/bin/env bash
set -euo pipefail

# ── NEAR Testnet Faucet / Funding Script ──────────────────────────────────────
# Fund an existing testnet account or create a new funded one.
#
# Usage:
#   ./fund.sh <account>        # fund existing account (via helper contract)
#   ./fund.sh                  # create + fund a new random account
# ──────────────────────────────────────────────────────────────────────────────

NEAR_CLI="npx near-cli-rs"
NETWORK="testnet"

if [[ -n "${1:-}" ]]; then
    ACCOUNT="$1"
    # Append .testnet if not already
    [[ "$ACCOUNT" == *.testnet ]] || ACCOUNT="${ACCOUNT}.testnet"
else
    ACCOUNT="mod-wallet-$(date +%s).testnet"
    echo "No account specified, creating new: $ACCOUNT"
fi

echo "═══════════════════════════════════════════════════"
echo "  NEAR Testnet Funding"
echo "  Account: $ACCOUNT"
echo "═══════════════════════════════════════════════════"

# ── Check if account exists ───────────────────────────────────────────────────

echo ""
echo "▸ Checking account state..."
if $NEAR_CLI account view-account-summary "$ACCOUNT" network-config "$NETWORK" now 2>/dev/null; then
    echo "  Account exists. Current balance shown above."
    echo ""
    echo "  To add more funds, use the NEAR faucet:"
    echo "  https://near-faucet.io/"
    echo ""
    echo "  Or transfer from another funded account:"
    echo "  $NEAR_CLI tokens <sender>.testnet send-near $ACCOUNT '10 NEAR' network-config testnet sign-with-keychain send"
else
    echo "  Account does not exist yet. Creating with faucet funding..."
    echo ""
    $NEAR_CLI account create-account fund-myself "$ACCOUNT" '200 NEAR' autogenerate-new-keypair save-to-keychain network-config "$NETWORK" create
    echo ""
    echo "  Account created and funded with 200 NEAR!"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Account: $ACCOUNT"
echo "  Explorer: https://testnet.nearblocks.io/address/$ACCOUNT"
echo "  Faucet:   https://near-faucet.io/"
echo "═══════════════════════════════════════════════════"
