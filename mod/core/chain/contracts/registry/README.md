# Registry Contract

Minimal registry for managing asset metadata via dataHash (JSON from datahash).

## Overview

The Registry contract provides a simple, lightweight system for registering and managing assets described as JSON metadata stored in dataHash (typically IPFS hash).

## Core Concepts

### Modules

Modules are registered assets with JSON metadata referenced by dataHash.

**Module Properties:**
- **owner**: Module creator/owner address
- **dataHash**: IPFS hash or metadata reference containing JSON description of the asset

## Main Functions

### Module Management

**registerModule(string dataHash) → uint256**
- Register new module with JSON metadata
- Returns module ID
- Sets caller as owner
- dataHash contains JSON describing the asset

**updateModule(uint256 moduleId, string dataHash)**
- Update module metadata
- Only module owner
- dataHash must be valid

### Query Functions

**getModule(uint256 id) → (address owner, string dataHash)**
- Get module details

**getUserModules(address user) → uint256[]**
- Get all modules owned by user

## Usage Flow

### Module Owner Flow
1. Register module with dataHash (JSON metadata)
2. Update dataHash as needed
3. Manage ownership

## Example Usage

### Register Module
```solidity
uint256 moduleId = registry.registerModule(
    "QmXYZ..."  // IPFS hash containing JSON asset description
);
```

### Update Module
```solidity
registry.updateModule(
    moduleId,
    "QmABC..."  // New IPFS hash with updated JSON
);
```

## Events

- `ModuleRegistered(uint256 moduleId, address owner, string dataHash)`
- `ModuleUpdated(uint256 moduleId, string dataHash)`

## Integration Points

- **Marketplace**: Asset discovery and metadata retrieval
- **IPFS**: Decentralized storage for JSON metadata
- **External Systems**: Query asset information via dataHash
