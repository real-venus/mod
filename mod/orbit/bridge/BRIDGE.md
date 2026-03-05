# Sr25519 to ERC20 Bridge

A trustless bridge from Substrate-based chains (sr25519 keys) to Base EVM (ERC20 tokens).

## Architecture

### Overview

```
┌─────────────────┐     Sign with      ┌──────────────────┐
│   Subwallet     │    sr25519 key     │  Python Backend  │
│   (sr25519)     │ ───────────────>   │   (FastAPI)      │
└─────────────────┘                     └──────────────────┘
                                               │
                                               │ Verify signature
                                               │ Queue claim
                                               ▼
┌─────────────────┐     Receive        ┌──────────────────┐
│   MetaMask      │ <─────────────────  │ Bridge Operator  │
│   (Base EVM)    │     ERC20 tokens   │   (Smart Cont.)  │
└─────────────────┘                     └──────────────────┘
```

### Components

1. **Smart Contracts** (Solidity)
   - `BridgeToken.sol`: ERC20 token contract
   - `Sr25519Bridge.sol`: Bridge logic and claim tracking

2. **Backend API** (Python + FastAPI)
   - Verifies sr25519 signatures
   - Manages pending claims queue
   - Operator interface for batch processing

3. **Frontend** (React + Next.js)
   - Connects Subwallet for sr25519 signing
   - Connects MetaMask for receiving address
   - Submits claims to backend

4. **Snapshot Tool** (Rust)
   - Fetches Substrate chain state
   - Exports balances to JSON

## Flow

### 1. User Claims Tokens

```
User → Frontend:
  1. Connect Subwallet (Polkadot.js extension)
  2. Connect MetaMask (Base network)
  3. Click "Claim Tokens"
  4. Sign message: "bridge_claim:{timestamp}"
  5. Submit to backend
```

### 2. Backend Verification

```python
# Backend verifies:
1. Signature is valid (sr25519)
2. Timestamp is recent (< 5 minutes)
3. Address hasn't claimed yet
4. Balance exists in snapshot

# If valid → add to pending queue
```

### 3. Operator Processing

```
Operator → Backend:
  POST /process

Bridge:
  1. Batch up to 50 claims
  2. Call batchProcessClaims() on-chain
  3. Transfers tokens from operator to users
  4. Marks sr25519 addresses as claimed
```

## Deployment

### Prerequisites

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### 1. Deploy Smart Contracts

Edit `.env`:
```bash
PRIVATE_KEY=your_operator_private_key
BASESCAN_API_KEY=your_api_key
TOKEN_NAME=Bridged Commune
TOKEN_SYMBOL=BCOM
INITIAL_SUPPLY=1000000000000000000  # 1B with 9 decimals
```

Deploy to Base Sepolia testnet:
```bash
npm run deploy:testnet
```

Deploy to Base mainnet:
```bash
npm run deploy:mainnet
```

This will:
- Deploy BridgeToken with initial supply to operator
- Deploy Sr25519Bridge contract
- Approve bridge to spend operator's tokens
- Generate `deployment.json` and `bridge_config.json`

### 2. Generate Balance Snapshot

Use the Rust tool to snapshot Substrate chain:

```bash
cd bridge
cargo run -- snap --show-report
```

This creates `total_balances.json` with all account balances.

### 3. Configure Backend

Edit `bridge_config.json`:
```json
{
  "rpc_url": "https://mainnet.base.org",
  "bridge_contract": "0x...",
  "token_contract": "0x...",
  "operator_key": "YOUR_PRIVATE_KEY",
  "snapshot_path": "bridge/total_balances.json",
  "signature_timeout": 300
}
```

### 4. Start Backend API

```bash
python mod.py
```

API runs on `http://localhost:8000`

Endpoints:
- `POST /claim` - Submit claim
- `GET /balance/{address}` - Check balance
- `POST /process` - Process pending claims (operator)
- `GET /stats` - Bridge statistics

### 5. Deploy Frontend

Add to your Next.js app:

