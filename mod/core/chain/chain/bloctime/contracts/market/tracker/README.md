# BlocTime Tracker

## Overview

The BlocTime Tracker is a session management contract that tracks user bloctime consumption with signature-based verification. It allows both clients and servers to submit signed session data on-chain.

## Key Features

✅ **Signature-Based Sessions** - Client signs start/stop requests, server can submit
✅ **Dual Submission** - Both client and server can submit signed data
✅ **Automatic Deduction** - Burns bloctime tokens based on elapsed blocks
✅ **Replay Protection** - One-time use signatures
✅ **Epoch Management** - Periodic map clearing for gas optimization
✅ **Legacy Support** - Direct start/stop methods for backward compatibility

## Core Concepts

### Session Flow

1. **Start Session**
   - User signs "START" message with block number
   - Client or server submits signature on-chain
   - Records user's current bloctime balance
   - Marks session as active

2. **Stop Session**
   - User signs "STOP" message with block number
   - Client or server submits signature on-chain
   - Calculates blocks elapsed
   - Burns corresponding bloctime tokens
   - Marks session as inactive

### Signature Format

```javascript
// Start session
messageHash = keccak256(abi.encodePacked("START", userAddress, startBlock))
signature = user.signMessage(messageHash)

// Stop session
messageHash = keccak256(abi.encodePacked("STOP", userAddress, stopBlock))
signature = user.signMessage(messageHash)
```

## Contract Functions

### Session Management

#### Signature-Based (Recommended)

```solidity
// Start session with client signature
function startSessionWithSignature(
    address user,
    uint256 startBlock,
    bytes memory signature
) external

// Stop session with client signature
function stopSessionWithSignature(
    address user,
    uint256 stopBlock,
    bytes memory signature
) external
```

**Benefits:**
- Server can submit on behalf of user
- Reduces client transaction costs
- Enables batch processing
- Maintains user authorization

#### Legacy Direct Methods

```solidity
// User directly starts session
function startSession() external

// User directly stops session
function stopSession() external
```

### Epoch Management

```solidity
// Set epoch interval (owner only)
function setEpochInterval(uint256 _epochInterval) external onlyOwner

// Clear maps (owner or auto after epoch)
function clearMaps() public
```

### View Functions

```solidity
// Get user session info
function getUserSession(address user) external view returns (
    uint256 startBlock,
    uint256 stopBlock,
    uint256 totalBlocTime,
    bool isActive,
    uint256 blocksElapsed
)
```

### Admin Functions

```solidity
// Withdraw collected bloctime tokens
function withdrawBlocTime(uint256 amount) external onlyOwner
```

## Usage Examples

### Client-Side (JavaScript)

```javascript
const { ethers } = require('ethers');

// Start session with signature
async function startSession(user, tracker) {
    const startBlock = await ethers.provider.getBlockNumber() + 1;
    
    // Create message hash
    const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256'],
        ['START', user.address, startBlock]
    );
    
    // Sign message
    const signature = await user.signMessage(ethers.getBytes(messageHash));
    
    // Submit to contract (can be done by server)
    await tracker.startSessionWithSignature(
        user.address,
        startBlock,
        signature
    );
}

// Stop session with signature
async function stopSession(user, tracker) {
    const stopBlock = await ethers.provider.getBlockNumber() + 1;
    
    const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256'],
        ['STOP', user.address, stopBlock]
    );
    
    const signature = await user.signMessage(ethers.getBytes(messageHash));
    
    await tracker.stopSessionWithSignature(
        user.address,
        stopBlock,
        signature
    );
}
```

### Server-Side (Node.js)

```javascript
// Server receives signed message from client
app.post('/api/session/start', async (req, res) => {
    const { userAddress, startBlock, signature } = req.body;
    
    // Verify signature locally (optional)
    const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256'],
        ['START', userAddress, startBlock]
    );
    const ethSignedHash = ethers.hashMessage(ethers.getBytes(messageHash));
    const signer = ethers.recoverAddress(ethSignedHash, signature);
    
    if (signer.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Submit to blockchain
    const tx = await tracker.startSessionWithSignature(
        userAddress,
        startBlock,
        signature
    );
    
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
});
```

## BlocTime Deduction

### Calculation

```
blocksElapsed = stopBlock - startBlock
blocTimeDeducted = blocksElapsed

remainingBlocTime = currentBalance - blocksElapsed
```

### Requirements

- User must have sufficient bloctime balance
- Session must be active
- Tracker must have approval to transfer tokens

### Example

```javascript
// User has 10,000 bloctime tokens
// Starts session at block 1000
// Stops session at block 1500
// Blocks elapsed: 500
// BlocTime deducted: 500
// Remaining: 9,500
```

## Security Features

✅ **ECDSA Signature Verification** - Cryptographic proof of authorization
✅ **Replay Protection** - Signatures can only be used once
✅ **Balance Checks** - Ensures sufficient bloctime before deduction
✅ **Access Control** - Owner-only admin functions
✅ **Event Logging** - All actions emit events for tracking

## Events

```solidity
event SessionStarted(address indexed user, uint256 startBlock, uint256 blocTimeBalance, address submitter)
event SessionStopped(address indexed user, uint256 stopBlock, uint256 blocksElapsed, uint256 remainingBlocTime, address submitter)
event BlocTimeDeducted(address indexed user, uint256 blocksElapsed, uint256 remainingBlocTime)
event EpochIntervalUpdated(uint256 newInterval)
event MapCleared(uint256 epochBlock, uint256 usersCleared)
```

## Integration Points

### With BlocTimeToken
- Reads user balance for session start
- Burns tokens on session stop
- Requires token approval

### With Staking
- Users earn bloctime from staking
- Tracker consumes bloctime for sessions
- Creates circular economy

### With Marketplace
- Can track rental sessions
- Deduct bloctime for usage
- Enable pay-per-block models

## Design Decisions

1. **Signature-Based**: Allows server submission while maintaining user control
2. **Dual Methods**: Legacy direct + new signature-based for flexibility
3. **Epoch Clearing**: Gas optimization for long-running deployments
4. **Token Burning**: Permanent removal of consumed bloctime
5. **Event-Rich**: Comprehensive logging for off-chain tracking

## Gas Optimization

- Epoch-based map clearing reduces storage costs
- Signature verification done on-chain (no oracle needed)
- Minimal storage per session
- Efficient signature replay protection

---

**Built with 💎 by the BlocTime Team**