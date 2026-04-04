# Permissions Contracts

This folder contains the permission management system for the BlocTime platform.

## Contracts

### Perms.sol
Flexible permission system with parent-child key relationships, ownership control, and configurable limits.

**Key Features:**
- Hierarchical key-based permissions
- Parent key ownership model
- Configurable limits (max child keys, max key size)
- Gas-efficient key management
- Event-driven architecture

## Core Concepts

### Parent-Child Keys
- **Parent Key**: Top-level identifier (e.g., module ID, user ID)
- **Child Keys**: Permissions or sub-identifiers under parent key
- Each parent key has an owner who controls all child keys

### Ownership Model
- First user to add/set keys for a parent becomes the owner
- Only owner can modify child keys
- Ownership can be transferred
- Contract owner can adjust global limits

## Main Functions

### Key Management

**addKey(bytes parentKey, bytes childKey)**
- Add a single child key to parent
- Only parent key owner can add
- Validates against size and count limits
- User pays gas fees

**removeKey(bytes parentKey, bytes childKey)**
- Remove child key by value
- Only parent key owner can remove
- Efficient array manipulation

**removeKeyAtIndex(bytes parentKey, uint index)**
- Remove child key by index
- Faster than removeKey if index is known
- Only parent key owner can remove

**setKeys(bytes parentKey, bytes[] childKeys)**
- Replace all child keys at once
- Validates all keys before setting
- More gas-efficient for bulk updates
- Only parent key owner can set

### Ownership

**transferKeyOwnership(bytes parentKey, address newOwner)**
- Transfer parent key ownership
- Only current owner can transfer
- Emits OwnershipTransferred event

### Configuration (Contract Owner Only)

**setMaxChildKeys(uint256 newMax)**
- Update maximum child keys per parent
- Prevents excessive storage usage

**setMaxKeySize(uint256 newMax)**
- Update maximum key size in bytes
- Prevents gas attacks

### Query Functions

**getKeys(bytes parentKey) → bytes[]**
- Get all child keys for parent
- View function (no gas cost)

**getKeyCount(bytes parentKey) → uint**
- Get number of child keys
- Useful for pagination

**getKeyAtIndex(bytes parentKey, uint index) → bytes**
- Get specific child key by index
- Efficient for iteration

**getKeyOwner(bytes parentKey) → address**
- Get owner of parent key
- Returns address(0) if no owner set

## Usage Examples

### Module Permissions
```solidity
// Module owner grants access to users
bytes memory moduleId = abi.encodePacked("module123");
bytes memory userId = abi.encodePacked("user456");

perms.addKey(moduleId, userId);
```

### Role-Based Access
```solidity
// Assign roles to users
bytes memory userId = abi.encodePacked(msg.sender);
bytes memory adminRole = abi.encodePacked("admin");
bytes memory editorRole = abi.encodePacked("editor");

bytes[] memory roles = new bytes[](2);
roles[0] = adminRole;
roles[1] = editorRole;

perms.setKeys(userId, roles);
```

### Access Control Check
```solidity
// Check if user has permission
bytes memory moduleId = abi.encodePacked("module123");
bytes[] memory authorizedUsers = perms.getKeys(moduleId);

for (uint i = 0; i < authorizedUsers.length; i++) {
    if (keccak256(authorizedUsers[i]) == keccak256(abi.encodePacked(msg.sender))) {
        // User is authorized
        break;
    }
}
```

## Gas Optimization

- Users pay gas for all operations (no subsidized transactions)
- Efficient array operations (swap-and-pop for removal)
- Configurable limits prevent gas attacks
- Batch operations (setKeys) for bulk updates

## Security Features

- Owner-only modifications
- Size and count limits
- Event logging for all changes
- Ownership transfer protection
- No external dependencies

## Events

- `KeyAdded(bytes parentKey, bytes childKey, address addedBy)`
- `KeyRemoved(bytes parentKey, bytes childKey, address removedBy)`
- `KeysSet(bytes parentKey, uint256 count, address setBy)`
- `OwnershipTransferred(bytes parentKey, address previousOwner, address newOwner)`
- `MaxChildKeysUpdated(uint256 newMax)`
- `MaxKeySizeUpdated(uint256 newMax)`

## Configuration Defaults

- **maxChildKeys**: 100 (adjustable)
- **maxKeySize**: 1024 bytes (adjustable)
- **Contract Owner**: Deployer address

## Integration Points

- **Registry**: Module access control
- **Marketplace**: Rental permissions
- **Staking**: Reward distribution rights
- **Custom Logic**: Any hierarchical permission needs