```tsx
import Sr25519Bridge from '@/components/Sr25519Bridge';

export default function BridgePage() {
  return <Sr25519Bridge />;
}
```

Set environment variable:
```bash
NEXT_PUBLIC_BRIDGE_API=http://localhost:8000
```

## Usage

### For Users

1. Install [Subwallet](https://subwallet.app/) or Polkadot.js extension
2. Install [MetaMask](https://metamask.io/)
3. Go to bridge interface
4. Connect both wallets
5. Sign message with sr25519 key
6. Wait for operator to process

### For Operators

Monitor pending claims:
```bash
curl http://localhost:8000/stats
```

Process claims:
```bash
curl -X POST http://localhost:8000/process
```

Or automate with cron:
```bash
# Process every 5 minutes
*/5 * * * * curl -X POST http://localhost:8000/process
```

## Security

### Trust Model

This is a **centralized bridge** where:
- ✅ Users prove ownership of sr25519 address via signature
- ✅ Bridge operator cannot claim on behalf of users
- ⚠️ Bridge operator controls token distribution
- ⚠️ Users trust operator to process claims fairly

### Guarantees

1. **No double-claiming**: Smart contract enforces one claim per sr25519 address
2. **Signature required**: Must prove ownership via cryptographic signature
3. **Time-bound**: Signatures expire after 5 minutes
4. **Transparent**: All claims recorded on-chain

### Recommendations

1. Use a multisig wallet as operator (e.g., Safe)
2. Publish snapshot hash on-chain for verification
3. Automate claim processing to reduce trust
4. Monitor operator balance to ensure sufficient liquidity

## API Reference

### POST /claim

Submit a claim request.

**Request:**
```json
{
  "sr25519_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "evm_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "timestamp": 1709481600,
  "signature": "0x...",
  "amount": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Claim verified. Amount: 1000000000. Pending operator processing.",
  "amount": 1000000000
}
```

### GET /balance/{sr25519_address}

Check claimable balance.

**Response:**
```json
{
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "balance": "1000000000",
  "claimed": false,
  "claimable": "1000000000"
}
```

### POST /process

Process pending claims (operator only).

**Response:**
```json
{
  "success": true,
  "tx_hash": "0x...",
  "processed": 50,
  "remaining": 0
}
```

### GET /stats

Get bridge statistics.

**Response:**
```json
{
  "pending_claims": 0,
  "total_claimed": "50000000000",
  "total_snapshot": "1000000000000000000",
  "accounts_in_snapshot": 12453
}
```

## Development

### Run Tests

```bash
npm test
```

### Local Development

1. Start local Hardhat node:
```bash
npx hardhat node
```

2. Deploy to local network:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

3. Start backend:
```bash
python mod.py
```

4. Update frontend to use local API

### Verify Contracts

After deployment:
```bash
npx hardhat verify --network baseSepolia TOKEN_ADDRESS "Token Name" "SYM" "1000000000"
npx hardhat verify --network baseSepolia BRIDGE_ADDRESS TOKEN_ADDRESS
```

## Troubleshooting

### "Invalid signature"

- Ensure message format is exactly: `bridge_claim:{timestamp}`
- Check timestamp is current (< 5 minutes old)
- Verify sr25519 address matches signing account

### "Already claimed"

- Each sr25519 address can only claim once
- Check `/balance/{address}` endpoint

### "No balance found"

- Address not in snapshot
- Verify sr25519 address is correct
- Check snapshot includes this address

### "Transaction failed"

- Operator has insufficient token balance
- Operator hasn't approved bridge contract
- Gas price too low

## Future Enhancements

1. **Decentralized verification**: Use light client proofs instead of centralized backend
2. **Automatic processing**: Smart contract auto-processes claims
3. **Bridge in reverse**: EVM to Substrate
4. **Multi-chain**: Support multiple Substrate chains
5. **Merkle proofs**: Prove balance without full snapshot

## License

MIT

## Support

For issues or questions:
- GitHub: https://github.com/your-org/bridge
- Discord: https://discord.gg/your-server
