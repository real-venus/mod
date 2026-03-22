# API Server

The API server (`mod/core/api/`) is a FastAPI application that serves as the central hub for module registration, IPFS content management, version control, and blockchain operations.

## Starting the API

```bash
m serve api port=8000
```

Or in Python:
```python
import mod as m
m.serve('api', port=8000)
```

## Module Registration

The API server doubles as a decentralized module registry backed by IPFS.

### Register a Module

```python
api = m.mod('api')()

# Register a local module (uploads to IPFS, generates schema)
api.reg('mymod', key='main', comment='Initial release', public=True)

# Register from a git URL
api.reg_git('https://github.com/user/repo', name='mymod', key='main')

# Register from an IPFS CID
api.reg_ipfs('QmXyz...')

# Register all local modules at once
api.regall(key='main', comment='Batch upload')
```

### What Happens During Registration

1. Module content is uploaded to IPFS → returns a CID
2. Module schema is generated and uploaded to IPFS
3. A registry entry is created: `{name, key, cid, schema_cid, timestamp, comment}`
4. The entry is signed with your key
5. The entry is stored in the registry (IPFS-backed)

### Query Modules

```python
# Get module info
api.mod('agent')
# → {name, key, content, schema, cid, timestamps}

# List all modules
api.mods(search='agent', page=1, page_size=20)

# Get version history
api.versions('mymod')
# → [{cid, timestamp, comment}, ...]

# Get module content (file → CID mapping)
api.content('mymod', expand=True)  # expand=True returns full file contents
```

### Version Management

```python
# Roll back to a previous version
api.setback('mymod', cid='QmPreviousVersion...', key='main')

# Fork someone else's module
api.fork('other_user/module', key='main', comment='My fork')

# Delete a module
api.rm_mod('mymod', key='main')
```

## Registry

The registry maps users to their modules:

```python
# Full registry: {user_address: {mod_name: cid}}
api.registry()

# List all users
api.users()

# Get user info
api.user(key='0xABC...')

# Get CID for a module
api.cid('mymod', key='main')
```

## IPFS Operations

```python
# Direct IPFS put/get through the API
cid = api.put({'any': 'data'})
data = api.get(cid)

# Root CID (encrypted index of all your modules)
api.root(encrypt=True)
api.get_root(decrypt=True)
```

## Blockchain Operations

The API server integrates with the BlocTime Protocol smart contracts.

### Balances

```python
# Check token balance
api.balance(address='0x...', token='USDC')

# Get all holder balances
api.balances(token='NativeToken')

# Scan blockchain for token holders
api.scan_holders(token='NativeToken', weeks=4)
```

### Market Credits

```python
# Buy market credits (deposit tokens, receive Market tokens)
api.credit(stable_amount=100, payment_token='USDC')
```

### On-Chain Module Registry

```python
# Register module on-chain (Base Sepolia)
api.register('mymod')
```

### Transaction Building

```python
# Build an unsigned transaction
tx = api.build_transaction(
    to='0xContractAddress',
    data='0xEncodedCalldata',
    value=0,
    gas=100000
)

# Encode a contract function call
calldata = api.encode_function_call(
    contract='Market',
    function='credit',
    args=['0xTokenAddress', 1000000, 2000000]
)
```

## AI-Powered Editing

```python
# Use AI to edit a module
api.edit(
    query="Add error handling to the forward function",
    mod='mymod',
    key='main',
    steps=5
)
```

## Configuration

The API server initializes with:

```python
api = Api(
    key='main',           # Default signing key
    store='ipfs',         # Storage backend
    auth='auth.base',     # Authentication module
)
```

Default port: `8000`
Storage path: `~/.mod/api/`
