# Config.json Quick Reference

Quick guide for config.json management and commune registration.

## TL;DR

```python
from claude import Mod

c = Mod()                    # Auto-creates config.json with URLs
c.show_config()              # View config + CID
cid = c.get_config_cid()     # Get CID for commune

# For production:
cid = c.update_config_urls(
    app_url="https://...",
    api_url="https://..."
)
# Register: commune.register_module('claude', cid, key)
```

## Config Structure

```json
{
  "name": "claude",
  "version": "1.0.0",
  "urls": {
    "app": "http://localhost:8821",  // Next.js frontend
    "api": "http://localhost:8820"   // Rust backend
  },
  "fns": [...],        // Available functions
  "endpoints": {...}   // REST API routes
}
```

## Common Tasks

### View Config
```python
c.show_config()
```

### Get CID for Registration
```python
cid = c.get_config_cid()
print(f"Register: {cid}")
```

### Update URLs
```python
cid = c.update_config_urls(
    app_url="https://app.example.com",
    api_url="https://api.example.com"
)
```

### Register with Commune
```python
import mod as m
commune = m.mod('commune')()
commune.register_module(
    name='claude',
    cid=cid,
    key=m.key()
)
```

## Files

- `config.json` — Module config (auto-created)
- `~/.mod/claude/config_cid.json` — Stored CID

## URLs

**Defaults (localhost):**
- App: http://localhost:8821
- API: http://localhost:8820

**Production:**
Update with `c.update_config_urls()`

## CID Storage

CID saved to: `~/.mod/claude/config_cid.json`

```json
{
  "cid": "QmXXX...",
  "timestamp": 1234567890.123,
  "gateway": "https://ipfs.io/ipfs/QmXXX...",
  "urls": {...}
}
```

## IPFS

Requires IPFS module:
```bash
# Start IPFS daemon
ipfs daemon
```

Or:
```python
# Install IPFS module
# cd ~/mod/mod/orbit && git clone <ipfs-repo>
```

## Full Guide

See [COMMUNE_REGISTRATION.md](COMMUNE_REGISTRATION.md)
