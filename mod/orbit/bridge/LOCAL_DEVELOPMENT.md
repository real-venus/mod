# Local Development Guide

> Get started without any API keys or testnet setup!

## Quick Start (No API Keys Required)

### 1. Install Dependencies

```bash
npm install
pip install -r requirements.txt
```

### 2. Compile Contracts

```bash
npx hardhat compile
```

### 3. Run Tests

```bash
npx hardhat test
```

### 4. Start Local Blockchain

```bash
# Terminal 1: Start Hardhat network
npx hardhat node
```

This starts a local Ethereum node with:
- 20 pre-funded test accounts
- No gas costs
- Instant mining
- Chain ID: 31337

### 5. Deploy to Local Network

```bash
# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.js --network localhost
```

This creates:
- `deployment.json` - Contract addresses
- `bridge_config.json` - Backend configuration template

### 6. Create Test Snapshot

Create a test balance snapshot for local testing:

```bash
cat > bridge/total_balances.json <<EOF
{
  "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY": "1000000000000",
  "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty": "2000000000000",
  "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y": "500000000000"
}
EOF
```

### 7. Configure Backend

Update `bridge_config.json` with the operator key from Hardhat:

```json
{
  "rpc_url": "http://127.0.0.1:8545",
  "bridge_contract": "0x...",
  "token_contract": "0x...",
  "operator_key": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "snapshot_path": "bridge/total_balances.json",
  "signature_timeout": 300
}
```

> 📝 The key above is Hardhat's first test account - **ONLY USE FOR LOCAL TESTING**

### 8. Start Backend

```bash
python mod.py
```

The API runs on `http://localhost:8000`

### 9. Test the API

```bash
# Check stats
curl http://localhost:8000/stats

# Check balance
curl http://localhost:8000/balance/5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

### 10. Test Frontend (Optional)

If you want to test the frontend component:

1. Add to your Next.js app:
```tsx
import Sr25519Bridge from './Sr25519Bridge';

export default function BridgePage() {
  return <Sr25519Bridge />;
}
```

2. Set environment variable:
```bash
NEXT_PUBLIC_BRIDGE_API=http://localhost:8000
```

3. Connect MetaMask to local Hardhat network:
   - Network Name: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency Symbol: ETH

## Development Workflow

### Making Contract Changes

1. Edit contracts in `contracts/`
2. Compile: `npx hardhat compile`
3. Test: `npx hardhat test`
4. Redeploy to local network: `npx hardhat run scripts/deploy.js --network localhost`
5. Update `bridge_config.json` with new addresses

### Testing Signature Verification

Use the Python test script:

```bash
python examples/test_signature.py
```

This tests sr25519 signature verification without needing a real wallet.

### Debugging Tips

**Check contract state:**
```bash
npx hardhat console --network localhost

# In console:
const bridge = await ethers.getContractAt("Sr25519Bridge", "0x...")
await bridge.totalClaimed()
await bridge.token()
```

**Reset local blockchain:**
```bash
# Stop hardhat node (Ctrl+C)
# Start fresh
npx hardhat node
# Redeploy
npx hardhat run scripts/deploy.js --network localhost
```

**Check Python backend logs:**
```bash
# Backend prints verification details
python mod.py
# Watch for "✓ Valid signature" or "✗ Invalid signature"
```

## No External Dependencies

This local setup requires **zero external services**:

- ✅ No RPC providers (runs locally)
- ✅ No API keys
- ✅ No testnet ETH
- ✅ No BaseScan verification
- ✅ No wallet funding

Everything runs on your machine!

## Next Steps

Once you've tested locally:

1. Deploy to testnet: See [QUICKSTART.md](./QUICKSTART.md)
2. Get testnet ETH from Base Sepolia faucet
3. Add your `PRIVATE_KEY` to `.env`
4. Deploy: `npm run deploy:testnet`

## Troubleshooting

### "Cannot connect to localhost:8545"

Make sure Hardhat node is running:
```bash
npx hardhat node
```

### "Module not found"

Reinstall dependencies:
```bash
npm install
pip install -r requirements.txt
```

### "Invalid signature"

For local testing, you can skip signature verification and test the full flow directly on-chain:

```bash
npx hardhat console --network localhost
const bridge = await ethers.getContractAt("Sr25519Bridge", "0x...")
const token = await ethers.getContractAt("BridgeToken", await bridge.token())

# Manually process a claim
const sr25519Hash = ethers.keccak256(ethers.toUtf8Bytes("5GrwvaEF..."))
const evmAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
const amount = 1000000000000n

await bridge.processClaim(sr25519Hash, evmAddress, amount)
```

## Performance

Local Hardhat network is **instant**:
- No block times
- No gas costs
- Instant confirmations
- Perfect for rapid development

---

**Ready to develop?** Start with step 1 and you'll be running in under 2 minutes! 🚀
