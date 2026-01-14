# BlocTime Protocol - Deployment Guide

## Deploy on Any EVM-Compatible Chain

BlocTime Protocol is designed to be chain-agnostic and can be deployed on any EVM-compatible blockchain.

## Supported Chains

- **Ethereum Mainnet** (Chain ID: 1)
- **Polygon** (Chain ID: 137)
- **Arbitrum** (Chain ID: 42161)
- **Optimism** (Chain ID: 10)
- **Base** (Chain ID: 8453)
- **Avalanche C-Chain** (Chain ID: 43114)
- **Binance Smart Chain** (Chain ID: 56)
- **Fantom** (Chain ID: 250)
- **Gnosis Chain** (Chain ID: 100)
- **Any other EVM chain**

## Prerequisites

1. **Node.js 18+** installed
2. **Hardhat** development environment
3. **Private key** with native tokens for gas fees
4. **RPC URL** for your target chain
5. **Block explorer API key** (optional, for verification)

## Step 1: Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd bloctime

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

## Step 2: Configure Network

Edit `hardhat.config.js` and add your target network:

```javascript
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Add your network here
    your_chain: {
      url: process.env.YOUR_CHAIN_RPC_URL || 'https://your-rpc-url',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: YOUR_CHAIN_ID,
      gasPrice: 'auto', // or specify gas price
    },
    // Example: Polygon
    polygon: {
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
    },
    // Example: Arbitrum
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
    },
    // Example: Base
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
    },
  },
};
```

## Step 3: Set Environment Variables

Edit `.env` file:

```bash
# Your private key (NEVER commit this!)
PRIVATE_KEY=your_private_key_here

# RPC URLs
YOUR_CHAIN_RPC_URL=https://your-rpc-url
POLYGON_RPC_URL=https://polygon-rpc.com
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BASE_RPC_URL=https://mainnet.base.org

# Block explorer API keys (for verification)
ETHERSCAN_API_KEY=your_etherscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key
ARBISCAN_API_KEY=your_arbiscan_key
BASESCAN_API_KEY=your_basescan_key
```

## Step 4: Compile Contracts

```bash
npx hardhat compile
```

## Step 5: Run Tests (Optional but Recommended)

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
npx hardhat test --gas-reporter

# Run with coverage
npx hardhat coverage
```

## Step 6: Deploy to Your Chain

```bash
# Deploy to your configured network
npx hardhat run scripts/deploy.js --network your_chain

# Example: Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon

# Example: Deploy to Arbitrum
npx hardhat run scripts/deploy.js --network arbitrum

# Example: Deploy to Base
npx hardhat run scripts/deploy.js --network base
```

## Step 7: Verify Contracts (Optional)

If your chain has a block explorer with verification support:

```bash
# Verify Token contract
npx hardhat verify --network your_chain DEPLOYED_TOKEN_ADDRESS "Token Name" "SYMBOL" "1000000000000000000000000"

# Verify BlocTime contract
npx hardhat verify --network your_chain DEPLOYED_BLOCTIME_ADDRESS NATIVE_TOKEN_ADDRESS "BlocTime Token" "BLOC" 100000 5000

# Verify Registry
npx hardhat verify --network your_chain DEPLOYED_REGISTRY_ADDRESS

# Verify Market
npx hardhat verify --network your_chain DEPLOYED_MARKET_ADDRESS "BlocTime Market Token" "BTMT" DEPLOYER_ADDRESS

# Verify Treasury
npx hardhat verify --network your_chain DEPLOYED_TREASURY_ADDRESS 2000

# Verify Perms
npx hardhat verify --network your_chain DEPLOYED_PERMS_ADDRESS
```

## Deployment Output

After successful deployment, you'll see:

```
🚀 Deploying BlocTime Protocol...
Deploying with account: 0x...

📦 Deploying Mock Native Token...
Native Token deployed to: 0x...

📦 Deploying BlocTime...
BlocTime deployed to: 0x...

⚙️  Setting multiplier points...
Multiplier points set successfully

📦 Deploying Registry...
Registry deployed to: 0x...

📦 Deploying Market...
Market deployed to: 0x...

📝 Deployment Summary:
========================
Native Token: 0x...
BlocTime: 0x...
Registry: 0x...
Market: 0x...
========================

✅ Deployment complete!

💡 Export these addresses:
export NATIVE_TOKEN_ADDRESS=0x...
export BLOCTIME_ADDRESS=0x...
export REGISTRY_ADDRESS=0x...
export MARKET_ADDRESS=0x...
```

## Post-Deployment Configuration

### 1. Configure Staking Multipliers

```javascript
const blocTime = await ethers.getContractAt('BlocTime', BLOCTIME_ADDRESS);

