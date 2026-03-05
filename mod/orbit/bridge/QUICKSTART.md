# Quick Start Guide

Get your sr25519 to ERC20 bridge running in 5 minutes.

## Prerequisites

- Node.js 18+
- Python 3.11+
- MetaMask wallet
- Subwallet or Polkadot.js extension
- Base on Base (testnet or mainnet)

## Step 1: Install Dependencies

```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

## Step 2: Configure Environment (Optional)

**For local testing**: No configuration needed! Just compile and test:
```bash
npx hardhat compile
npx hardhat test
```

**For testnet/mainnet deployment**: Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` (only fill in what you need):
```bash
# Required ONLY for testnet/mainnet deployment
PRIVATE_KEY=your_private_key_here

# Optional: Custom RPC endpoints (defaults to public endpoints)
BASE_SEPOLIA_RPC=https://sepolia.base.org

# Optional: For contract verification on BaseScan (not required to run bridge)
BASESCAN_API_KEY=

# Token config
TOKEN_NAME=Bridged Commune
TOKEN_SYMBOL=BCOM
INITIAL_SUPPLY=1000000000000000000
```

## Step 3: Deploy Contracts

**Local Testing** (No API keys required):
```bash
# Start local Hardhat node
npx hardhat node

# Deploy to local network (in another terminal)
npx hardhat run scripts/deploy.js --network localhost
```

**Testnet Deployment** (Requires PRIVATE_KEY only):
```bash
# Deploy to Base Sepolia testnet
npm run deploy:testnet

# Or deploy to Base mainnet
npm run deploy:mainnet
```

**Optional - Verify on BaseScan** (Requires BASESCAN_API_KEY):
```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS>
```

This creates:
- `deployment.json` - Contract addresses and info
- `bridge_config.json` - Backend configuration

## Step 4: Generate Balance Snapshot

If you have a Substrate chain to bridge from:

```bash
cd bridge
cargo run -- snap --show-report
cd ..
```

This creates `bridge/total_balances.json` with account balances.

Or create a test snapshot:
```json
{
  "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY": "1000000000000",
  "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty": "2000000000000"
}
```

## Step 5: Configure Backend

Edit `bridge_config.json`:
```json
{
  "rpc_url": "https://sepolia.base.org",
  "bridge_contract": "0x...",  // From deployment.json
  "token_contract": "0x...",    // From deployment.json
  "operator_key": "your_private_key",
  "snapshot_path": "bridge/total_balances.json",
  "signature_timeout": 300
}
```

## Step 6: Start Backend

```bash
python mod.py
```

Backend runs on `http://localhost:8000`

Test it:
```bash
curl http://localhost:8000/stats
```

## Step 7: Test a Claim

### Option A: Using the Frontend Component

Add to your Next.js app:

```tsx
import Sr25519Bridge from './Sr25519Bridge';

export default function BridgePage() {
  return <Sr25519Bridge />;
}
```

Set environment:
```bash
NEXT_PUBLIC_BRIDGE_API=http://localhost:8000
```

### Option B: Manual API Test

```bash
# Check balance
curl http://localhost:8000/balance/5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Submit claim (need real sr25519 signature)
curl -X POST http://localhost:8000/claim \
  -H "Content-Type: application/json" \
  -d '{
    "sr25519_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "evm_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "timestamp": 1709481600,
    "signature": "0x...",
    "amount": 0
  }'

# Process pending claims (operator)
curl -X POST http://localhost:8000/process
```

## Step 8: Monitor

```bash
# Check stats
curl http://localhost:8000/stats

# Check on-chain data
npx hardhat console --network baseSepolia
> const bridge = await ethers.getContractAt("Sr25519Bridge", "0x...")
> await bridge.totalClaimed()
```

## Production Deployment

### 1. Secure the Operator Key

Use a hardware wallet or multisig:

```bash
# Deploy contracts with Safe as operator
# Then transfer ownership to Safe
npx hardhat run scripts/transferOwnership.js --network base
```

### 2. Protect the API

Add authentication to `/process` endpoint:

```python
from fastapi import Header, HTTPException

@app.post("/process")
async def process_pending(
    authorization: str = Header(None),
    batch_size: int = 50
):
    if authorization != f"Bearer {os.getenv('OPERATOR_TOKEN')}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    # ... process claims
```

### 3. Deploy Backend

```bash
# Using PM2
pm2 start mod.py --interpreter python3 --name bridge-api

# Or Docker
docker build -t bridge-api .
docker run -d -p 8000:8000 --env-file .env bridge-api
```

### 4. Automate Claim Processing

```bash
# Crontab - process every 5 minutes
*/5 * * * * curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8000/process
```

### 5. Set Up Monitoring

```bash
# Monitor logs
pm2 logs bridge-api

# Monitor contract events
npx hardhat run scripts/monitor.js --network base
```

## Troubleshooting

### "Module not found"

```bash
npm install
pip install -r requirements.txt
```

### "Invalid signature"

- Check Subwallet is connected
- Verify message format: `bridge_claim:{timestamp}`
- Ensure timestamp is current

### "Insufficient funds"

Operator needs:
- ETH for gas
- Approved tokens for distribution

```bash
# Check balances
npx hardhat console --network baseSepolia
> const token = await ethers.getContractAt("BridgeToken", "0x...")
> const operator = "0x..."
> await token.balanceOf(operator)
> await token.allowance(operator, bridgeAddress)
```

### "Transaction failed"

- Increase gas limit
- Check operator has approved bridge
- Verify RPC endpoint is working

## Next Steps

- Read full [BRIDGE.md](./BRIDGE.md) documentation
- Set up automated processing
- Configure monitoring and alerts
- Deploy frontend to production
- Verify contracts on BaseScan

## Support

- GitHub Issues: Report bugs
- Discord: Community support
- Docs: Full documentation in BRIDGE.md
