# Safe Multisig Contracts

A minimal implementation of Gnosis Safe-compatible multisignature wallet contracts for Hardhat.

## Overview

The Safe contracts provide a secure multisignature wallet implementation with the following features:

- **Multi-owner support**: Configure multiple owners for a Safe wallet
- **Threshold signatures**: Require a minimum number of owner signatures to execute transactions
- **Proxy pattern**: Deploy lightweight proxies that delegate to a singleton implementation
- **EIP-712 signatures**: Use typed structured data for secure transaction signing
- **Flexible operations**: Support both `Call` and `DelegateCall` operations

## Contracts

### Core Contracts

- **`Safe.sol`**: Main Safe implementation contract (singleton)
- **`ISafe.sol`**: Safe interface defining core functionality
- **`SafeProxy.sol`**: Minimal proxy contract that delegates to the Safe singleton
- **`SafeProxyFactory.sol`**: Factory contract for creating Safe proxy instances
- **`Enum.sol`**: Library defining operation types (Call, DelegateCall)

## Architecture

```
SafeProxyFactory
    │
    ├─> creates SafeProxy instances
    │       │
    │       └─> delegates to Safe (singleton)
    │
    └─> uses CREATE2 for deterministic addresses
```

## Deployment

### Using Hardhat Scripts

Deploy Safe contracts to different networks:

```bash
# Deploy to local network
npm run deploy:safe:local

# Deploy to Ganache
npm run deploy:safe:ganache

# Deploy to testnet (Base Sepolia)
npm run deploy:safe:testnet

# Deploy to mainnet
npm run deploy:safe:mainnet
```

### Manual Deployment

```javascript
const Safe = await ethers.getContractFactory('Safe');
const safeSingleton = await Safe.deploy();
await safeSingleton.waitForDeployment();

const SafeProxyFactory = await ethers.getContractFactory('SafeProxyFactory');
const proxyFactory = await SafeProxyFactory.deploy();
await proxyFactory.waitForDeployment();
```

## Usage

### Creating a Safe

```javascript
// Define owners and threshold
const owners = [owner1.address, owner2.address, owner3.address];
const threshold = 2; // Require 2 out of 3 signatures

// Encode setup call
const setupData = Safe.interface.encodeFunctionData('setup', [
  owners,
  threshold,
  ethers.ZeroAddress, // to (for optional delegate call)
  '0x', // data
  ethers.ZeroAddress, // fallbackHandler
  ethers.ZeroAddress, // paymentToken
  0, // payment
  ethers.ZeroAddress, // paymentReceiver
]);

// Create proxy using factory
const tx = await proxyFactory.createProxyWithNonce(
  singletonAddress,
  setupData,
  saltNonce
);
const receipt = await tx.wait();

// Get Safe address from event
const event = receipt.logs.find(
  (log) => log.topics[0] === proxyFactory.interface.getEvent('ProxyCreation').topicHash
);
const safeAddress = '0x' + event.topics[1].slice(26);

// Connect to Safe instance
const safe = await ethers.getContractAt('Safe', safeAddress);
```

### Executing Transactions

```javascript
// Prepare transaction parameters
const to = recipientAddress;
const value = ethers.parseEther('1.0');
const data = '0x'; // empty data for ETH transfer
const operation = 0; // Call operation
const nonce = await safe.nonce();

// Get transaction hash
const txHash = await safe.getTransactionHash(
  to,
  value,
  data,
  operation,
  0, // safeTxGas
  0, // baseGas
  0, // gasPrice
  ethers.ZeroAddress, // gasToken
  ethers.ZeroAddress, // refundReceiver
  nonce
);

// Sign with required number of owners
const signature1 = await owner1.signMessage(ethers.getBytes(txHash));
const signature2 = await owner2.signMessage(ethers.getBytes(txHash));

// Combine signatures in ascending order of signer addresses
const signers = [
  { address: owner1.address, signature: signature1 },
  { address: owner2.address, signature: signature2 },
].sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));

const combinedSignatures = signers[0].signature + signers[1].signature.slice(2);

// Execute transaction
await safe.execTransaction(
  to,
  value,
  data,
  operation,
  0, // safeTxGas
  0, // baseGas
  0, // gasPrice
  ethers.ZeroAddress, // gasToken
  ethers.ZeroAddress, // refundReceiver
  combinedSignatures
);
```

