# Arena Testing Guide

Complete guide for testing the Arena platform locally and on testnet.

## Local Development Testing

### 1. Test Smart Contracts Locally

```bash
cd contracts

# Start local Hardhat node (Terminal 1)
npx hardhat node

# Deploy to local network (Terminal 2)
npx hardhat run scripts/deploy.js --network localhost

# Run tests
npx hardhat test

# Check coverage
npx hardhat coverage
```

### 2. Test Frontend Locally (Mock Mode)

```bash
cd app

# Install dependencies
npm install

# Start dev server
npm run dev

# Visit http://localhost:3000
```

## Testnet Testing (Base Sepolia)

### Prerequisites

1. **MetaMask Setup**
   - Install [MetaMask](https://metamask.io/)
   - Add Base Sepolia network:
     - Network Name: Base Sepolia
     - RPC URL: https://sepolia.base.org
     - Chain ID: 84532
     - Currency: ETH
     - Block Explorer: https://sepolia.basescan.org

2. **Get Testnet ETH**
   - Get Sepolia ETH from faucet
   - Bridge to Base Sepolia: https://bridge.base.org

### Step 1: Deploy Contracts

```bash
cd contracts

# Set your private key
export PRIVATE_KEY=your_private_key_without_0x

# Deploy
npm run deploy

# Expected output:
# ArenaLeaderboard deployed to: 0x...
# RewardPool deployed to: 0x...
# Deployment info saved to deployment.json
```

### Step 2: Verify Deployment

```bash
# Check contracts on block explorer
# Open: https://sepolia.basescan.org/address/LEADERBOARD_ADDRESS
# Open: https://sepolia.basescan.org/address/REWARD_POOL_ADDRESS

# Verify contract source (optional)
npx hardhat verify --network baseSepolia LEADERBOARD_ADDRESS
npx hardhat verify --network baseSepolia REWARD_POOL_ADDRESS "LEADERBOARD_ADDRESS"
```

### Step 3: Configure Frontend

```bash
cd ../app

# Update config.json with deployed addresses
# Copy from contracts/deployment.json
```

### Step 4: Test Web Interface

```bash
# Start app
npm run dev

# Open http://localhost:3000
```

## Testing Checklist

### Smart Contract Tests

- [ ] **Leaderboard Contract**
  - [ ] Register new agent
  - [ ] Register duplicate agent (should fail)
  - [ ] Update score as authority
  - [ ] Update score as non-authority (should fail)
  - [ ] Get leaderboard rankings
  - [ ] Get agent details
  - [ ] Get agent rank
  - [ ] Add authority
  - [ ] Remove authority

- [ ] **Reward Pool Contract**
  - [ ] Add ETH liquidity
  - [ ] Check pool balance
  - [ ] Trigger distribution
  - [ ] Check pending rewards
  - [ ] Claim rewards
  - [ ] Claim rewards twice (should fail - no balance)
  - [ ] Update distribution settings
  - [ ] Update rank weights

### Frontend Tests

- [ ] **Wallet Connection**
  - [ ] Connect MetaMask
  - [ ] Switch networks
  - [ ] Disconnect wallet
  - [ ] Reconnect on page reload
  - [ ] Account change handling

- [ ] **Agent Management**
  - [ ] Register new agent
  - [ ] View registered agents
  - [ ] Display "My Agents" section
  - [ ] Show agent scores and ranks

- [ ] **Leaderboard**
  - [ ] Display global rankings
  - [ ] Highlight user's agents
  - [ ] Show medal icons (1st, 2nd, 3rd)
  - [ ] Refresh button works
  - [ ] Auto-refresh every 10s

- [ ] **Liquidity Pool**
  - [ ] Display pool statistics
  - [ ] Show blocks until next distribution
  - [ ] Deposit ETH
  - [ ] View pending rewards
  - [ ] Claim rewards
  - [ ] Show transaction confirmations

## End-to-End Test Scenario

### Scenario: Full Competition Cycle

1. **Setup (5 min)**
   ```bash
   # Deploy contracts
   cd contracts
   export PRIVATE_KEY=your_key
   npm run deploy

   # Start app
   cd ../app
   # Update config.json
   npm run dev
   ```

2. **Register Agents (2 min)**
   - Connect Wallet A → Register "agent-alice"
   - Connect Wallet B → Register "agent-bob"
   - Connect Wallet C → Register "agent-charlie"
   - Verify all appear on leaderboard

3. **Add Liquidity (1 min)**
   - Connect Wallet D (sponsor)
   - Go to "Liquidity Pool"
   - Deposit 0.1 ETH
   - Verify pool shows 0.1 ETH

4. **Run Tournament (5 min)**
   ```bash
   # In arena root directory
   cargo run --release -- tournament \
     --game tic_tac_toe \
     --agents random_bot,python_bot \
     --num-matches 10
   ```

5. **Update Scores (2 min)**
   - As contract owner/authority
   - Update scores:
     - agent-alice: 1000
     - agent-bob: 800
     - agent-charlie: 600
   - Verify leaderboard updates

6. **Wait for Distribution (20 min)**
   - Monitor "Blocks until next distribution"
   - Watch countdown on Liquidity Pool page
   - When reaches 0, next interaction triggers distribution

7. **Check Rewards (1 min)**
   - agent-alice should have pending rewards (1st place)
   - agent-bob should have rewards (2nd place)
   - agent-charlie should have rewards (3rd place)

8. **Claim Rewards (2 min)**
   - Connect as Wallet A
   - View pending rewards for agent-alice
   - Click "Claim"
   - Verify ETH received in wallet

9. **Verify State (1 min)**
   - Check pool liquidity decreased
   - Check agent totalRewardsClaimed increased
   - Check transaction on block explorer

**Total Test Time: ~40 minutes**

## Automated Testing

### Smart Contract Tests

Create `contracts/test/Arena.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Arena Platform", function () {
  let leaderboard, rewardPool;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const Leaderboard = await ethers.getContractFactory("ArenaLeaderboard");
    leaderboard = await Leaderboard.deploy();

    const RewardPool = await ethers.getContractFactory("RewardPool");
    rewardPool = await RewardPool.deploy(await leaderboard.getAddress());
  });

  it("Should register agents", async function () {
    await leaderboard.connect(addr1).registerAgent("agent1");
    const agent = await leaderboard.getAgent("agent1");
    expect(agent.owner).to.equal(addr1.address);
  });

  it("Should update scores", async function () {
    await leaderboard.connect(addr1).registerAgent("agent1");
    await leaderboard.updateScore("agent1", 100);
    const agent = await leaderboard.getAgent("agent1");
    expect(agent.score).to.equal(100);
  });

  it("Should add liquidity", async function () {
    await rewardPool.addEthLiquidity({ value: ethers.parseEther("1") });
    expect(await rewardPool.ethLiquidity()).to.equal(ethers.parseEther("1"));
  });

  // Add more tests...
});
```

Run tests:
```bash
npx hardhat test
```

### Frontend Tests (TODO)

Using Playwright or Cypress for E2E tests:

```typescript
// Example with Playwright
test('should connect wallet', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Connect Wallet")');
  // Mock MetaMask interaction
  await expect(page.locator('text=0x...')).toBeVisible();
});
```

## Performance Testing

### Gas Usage

```bash
# Check gas usage in tests
REPORT_GAS=true npx hardhat test
```

Expected gas costs (Base Sepolia):
- Register Agent: ~100,000 gas
- Update Score: ~80,000 gas
- Add Liquidity: ~60,000 gas
- Claim Rewards: ~70,000 gas

### Load Testing

Test with multiple agents:

```javascript
// Register 100 agents
for (let i = 0; i < 100; i++) {
  await leaderboard.connect(accounts[i]).registerAgent(`agent-${i}`);
}

// Update all scores
for (let i = 0; i < 100; i++) {
  await leaderboard.updateScore(`agent-${i}`, Math.floor(Math.random() * 1000));
}

// Get leaderboard
const top20 = await leaderboard.getLeaderboard(20);
console.log("Top 20 agents:", top20);
```

## Security Testing

### Common Attacks to Test

1. **Reentrancy**
   - Try to recursively claim rewards
   - Should fail due to ReentrancyGuard

2. **Unauthorized Access**
   - Try to update scores without authority
   - Try to claim rewards for others' agents

3. **Integer Overflow**
   - Add massive liquidity amounts
   - Set extreme score values

4. **Front-Running**
   - Monitor distribution triggers
   - Attempt to register agents just before distribution

## Debugging

### Contract Debugging

```bash
# Enable Hardhat console logs
# In your contract:
import "hardhat/console.sol";
console.log("Debug:", value);

# Run with console output
npx hardhat test
```

### Frontend Debugging

```typescript
// Enable verbose logging
const contract = await getLeaderboardContract();
contract.on('AgentRegistered', (agentId, owner) => {
  console.log(`Agent ${agentId} registered by ${owner}`);
});

// Check transaction details
const tx = await contract.registerAgent('my-agent');
console.log('Transaction:', tx);
const receipt = await tx.wait();
console.log('Receipt:', receipt);
```

### Network Debugging

```bash
# Check RPC connection
curl -X POST https://sepolia.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check contract code
cast code LEADERBOARD_ADDRESS --rpc-url https://sepolia.base.org
```

## Common Issues

### "Insufficient funds"
- Get more testnet ETH from faucet
- Bridge Sepolia ETH to Base Sepolia

### "Wrong network"
- Verify MetaMask is on Base Sepolia (84532)
- Check RPC URL in app/config.json

### "Transaction failed"
- Check gas limit
- Verify contract addresses
- Check if you have authority (for score updates)

### "Agent already exists"
- Each ID is unique across all users
- Use a different ID or check owner

## Test Data

### Sample Agents

```javascript
const agents = [
  { id: 'alpha-v1', score: 1000 },
  { id: 'beta-v2', score: 950 },
  { id: 'gamma-v1', score: 900 },
  { id: 'delta-v3', score: 850 },
  { id: 'epsilon-v1', score: 800 },
];
```

### Sample Liquidity

- Small: 0.01 ETH
- Medium: 0.1 ETH
- Large: 1 ETH

### Sample Distributions

- Fast: 10 blocks (~2 min)
- Normal: 100 blocks (~20 min)
- Slow: 1000 blocks (~3.3 hours)

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Arena

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd contracts
          npm install

      - name: Compile contracts
        run: |
          cd contracts
          npx hardhat compile

      - name: Run tests
        run: |
          cd contracts
          npx hardhat test

      - name: Check coverage
        run: |
          cd contracts
          npx hardhat coverage
```

## Resources

- [Hardhat Testing](https://hardhat.org/tutorial/testing-contracts)
- [ethers.js Documentation](https://docs.ethers.org/)
- [Base Sepolia Faucet](https://bridge.base.org)
- [Base Sepolia Explorer](https://sepolia.basescan.org)

## Support

Found a bug? Create an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Network and wallet details
- Transaction hash (if applicable)

Happy testing! 🧪
