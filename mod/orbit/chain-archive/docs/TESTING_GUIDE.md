# BlocTime Protocol - Testing Guide

## Overview

Comprehensive testing strategy covering unit tests, integration tests, security tests, and gas optimization.

## Test Structure

```
test/
├── BlocTime.test.js           # Staking and multiplier tests
├── Market.test.js             # Marketplace functionality
├── MarketWithTokenGate.test.js # TokenGate integration
├── Registry.test.js           # Module registration
├── Treasury.test.js           # Revenue distribution
├── TokenGate.test.js          # Token whitelist
├── Oracles.test.js            # Price feed adapters
├── Perms.test.js              # Access control
└── Integration.test.js        # End-to-end workflows
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Suite

```bash
npx hardhat test test/BlocTime.test.js
npx hardhat test test/Integration.test.js
```

### With Gas Reporting

```bash
REPORT_GAS=true npm test
```

### Coverage Report

```bash
npm run coverage
```

Generates coverage report in `coverage/` directory.

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual contract functions in isolation.

**Example - BlocTime Staking**:
```javascript
it("Should stake tokens correctly", async function () {
  await expect(blocTime.connect(user1).stake(stakeAmount, lockBlocks))
    .to.emit(blocTime, "Staked");
  
  const position = await blocTime.getStakePosition(user1.address, stakeId);
  expect(position.amount).to.equal(stakeAmount);
});
```

### 2. Integration Tests

**Purpose**: Test interactions between multiple contracts.

**Example - Full Workflow**:
```javascript
it("Should complete full staking and marketplace flow", async function () {
  // 1. Stake tokens → earn BlocTime
  await blocTime.connect(user1).stake(stakeAmount, lockBlocks);
  
  // 2. Fund treasury from marketplace fees
  await treasury.fund(paymentToken, feeAmount);
  
  // 3. Distribute to BlocTime holders
  await treasury.distribute(paymentToken);
  
  // 4. Claim rewards
  await treasury.connect(user1).claim(paymentToken);
});
```

### 3. Security Tests

**Purpose**: Verify security mechanisms and edge cases.

**Reentrancy Protection**:
```javascript
it("Should prevent reentrancy attacks", async function () {
  await blocTime.connect(user1).unstake(stakeId);
  await expect(blocTime.connect(user1).unstake(stakeId)).to.be.reverted;
});
```

**Access Control**:
```javascript
it("Should enforce access control", async function () {
  await expect(oracle.connect(user1).setPrice(token, price, decimals))
    .to.be.reverted;
});
```

### 4. Gas Optimization Tests

**Purpose**: Measure and optimize gas consumption.

```bash
REPORT_GAS=true npx hardhat test
```

**Output**:
```
·-----------------------------------------|---------------------------|-------------|-----------------------------·
|  Solc version: 0.8.20                   ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 30000000 gas  │
··········································|···························|·············|······························
|  Methods                                                                                                         │
·················|························|·············|·············|·············|···············|··············
|  Contract      ·  Method                ·  Min        ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
·················|························|·············|·············|·············|···············|··············
|  BlocTime      ·  stake                 ·     120000  ·     150000  ·     135000  ·           10  ·          -  │
·················|························|·············|·············|·············|···············|··············
|  BlocTime      ·  unstake               ·      80000  ·     100000  ·      90000  ·            8  ·          -  │
·················|························|·············|·············|·············|···············|··············
```

## Test Coverage Goals

### Target Coverage: 95%+

- **Statements**: 95%+
- **Branches**: 90%+
- **Functions**: 100%
- **Lines**: 95%+

### Critical Paths (100% Coverage Required)

- Token transfers
- Staking/unstaking logic
- Treasury distribution
- Access control
- Reentrancy guards

## Writing New Tests

### Test Template

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContractName", function () {
  let contract, owner, user1;
  
  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    const Contract = await ethers.getContractFactory("ContractName");
    contract = await Contract.deploy(/* constructor args */);
    await contract.waitForDeployment();
  });
  
  describe("Feature", function () {
    it("Should do something", async function () {
      // Arrange
      const input = 123;
      
      // Act
      await contract.method(input);
      
      // Assert
      expect(await contract.value()).to.equal(input);
    });
    
    it("Should revert on invalid input", async function () {
      await expect(contract.method(0))
        .to.be.revertedWith("Invalid input");
    });
  });
});
```

### Best Practices

1. **Use descriptive test names**: `"Should distribute rewards proportionally to BlocTime holdings"`
2. **Test happy path first**: Normal expected behavior
3. **Test edge cases**: Zero values, max values, boundary conditions
4. **Test failure cases**: Invalid inputs, unauthorized access
5. **Use beforeEach**: Reset state for each test
6. **Check events**: Verify events are emitted correctly
7. **Test gas limits**: Ensure operations fit within block gas limit

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run coverage
```

## Test Data

### Mock Addresses

```javascript
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MOCK_ADDRESS = "0x1111111111111111111111111111111111111111";
```

### Common Values

```javascript
const INITIAL_SUPPLY = ethers.parseEther("1000000");
const STAKE_AMOUNT = ethers.parseEther("100");
const TOKEN_PRICE = 100000000n; // $1 with 8 decimals
```

## Debugging Tests

### Enable Console Logs

```javascript
console.log("Balance:", await token.balanceOf(user.address));
```

### Hardhat Console

```javascript
const { ethers } = require("hardhat");
await ethers.provider.getBlockNumber();
```

### Time Manipulation

```javascript
// Mine blocks
await ethers.provider.send("hardhat_mine", ["0x64"]); // Mine 100 blocks

// Increase time
await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
await ethers.provider.send("evm_mine");
```

## Performance Benchmarks

### Expected Test Runtime

- **Unit tests**: < 30 seconds
- **Integration tests**: < 60 seconds
- **Full suite**: < 2 minutes
- **Coverage**: < 5 minutes

## Troubleshooting

### Common Issues

**Issue**: `Error: VM Exception while processing transaction: revert`
**Solution**: Check require statements and input validation

**Issue**: `Error: Transaction reverted without a reason string`
**Solution**: Add custom error messages to require statements

**Issue**: Tests timeout
**Solution**: Increase timeout in hardhat.config.js:
```javascript
mocha: {
  timeout: 100000
}
```

---

**Built with 💎 by the BlocTime Team**
