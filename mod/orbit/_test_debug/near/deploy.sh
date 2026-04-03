#!/usr/bin/env bash
set -euo pipefail

# ── NEAR Testnet Deploy Script ────────────────────────────────────────────────
# Builds the WASM contract, creates a testnet account, funds it, and deploys.
#
# Usage:
#   ./deploy.sh                     # auto-generates account name
#   ./deploy.sh mycontract          # uses mycontract.testnet
#   NEAR_ACCOUNT=x ./deploy.sh     # uses env var
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Config ────────────────────────────────────────────────────────────────────

NETWORK="testnet"
NEAR_CLI="npx near-cli-rs"
WASM_PATH="target/near/near_token.wasm"

# Account name: arg > env > random
if [[ -n "${1:-}" ]]; then
    ACCOUNT="${1}.testnet"
elif [[ -n "${NEAR_ACCOUNT:-}" ]]; then
    ACCOUNT="${NEAR_ACCOUNT}"
else
    ACCOUNT="mod-token-$(date +%s).testnet"
fi

echo "═══════════════════════════════════════════════════"
echo "  NEAR Testnet Deploy"
echo "  Account: $ACCOUNT"
echo "═══════════════════════════════════════════════════"

# ── Step 1: Add wasm target if missing ────────────────────────────────────────

echo ""
echo "▸ Checking wasm32 target..."
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "  Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# ── Step 2: Build the contract ────────────────────────────────────────────────

echo ""
echo "▸ Building contract..."
cargo near build non-reproducible-wasm

if [[ ! -f "$WASM_PATH" ]]; then
    echo "ERROR: WASM not found at $WASM_PATH"
    exit 1
fi

WASM_SIZE=$(wc -c < "$WASM_PATH" | tr -d ' ')
echo "  Built: $WASM_PATH ($WASM_SIZE bytes)"

# ── Step 3: Create testnet account (funded by faucet) ─────────────────────────

echo ""
echo "▸ Creating testnet account: $ACCOUNT"
echo "  This uses the NEAR testnet faucet to fund the account with 200 NEAR."

# near-cli-rs can create funded testnet accounts via the helper/faucet
$NEAR_CLI account create-account fund-myself "$ACCOUNT" '200 NEAR' autogenerate-new-keypair save-to-keychain network-config "$NETWORK" create 2>&1 || {
    echo ""
    echo "  Account may already exist or faucet is rate-limited."
    echo "  If it exists, continuing with deploy..."
}

# ── Step 4: Deploy the contract ───────────────────────────────────────────────

echo ""
echo "▸ Deploying contract to $ACCOUNT..."
$NEAR_CLI contract deploy "$ACCOUNT" use-file "$WASM_PATH" without-init-call network-config "$NETWORK" sign-with-keychain send

# ── Step 5: Initialize the contract ───────────────────────────────────────────

echo ""
echo "▸ Initializing contract (calling 'new')..."
$NEAR_CLI contract call-function as-transaction "$ACCOUNT" new json-args '{}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-with-keychain network-config "$NETWORK" send

# ── Step 6: Verify deployment ─────────────────────────────────────────────────

echo ""
echo "▸ Verifying deployment..."
$NEAR_CLI contract call-function as-read-only "$ACCOUNT" balance_of json-args '{"addr_type":"Near","address":"test.testnet","token_type":"MOD"}' network-config "$NETWORK" now

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Deployed successfully!"
echo "  Contract: $ACCOUNT"
echo "  Explorer: https://testnet.nearblocks.io/address/$ACCOUNT"
echo "═══════════════════════════════════════════════════"

# Save deployment info
cat > "$SCRIPT_DIR/deployment.json" <<EOF
{
    "network": "$NETWORK",
    "account": "$ACCOUNT",
    "wasm": "$WASM_PATH",
    "wasm_size": $WASM_SIZE,
    "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "  Deployment info saved to deployment.json"
