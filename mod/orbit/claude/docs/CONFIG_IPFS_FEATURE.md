# Config.json IPFS Feature Implementation Summary

## Overview

Implemented automatic `config.json` creation with IPFS storage for commune on-chain registration. When no config.json exists, it's automatically created with app and API URLs, stored to IPFS, and the CID is saved for on-chain module registration.

## What Changed

### 1. Core Module (`claude/claude.py`)

Added three new methods to the `Mod` class:

#### `_ensure_config()` (Private)
- Called during `__init__`
- Creates `config.json` if missing with:
  - Module metadata (name, version, description)
  - Default URLs (localhost:8821 app, localhost:8820 api)
  - List of exposed functions
  - API endpoint documentation
- Stores config to IPFS automatically
- Saves CID to `~/.mod/claude/config_cid.json`

#### `get_config_cid()` (Public)
- Returns current IPFS CID for config.json
- Used for commune on-chain registration
- Returns `None` if not yet stored

#### `update_config_urls(app_url, api_url)` (Public)
- Updates app and API URLs in config.json
- Re-stores to IPFS → new CID
- Saves new CID to disk
- Returns new CID string
- Use for production deployments

#### `show_config()` (Public)
- Displays current config.json content
- Shows IPFS CID if available
- Pretty-printed for easy review

### 2. Default Config File (`config.json`)

Created at module root with:

```json
{
  "name": "claude",
  "version": "1.0.0",
  "description": "Programmable AI developer interface...",
  "urls": {
    "app": "http://localhost:8821",
    "api": "http://localhost:8820"
  },
  "fns": [...],
  "endpoints": {...}
}
```

**Key points:**
- Always created if missing
- URLs default to localhost for local dev
- Functions list all public methods
- Endpoints document REST API

### 3. Documentation

#### New Files
- `COMMUNE_REGISTRATION.md` — Complete guide
- `examples/commune_registration.py` — Working example
- `tests/test_config.py` — Test suite

#### Updated Files
- `README.md` — Added configuration section with commune registration

### 4. Tests

Created `tests/test_config.py` with:
- Config creation validation
- Structure verification (name, urls, fns, endpoints)
- Method testing (show_config, get_config_cid)
- Idempotence verification

**Status:** ✅ All tests passing

## Usage Examples

### Basic Usage (Auto-creates config)

```python
from claude import Mod

# Initialize — config.json created if missing
c = Mod()

# View config and CID
c.show_config()
```

### Production Deployment

```python
from claude import Mod

c = Mod()

# Update URLs for production
cid = c.update_config_urls(
    app_url="https://claude.mycompany.com",
    api_url="https://api.mycompany.com"
)

print(f"Register this CID with commune: {cid}")
```

### Commune Registration

```python
import mod as m

# Get config CID
claude = m.mod('claude')()
cid = claude.get_config_cid()

# Register on-chain
commune = m.mod('commune')()
commune.register_module(
    name='claude',
    cid=cid,
    key=m.key()
)
```

## File Structure

```
claude/
├── config.json                          # NEW — Module config with URLs
├── claude/claude.py                     # MODIFIED — Added config methods
├── examples/commune_registration.py     # NEW — Registration example
├── tests/test_config.py                 # NEW — Config tests
├── COMMUNE_REGISTRATION.md              # NEW — Complete guide
└── README.md                            # MODIFIED — Added config section
```

## CID Storage

CID is stored at `~/.mod/claude/config_cid.json`:

```json
{
  "cid": "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "timestamp": 1234567890.123,
  "gateway": "https://ipfs.io/ipfs/QmXXX...",
  "urls": {
    "app": "https://...",
    "api": "https://..."
  }
}
```

## Benefits

### 1. Always Available
- Config created automatically if missing
- No manual setup required
- Default URLs for local development

### 2. On-Chain Registration
- IPFS CID for immutable config
- Commune can discover and verify module
- URLs point to live services

### 3. Version Control
- Each deployment gets new CID
- Track config changes via CID history
- Rollback by reverting CID

### 4. Developer Experience
- Single command to update and store
- Pretty-printed output with CID
- Clear instructions for commune registration

## Technical Details

### Initialization Flow

1. User creates `Mod()` instance
2. `__init__` calls `_ensure_config()`
3. If `config.json` missing:
   - Create with default structure
   - Store to IPFS (if available)
   - Save CID to `~/.mod/claude/config_cid.json`
4. If exists: skip creation, load normally

### Update Flow

1. User calls `update_config_urls(app_url, api_url)`
2. Load existing config or create new
3. Update URLs in config
4. Write to `config.json`
5. Store to IPFS → get new CID
6. Save CID to `~/.mod/claude/config_cid.json`
7. Return CID to user

### IPFS Integration

Uses existing `m.mod('ipfs')()` integration:
- `ipfs.put(config)` → stores JSON, returns CID
- `ipfs.cat(cid)` → retrieves JSON by CID
- Graceful fallback if IPFS unavailable

## Breaking Changes

**None.** This is purely additive:
- New methods don't affect existing functionality
- Config creation is automatic and transparent
- Existing code continues to work unchanged

## Dependencies

- **IPFS module** — Optional for CID storage
  - If missing: config created locally
  - Warning logged, continues without error

## Future Enhancements

Potential additions:
- **Auto-registration** — Register with commune on URL update
- **CID history** — Track all previous config CIDs
- **Multi-network** — Different URLs per network (mainnet, testnet)
- **Config validation** — JSON schema enforcement
- **Registry integration** — Direct commune module registry updates

## Testing

Run tests:
```bash
python3 tests/test_config.py
```

All tests pass:
- ✅ Config creation
- ✅ Structure validation
- ✅ Method accessibility
- ✅ Idempotence

## Example Output

```
============================================================
CONFIG UPDATED
============================================================
App URL:  https://claude.yourapp.com
API URL:  https://api.yourapp.com
IPFS CID: QmYYYYYYYYYYYYYYYYYYYYYYYYYYYY
Gateway:  https://ipfs.io/ipfs/QmYYY...
============================================================

✓ Use this CID to register with commune on-chain
```

## Backwards Compatibility

✅ **Fully backwards compatible**

- Existing code unchanged
- New methods are optional
- Config auto-created transparently
- No breaking changes to API

## Summary

Implemented comprehensive config.json + IPFS feature for commune registration:

1. ✅ Auto-creates config.json with URLs
2. ✅ Stores to IPFS → CID
3. ✅ Update URLs → new CID
4. ✅ Show current config + CID
5. ✅ Full documentation + examples
6. ✅ Test coverage
7. ✅ README updates

**Ready for commune on-chain registration! 🚀**