const points = [
  { blocks: 0, multiplier: 10000 },      // 1.0x
  { blocks: 10000, multiplier: 15000 },  // 1.5x
  { blocks: 50000, multiplier: 20000 },  // 2.0x
  { blocks: 100000, multiplier: 30000 }  // 3.0x
];

await blocTime.setPoints(points);
```

### 2. Configure Treasury

```javascript
const treasury = await ethers.getContractAt('Treasury', TREASURY_ADDRESS);

// Set governance token
await treasury.setGovernanceToken(NATIVE_TOKEN_ADDRESS);

// Add accepted payment tokens
await treasury.addTreasuryToken(USDC_ADDRESS);
await treasury.addTreasuryToken(DAI_ADDRESS);
```

### 3. Configure Permissions

```javascript
const perms = await ethers.getContractAt('Perms', PERMS_ADDRESS);

// Grant roles
await perms.grantRole('ADMIN', ADMIN_ADDRESS);
await perms.grantRole('OPERATOR', OPERATOR_ADDRESS);
```

### 4. Register Initial Modules

```javascript
const registry = await ethers.getContractAt('Registry', REGISTRY_ADDRESS);

await registry.registerModule(
  ethers.parseEther('0.01'), // price per block
  100,                        // max concurrent users
  'ipfs://metadata-hash'      // IPFS metadata
);
```

## Chain-Specific Considerations

### Ethereum Mainnet
- **High gas costs**: Optimize batch operations
- **Slower blocks**: ~12 seconds per block
- **Use EIP-1559**: Set `maxFeePerGas` and `maxPriorityFeePerGas`

### Polygon
- **Fast blocks**: ~2 seconds per block
- **Low gas costs**: Great for testing
- **MATIC for gas**: Ensure you have MATIC

### Arbitrum
- **Very low gas**: Cheapest L2 option
- **Fast finality**: Quick confirmations
- **ETH for gas**: Use ETH on Arbitrum

### Base
- **Coinbase L2**: Growing ecosystem
- **Low gas costs**: Similar to Optimism
- **ETH for gas**: Use ETH on Base

### Avalanche C-Chain
- **Fast blocks**: ~2 seconds
- **AVAX for gas**: Ensure you have AVAX
- **Subnet support**: Can deploy on subnets

## Troubleshooting

### Gas Estimation Failed
```bash
# Manually set gas limit
await contract.method({ gasLimit: 500000 })
```

### Nonce Too Low
```bash
# Reset nonce
await provider.getTransactionCount(address, 'pending')
```

### Insufficient Funds
```bash
# Check balance
await provider.getBalance(address)
```

### RPC Connection Issues
```bash
# Try alternative RPC
# Use public RPCs or services like Infura, Alchemy, QuickNode
```

## Security Checklist

- [ ] Private key stored securely (never commit to git)
- [ ] `.env` file in `.gitignore`
- [ ] Contracts compiled with optimizer enabled
- [ ] All tests passing
- [ ] Multiplier points validated (monotonic)
- [ ] Treasury fee reasonable (1-5%)
- [ ] Owner permissions transferred to multisig
- [ ] Contracts verified on block explorer
- [ ] Initial liquidity provided
- [ ] Documentation updated with addresses

## Monitoring

### Track Deployments

Create a `deployments.json` file:

```json
{
  "polygon": {
    "nativeToken": "0x...",
    "blocTime": "0x...",
    "registry": "0x...",
    "market": "0x...",
    "treasury": "0x...",
    "perms": "0x..."
  },
  "arbitrum": {
    "nativeToken": "0x...",
    "blocTime": "0x...",
    "registry": "0x...",
    "market": "0x...",
    "treasury": "0x...",
    "perms": "0x..."
  }
}
```

### Monitor Events

```javascript
// Listen for staking events
blocTime.on('Staked', (user, amount, lockBlocks, blocTimeEarned) => {
  console.log(`Stake: ${user} staked ${amount} for ${lockBlocks} blocks`);
});

// Listen for marketplace events
market.on('Rented', (rentalId, moduleId, renter, blocks, cost) => {
  console.log(`Rental: ${renter} rented module ${moduleId}`);
});
```

## Support

For deployment support:
- **GitHub Issues**: [repository]/issues
- **Documentation**: /docs
- **API Reference**: /docs/API_REFERENCE.md
- **Integration Guide**: /docs/INTEGRATION_GUIDE.md

---

**Built with 💎 by the BlocTime Team**

*"Simplicity is the ultimate sophistication." - Leonardo da Vinci*
