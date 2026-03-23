# Commune On-Chain Registration

This guide explains how to register the Claude module with commune on-chain using IPFS content addressing.

## Overview

The `config.json` file contains all module metadata needed for on-chain registration:

- **Module identity**: name, version, description
- **Service URLs**: app frontend and API backend
- **Available functions**: All public methods exposed by the module
- **API endpoints**: REST API routes and their descriptions

This config is stored to **IPFS** and the resulting **CID (Content Identifier)** is used for on-chain registration, making the module:

- ✅ **Discoverable** — Other users can find your module on-chain
- ✅ **Accessible** — URLs point to your app and API
- ✅ **Verifiable** — IPFS CID ensures immutability
- ✅ **Updatable** — New deployments get new CIDs

## Config Structure

```json
{
  "name": "claude",
  "version": "1.0.0",
  "description": "Programmable AI developer interface...",
  "urls": {
    "app": "http://localhost:8821",
    "api": "http://localhost:8820"
  },
  "fns": [
    "forward",
    "ask",
    "analyze_code",
    "generate_code",
    "refactor",
    "debug",
    "edit_file",
    "run_task",
    "batch_process",
    "bg",
    "submit",
    "create_module",
    "fork_module"
  ],
  "endpoints": {
    "/health": "Health check",
    "/repos": "List git repositories",
    "/auth/challenge": "Get signature challenge",
    "/auth/verify": "Verify signature and get JWT",
    "/jobs": "Submit and list jobs",
    "/jobs/{id}": "Get job details",
    "/jobs/{id}/cancel": "Cancel running job",
    "/jobs/{id}/stream": "SSE stream of job output"
  }
}
```

## Automatic Creation

When `config.json` is missing, it's **automatically created** on first module initialization with default localhost URLs:

```python
from claude import Mod

# Initializes and creates config.json if needed
c = Mod()
```

This ensures the module **always** has URLs available for future reference and commune registration.

## View Current Config

```python
from claude import Mod

c = Mod()

# Display config and IPFS CID
c.show_config()
```

Output:
```
============================================================
CLAUDE MODULE CONFIGURATION
============================================================
{
  "name": "claude",
  "version": "1.0.0",
  "urls": {
    "app": "http://localhost:8821",
    "api": "http://localhost:8820"
  },
  ...
}
============================================================

IPFS CID: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Gateway:  https://ipfs.io/ipfs/QmXXXXXXXXXXXXXXXXXXXXXXXXXXXX

✓ Use this CID to register with commune on-chain
============================================================
```

## Update URLs for Production

When deploying to production, update the URLs and get a new IPFS CID:

```python
from claude import Mod

c = Mod()

# Update URLs and store to IPFS
cid = c.update_config_urls(
    app_url="https://claude.yourapp.com",
    api_url="https://api.yourapp.com"
)

print(f"New CID for registration: {cid}")
```

Output:
```
============================================================
CONFIG UPDATED
============================================================
App URL:  https://claude.yourapp.com
API URL:  https://api.yourapp.com
IPFS CID: QmYYYYYYYYYYYYYYYYYYYYYYYYYYYY
Gateway:  https://ipfs.io/ipfs/QmYYYYYYYYYYYYYYYYYYYYYYYYYYYY
============================================================

✓ Use this CID to register with commune on-chain
```

## Register with Commune

Once you have the IPFS CID, register your module on-chain:

```python
import mod as m

# Get the claude module
claude = m.mod('claude')()

# Get config CID
cid = claude.get_config_cid()

# Register with commune (example - actual API may vary)
commune = m.mod('commune')()
tx = commune.register_module(
    name='claude',
    cid=cid,
    key=m.key()  # Your wallet key
)

print(f"✓ Registered! Transaction: {tx}")
```

## How It Works

### 1. Config Creation
When no `config.json` exists:
- Module automatically creates it with default localhost URLs
- Stores it to IPFS (if IPFS is available)
- Saves the CID to `~/.mod/claude/config_cid.json`

### 2. URL Updates
When you call `update_config_urls()`:
- Updates URLs in `config.json`
- Re-stores to IPFS → new CID
- Saves new CID to `~/.mod/claude/config_cid.json`

### 3. CID Storage
The CID is stored locally at `~/.mod/claude/config_cid.json`:
```json
{
  "cid": "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "timestamp": 1234567890.123,
  "gateway": "https://ipfs.io/ipfs/QmXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "urls": {
    "app": "https://claude.yourapp.com",
    "api": "https://api.yourapp.com"
  }
}
```

### 4. On-Chain Registration
The CID points to the immutable config on IPFS, which contains:
- Module metadata
- Service URLs (app + API)
- Available functions
- API endpoints

This makes your module **discoverable and accessible** through the commune network.

## API Reference

### `show_config()`
Display current config and IPFS CID.

```python
c.show_config()
```

### `get_config_cid()`
Get the current IPFS CID for commune registration.

```python
cid = c.get_config_cid()
# Returns: "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXX" or None
```

### `update_config_urls(app_url, api_url)`
Update URLs and get new IPFS CID.

```python
cid = c.update_config_urls(
    app_url="https://claude.yourapp.com",
    api_url="https://api.yourapp.com"
)
# Returns: new CID string
```

## Example Workflow

**Local Development:**
```bash
# Start services (uses localhost URLs)
./scripts/start.sh

# Config is auto-created with:
# - app: http://localhost:8821
# - api: http://localhost:8820
```

**Production Deployment:**
```python
from claude import Mod

c = Mod()

# Update to production URLs
cid = c.update_config_urls(
    app_url="https://claude.mycompany.com",
    api_url="https://api.claude.mycompany.com"
)

# Register with commune
import mod as m
commune = m.mod('commune')()
commune.register_module(name='claude', cid=cid, key=m.key())
```

**Update Deployment:**
```python
# Deploy new version, get new CID
cid = c.update_config_urls(
    app_url="https://v2.claude.mycompany.com",
    api_url="https://api-v2.claude.mycompany.com"
)

# Update on-chain registration
commune.update_module(name='claude', cid=cid, key=m.key())
```

## Benefits

### Content Addressing
The IPFS CID ensures the config is:
- **Immutable** — Can't be changed without changing the CID
- **Verifiable** — Anyone can retrieve and verify the config
- **Permanent** — Stored on IPFS distributed network

### On-Chain Discoverability
Users can discover your module through commune:
```python
# Find modules on commune
modules = commune.list_modules()

# Get module config by CID
config = ipfs.cat(modules['claude']['cid'])

# Connect to service
app_url = config['urls']['app']
api_url = config['urls']['api']
```

### Version Control
Each deployment gets a new CID:
- Track versions via CID history
- Rollback by reverting to previous CID
- A/B test by deploying multiple CIDs

## Troubleshooting

### Config not stored to IPFS

If you see:
```
⚠ Not yet stored to IPFS
  Run update_config_urls() to store to IPFS
```

Solution:
```python
# Explicitly update to trigger IPFS storage
cid = c.update_config_urls()  # Uses existing URLs
```

Or ensure IPFS is running:
```bash
# Start IPFS daemon
ipfs daemon
```

### No IPFS module available

Error:
```
IPFS module not available. Install with: m install ipfs
```

Solution:
```bash
# Install IPFS module
cd ~/mod/mod/orbit
git clone https://github.com/modprotocol/ipfs
# or: m install ipfs
```

## See Also

- [examples/commune_registration.py](examples/commune_registration.py) — Full example
- [IPFS Version History](README.md#ipfs-version-history) — Code change tracking
- [Architecture](ARCHITECTURE.md) — System design overview
