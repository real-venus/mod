# No API Keys Required! 🎉

## TL;DR

You can develop, test, and run the entire bridge locally **without any API keys, testnet access, or external services**.

## What You DON'T Need

- ❌ No BaseScan API key
- ❌ No private keys (for local dev)
- ❌ No testnet ETH
- ❌ No RPC provider accounts (Infura, Alchemy, etc.)
- ❌ No external blockchain access

## What You DO Need

- ✅ Node.js 18+
- ✅ Python 3.11+
- ✅ 2 minutes of your time

## Local Development Flow

```bash
# 1. Install (20 seconds)
npm install && pip install -r requirements.txt

# 2. Test (10 seconds)
npx hardhat test

# 3. Start local blockchain (Terminal 1)
npx hardhat node

# 4. Deploy locally (Terminal 2 - 5 seconds)
npm run deploy:local

# 5. Start backend (30 seconds)
python mod.py

# Done! Your bridge is running locally at http://localhost:8000
```

## When DO You Need API Keys?

### 1. PRIVATE_KEY (Optional)

**Only needed for:**
- Deploying to Base Sepolia testnet
- Deploying to Base mainnet

**NOT needed for:**
- Local Hardhat development ✅
- Running tests ✅
- Local API testing ✅

### 2. BASESCAN_API_KEY (Optional)

**Only needed for:**
- Verifying contracts on BaseScan explorer
- Making your contract source code public

**NOT needed for:**
- Deploying contracts ✅
- Running the bridge ✅
- Any bridge functionality ✅

This is purely cosmetic - for showing verified source code on the block explorer.

## Using Public Endpoints

The bridge uses **free public RPC endpoints** by default:

- Base Sepolia: `https://sepolia.base.org` (free, no account needed)
- Base Mainnet: `https://mainnet.base.org` (free, no account needed)

You don't need Infura, Alchemy, or any other RPC provider.

## Complete Development Without API Keys

You can build and test the entire bridge stack locally:

### 1. Smart Contracts ✅
```bash
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network localhost
```

### 2. Python Backend ✅
```bash
python mod.py
curl http://localhost:8000/stats
```

### 3. Frontend Component ✅
```tsx
import Sr25519Bridge from './frontend/Sr25519Bridge';
// Set: NEXT_PUBLIC_BRIDGE_API=http://localhost:8000
```

### 4. Full Integration Testing ✅

All on your local machine, no external services.

## Migration to Testnet

When you're ready to deploy to testnet:

1. Get free testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. Add your `PRIVATE_KEY` to `.env`
3. Run `npm run deploy:testnet`

That's it! Still no BaseScan API key needed.

## Migration to Mainnet

When you're ready for production:

1. Add your production `PRIVATE_KEY` to `.env`
2. Ensure you have ETH for gas on Base mainnet
3. Run `npm run deploy:mainnet`

Still no BaseScan API key needed unless you want verified contracts.

## The Bottom Line

This bridge is designed for **zero-friction development**:

- Clone the repo
- Install dependencies
- Start coding

No accounts to create, no keys to manage, no services to configure.

**See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for the complete local development guide.**

---

*Development should be easy. This bridge is.* 🚀
