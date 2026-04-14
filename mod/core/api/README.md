# mod api

Core API module for the mod framework. Manages module registration, versioning, content storage, user accounts, and on-chain interactions.

## Architecture

```
Client (Next.js app / CLI)
    │
    ▼
  API (FastAPI, port 8000)
    ├── Auth (token-based, sr25519 key signing)
    ├── Store (content-addressed storage via localfs/IPFS)
    ├── Router (task execution, billing, IOU settlement)
    └── Chain (Base Sepolia contracts: Market, Registry, Token)
```

## Quick Start

```bash
# Run locally
m serve port=8000 key=api mod=api

# Run with Docker
docker-compose up -d
```

## Core Functions

### Modules

| Function | Description |
|----------|-------------|
| `mod(mod, key, schema, expand)` | Get module metadata by name and owner key |
| `mods(search, key, n, page)` | List/search all registered modules |
| `reg(mod, key, comment, public, token, name)` | Register or update a module (local, git URL, or CID) |
| `reg_payload(mod, key, comment)` | Generate registration payload for client-side signing |
| `schema(mod, key)` | Get a module's function schema |
| `content(mod, key, expand)` | Get module content (source files as CID map) |
| `files(mod, search)` | List files in a module |
| `versions(mod, key, n)` | Get version history for a module |
| `exists(mod, key)` | Check if a module exists |
| `new(name, base, key)` | Create a new module from a base template |
| `fork(mod, key)` | Fork a module under a different owner key |
| `edit(query, mod, key, steps)` | AI-assisted module editing |

### Users

| Function | Description |
|----------|-------------|
| `user(key, expand)` | Get user info (key, balance, modules) |
| `users(search)` | List all registered users |
| `user_keys()` | List all owner keys |

### Storage

| Function | Description |
|----------|-------------|
| `get(cid)` | Retrieve data by content identifier |
| `put(data)` | Store data, returns CID |
| `root(encrypt)` | Generate encrypted root CID of the full registry |

### Chain

| Function | Description |
|----------|-------------|
| `balance(address, token)` | Get token balance for an address |
| `balances(token, weeks)` | Get all holder balances for a token |
| `get_balances(address, tokens)` | Get multi-token balances for an address |
| `credit(stable_amount, payment_token)` | Buy stablecoins via Market contract |
| `call(fn, params)` | Route a function call through the task router |
| `txs(key, mod, n)` | Get transaction history |

### Auth

| Function | Description |
|----------|-------------|
| `token(update, max_age)` | Get or refresh an auth token |

## Registration Flow

```
1. reg("mymod")
   ├── add_content() → stores all source files → content CID
   ├── add_schema()  → extracts function signatures → schema CID
   ├── get_info()    → builds module metadata dict
   ├── reg_info()    → writes to registry.json (key → mod → CID)
   └── returns { name, key, cid, content, schema, created, updated }

2. reg("github.com/user/repo")
   └── reg_git() → clones repo → registers as above

3. reg("<cid>")
   └── reg_cid() → fetches from store → writes files → registers
```

## Registry Structure

```json
{
  "<owner_key>": {
    "<mod_name>": "<cid>"
  }
}
```

Each CID resolves to:
```json
{
  "name": "mymod",
  "key": "<owner_key>",
  "content": "<content_cid>",
  "schema": "<schema_cid>",
  "prev": "<previous_version_cid>",
  "created": 1711900000,
  "updated": 1711900000,
  "url": "<live_url_or_null>"
}
```

## Router (Task Execution)

The router handles authenticated function calls with billing:

```
call("chain/balance", {address: "0x..."}, token=<jwt>)
  → verify token → create task → execute fn → store result → bill cost
```

Tasks are persisted at `~/.mod/api/router/tasks/<key>/<fn>/<cid>.json` and include status tracking, timing, and IOU settlement via on-chain debit.

## Docker

```bash
docker build -t api .
docker-compose up -d
```

Exposes port 8000. Mounts `~/mod` and `~/.mod` for module access and persistent state.

## Config

`mod.json` defines the exposed functions and dependent modules. Environment config via `.env` (see `.env.example`).
