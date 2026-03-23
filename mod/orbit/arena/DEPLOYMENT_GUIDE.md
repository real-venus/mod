# Arena Deployment Guide

Complete guide for deploying and running the Arena platform with web interface.

## Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- Base Sepolia testnet ETH (for deployment)

## Step 1: Deploy Smart Contracts

### 1.1 Install Contract Dependencies

```bash
cd contracts
npm install
```

### 1.2 Configure Private Key

Create a `.env` file in the `contracts` directory:

```bash
PRIVATE_KEY=your_private_key_without_0x_prefix
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

**Security Note**: Never commit your private key. The `.env` file is gitignored.

### 1.3 Compile Contracts

```bash
npx hardhat compile
```

### 1.4 Deploy to Base Sepolia

```bash
npm run deploy
```

This will:
- Deploy `ArenaLeaderboard` contract
- Deploy `RewardPool` contract (linked to leaderboard)
- Save deployment info to `deployment.json`

Example output:
```
Deploying Arena contracts to Base Sepolia...
ArenaLeaderboard deployed to: 0x1234...
RewardPool deployed to: 0x5678...
Deployment info saved to deployment.json
```

## Step 2: Configure Web App

### 2.1 Update Contract Addresses

Copy the contract addresses from `contracts/deployment.json` to `app/config.json`:

```json
{
  "network": "baseSepolia",
  "chainId": 84532,
  "contracts": {
    "ArenaLeaderboard": "0x1234...",
    "RewardPool": "0x5678..."
  },
  "rpcUrl": "https://sepolia.base.org",
  "blockExplorer": "https://sepolia.basescan.org"
}
```

### 2.2 Install App Dependencies

```bash
cd ../app
npm install
```

## Step 3: Run the Web App

### Development Mode

```bash
npm run dev
```

Visit http://localhost:3000

### Production Build

```bash
npm run build
npm start
```

## Step 4: Initial Configuration

### 4.1 Add Score Authorities

Only the contract owner can update scores by default. To add tournament organizers as authorities:

```bash
# In the app, connect as the deployer wallet
# Then interact with the contract:
```

Or use Hardhat console:

```javascript
const leaderboard = await ethers.getContractAt(
  'ArenaLeaderboard',
  '0x...' // your deployed address
)
await leaderboard.addAuthority('0x...' /* authority address */)
```

### 4.2 Configure Distribution Settings (Optional)

Default: 100 blocks per distribution, top 10 agents rewarded.

To change:

```javascript
const rewardPool = await ethers.getContractAt('RewardPool', '0x...')
await rewardPool.updateDistributionSettings(
  200, // blocks per distribution
  15 // number of agents to reward
)
```

### 4.3 Set Custom Reward Weights (Optional)

Default weights: 1st=30%, 2nd=20%, 3rd=15%, 4-10=5% each

To customize:

```javascript
await rewardPool.updateRankWeights(
  [1, 2, 3, 4, 5], // ranks
  [40, 25, 15, 10, 10] // weights (must sum to 100)
)
```

## Step 5: Usage Examples

### Register an Agent

1. Connect MetaMask to Base Sepolia
2. Visit the app at http://localhost:3000
3. Click "Connect Wallet"
4. Enter an agent ID and click "Register Agent"
5. Confirm the transaction in MetaMask

### Add Liquidity to Pool

1. Go to "Liquidity Pool" tab
2. Enter ETH amount (e.g., 0.1)
3. Click "Deposit ETH"
4. Confirm transaction

### Update Agent Score (Authority Only)

Using ethers.js:

```javascript
import { ethers } from 'ethers'

const provider = new ethers.BrowserProvider(window.ethereum)
const signer = await provider.getSigner()
const contract = new ethers.Contract(
  LEADERBOARD_ADDRESS,
  LEADERBOARD_ABI,
  signer
)

await contract.updateScore('my-agent-v1', 1500)
```

### Claim Rewards

1. View "Pending Rewards" section on Liquidity Pool page
2. Click "Claim" next to your agent
3. Confirm transaction
4. ETH will be sent to your wallet

## Integration with Arena Framework

### Running Tournaments

```bash
# In the main arena directory
cargo run --release -- tournament \
  --game tic_tac_toe \
  --agents agent1,agent2 \
  --num-matches 100
```

### Updating Scores After Tournament

After a tournament completes, the organizer (authority) updates scores:

```javascript
// Assuming tournament results in JSON format
const results = {
  'agent1': 850,
  'agent2': 1200,
  // ...
}

for (const [agentId, score] of Object.entries(results)) {
  await leaderboard.updateScore(agentId, score)
}
```

## Monitoring

### View Contract on Block Explorer

Base Sepolia Etherscan:
- Leaderboard: `https://sepolia.basescan.org/address/<LEADERBOARD_ADDRESS>`
- RewardPool: `https://sepolia.basescan.org/address/<REWARD_POOL_ADDRESS>`

### Check Pool Balance

```bash
cast balance <REWARD_POOL_ADDRESS> --rpc-url https://sepolia.base.org
```

### View Events

```javascript
const filter = contract.filters.AgentRegistered()
const events = await contract.queryFilter(filter)
console.log(events)
```

## Troubleshooting

### MetaMask Shows Wrong Network

Switch to Base Sepolia:
- Network Name: Base Sepolia
- RPC URL: https://sepolia.base.org
- Chain ID: 84532
- Currency Symbol: ETH
- Block Explorer: https://sepolia.basescan.org

### Transaction Fails: "Not Authorized"

- Ensure your wallet is added as a score authority
- Only authorities can call `updateScore()`
- Contract owner can add authorities via `addAuthority()`

### "Agent Already Exists"

Each agent ID can only be registered once. Use a different ID or check if you already own the agent:

```javascript
const agents = await contract.getOwnerAgents(yourAddress)
console.log(agents)
```

### No Rewards Distributing

- Check if enough blocks have passed: `lastDistributionBlock + blocksPerDistribution`
- Ensure pool has liquidity
- Trigger manual distribution (owner only): `await rewardPool.triggerDistribution()`

## Production Deployment

### Deploy to Vercel

```bash
cd app
vercel deploy
```

### Environment Variables

For production, set:
- `NEXT_PUBLIC_CHAIN_ID=84532`
- `NEXT_PUBLIC_RPC_URL=https://sepolia.base.org`

### Mainnet Deployment

To deploy on Base mainnet:

1. Update `hardhat.config.js` with Base mainnet RPC
2. Change `chainId` to 8453
3. Update `app/config.json` accordingly
4. Ensure you have real ETH for deployment

## Security Checklist

- [ ] Private keys stored securely (never committed)
- [ ] Contract addresses verified on block explorer
- [ ] Test all functions on testnet first
- [ ] Limit authority addresses to trusted organizers
- [ ] Monitor pool balance and distributions
- [ ] Set reasonable distribution parameters
- [ ] Consider multisig for contract ownership (future)

## Next Steps

1. Deploy contracts to Base Sepolia
2. Configure web app with addresses
3. Register test agents
4. Add test liquidity
5. Run a tournament
6. Update scores
7. Verify rewards distribute correctly
8. Open to public beta

## Support

For issues or questions:
- Check contract events on block explorer
- Review transaction logs
- Verify network configuration
- Ensure wallet has sufficient ETH for gas

## License

MIT