### Managing Owners

#### Add Owner

```javascript
// Prepare addOwnerWithThreshold call (must be executed via Safe itself)
const addOwnerData = safe.interface.encodeFunctionData('addOwnerWithThreshold', [
  newOwnerAddress,
  2, // new threshold
]);

const to = await safe.getAddress(); // Safe calls itself
const nonce = await safe.nonce();

const txHash = await safe.getTransactionHash(
  to,
  0, // no value
  addOwnerData,
  0, // Call operation
  0, 0, 0,
  ethers.ZeroAddress,
  ethers.ZeroAddress,
  nonce
);

// Sign and execute as above...
```

#### Remove Owner

```javascript
const owners = await safe.getOwners();
// Determine previous owner in linked list
const prevOwner = /* address before ownerToRemove */;

const removeOwnerData = safe.interface.encodeFunctionData('removeOwner', [
  prevOwner,
  ownerToRemove,
  1, // new threshold
]);

// Execute via Safe transaction as above...
```

#### Change Threshold

```javascript
const changeThresholdData = safe.interface.encodeFunctionData('changeThreshold', [
  3, // new threshold
]);

// Execute via Safe transaction as above...
```

## Testing

Run the Safe test suite:

```bash
# Run Safe tests
npm run test:safe

# Run all tests
npm test

# Run with gas reporting
npm run test:gas
```

## Key Features

### Security Features

- **Threshold signatures**: Configurable M-of-N signature requirement
- **Nonce-based replay protection**: Each transaction increments the nonce
- **EIP-712 typed signatures**: Prevents signature malleability
- **Owner validation**: Strict checks on owner addresses and duplicates
- **Signature ordering**: Signatures must be in ascending order by signer address

### Gas Optimization

- **Proxy pattern**: Minimal proxy deployment reduces gas costs
- **CREATE2**: Deterministic addresses for proxy deployment
- **Efficient storage**: Linked list for owner storage

### Flexibility

- **Operation types**: Support for both `Call` and `DelegateCall`
- **Dynamic owner management**: Add/remove owners and change threshold
- **Modular design**: Clean separation between proxy and implementation

## Transaction Hash Calculation

The Safe uses EIP-712 for typed structured data hashing:

```solidity
DOMAIN_SEPARATOR = keccak256(
  abi.encode(
    DOMAIN_SEPARATOR_TYPEHASH,
    chainId,
    safeAddress
  )
);

safeTxHash = keccak256(
  abi.encode(
    SAFE_TX_TYPEHASH,
    to,
    value,
    keccak256(data),
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    nonce
  )
);

txHash = keccak256(
  abi.encodePacked(
    0x19,
    0x01,
    DOMAIN_SEPARATOR,
    safeTxHash
  )
);
```

## Limitations

This is a minimal implementation for educational and development purposes. For production use, consider:

- Full Gnosis Safe implementation with additional modules
- Contract signature validation
- Approved hash mechanism
- ERC20 gas payment support
- Fallback handler support
- Guard contracts for additional validation

## Compatibility

- Solidity: `^0.8.0`
- Hardhat: `^2.19.0`
- Ethers.js: `^6.4.0`
- OpenZeppelin Contracts: `4.9.3`

## Events

```solidity
event SafeSetup(address indexed initiator, address[] owners, uint256 threshold, address initializer, address fallbackHandler);
event ExecutionSuccess(bytes32 txHash, uint256 payment);
event ExecutionFailure(bytes32 txHash, uint256 payment);
event AddedOwner(address owner);
event RemovedOwner(address owner);
event ChangedThreshold(uint256 threshold);
event ProxyCreation(address indexed proxy, address singleton);
```

## License

LGPL-3.0-only
