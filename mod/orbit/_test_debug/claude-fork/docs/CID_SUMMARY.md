# 📦 IPFS CID Summary - Take This With You!

## Quick Copy-Paste Examples

### Setup (Do This First)
```python
import mod as m

# Initialize and protect
c = m.mod('claude')()
c.set_owner(m.key())  # Only you can edit

print(f"Owner: {c.get_owner()}")
```

### Make Protected Changes (Auto-Stores to IPFS)
```python
# Edit a file
c.edit_file('main.py', 'Add error handling')

# Refactor code
c.refactor('/path/to/project', 'Optimize database queries')

# Generate new code
c.generate_code('Add user authentication', '/path/to/project', 'auth.py')

# Each shows:
# IPFS STORAGE
# CID: QmXxx...
# Gateway: https://ipfs.io/ipfs/QmXxx...
```

### View Your IPFS History
```python
# Show last 10 changes
c.show_history()

# Show last 20
c.show_history(limit=20)

# Get latest CID
cid = c.get_latest_cid()
print(f"Latest: {cid}")

# Get history as data
history = c.get_history()
for entry in history:
    print(f"{entry['date']}: {entry['cid']}")
```

### Share Code via IPFS CID
```python
# Make changes
c.edit_file('utils.py', 'Add new features')

# Get CID to share
cid = c.get_latest_cid()

# Share these:
print(f"IPFS: ipfs://{cid}")
print(f"Gateway: https://ipfs.io/ipfs/{cid}")
print(f"Dweb: https://dweb.link/ipfs/{cid}")

# On another machine, retrieve:
ipfs = m.mod('ipfs')()
code_data = ipfs.get(cid)
```

## What Gets Stored to IPFS

Every edit operation stores:
```json
{
  "query": "Edit main.py: Add error handling",
  "result": { ... },  // Claude's response
  "work_dir": "/path/to/project",
  "model": "sonnet",
  "description": "Add error handling"
}
```

## Where Files Are Stored

```bash
~/.mod/claude/owner.json         # Owner config
~/.mod/claude/cid_history.json   # IPFS CID history
```

## Permission Rules

| User | Can Edit | Can Read/Analyze |
|------|----------|------------------|
| Owner | ✅ Yes | ✅ Yes |
| Non-Owner | ❌ No | ✅ Yes |
| No Owner Set | ✅ Yes (everyone) | ✅ Yes |

## Quick Commands Cheat Sheet

```python
# Setup
c.set_owner(m.key())              # Set yourself as owner
c.get_owner()                      # Check who owns
c.is_owner(key)                    # Check if key is owner

# Edit (auto-stores to IPFS)
c.edit_file(file, instructions, key=owner)
c.refactor(path, instructions, key=owner)
c.generate_code(desc, path, file, key=owner)

# History
c.show_history(limit=10)           # Display history
c.get_history(limit=10)            # Get as data
c.get_latest_cid()                 # Get most recent CID

# Control IPFS storage
c.forward(query, store_ipfs=True)  # Force store
c.forward(query, store_ipfs=False) # Skip storage
```

## Example Session to Copy

```python
#!/usr/bin/env python3
import mod as m

# Setup
c = m.mod('claude')()
c.set_owner(m.key())

# Make changes (all auto-stored to IPFS)
c.edit_file('app.py', 'Add login feature')
c.edit_file('models.py', 'Add User model')
c.refactor('/project', 'Optimize queries')

# View what you did
c.show_history()

# Get shareable CID
cid = c.get_latest_cid()
print(f"\nShare this: https://ipfs.io/ipfs/{cid}")

# Save history to file
import json
history = c.get_history()
with open('audit_trail.json', 'w') as f:
    json.dump(history, f, indent=2)
print("\nAudit trail saved to: audit_trail.json")
```

## Troubleshooting

### IPFS Not Working
```python
# Check IPFS module
ipfs = m.mod('ipfs')()
print(ipfs.node_status())

# Ensure daemon is running
ipfs.ensure_ipfs_running()
```

### Permission Denied
```python
# Check owner
print(f"Owner: {c.get_owner()}")
print(f"Your key: {m.key().address}")
print(f"Is owner: {c.is_owner()}")
```

### Reset Owner (Unlock)
```python
import os
os.remove(os.path.expanduser('~/.mod/claude/owner.json'))
# Now everyone can edit again
```

### Clear History
```python
import os
os.remove(os.path.expanduser('~/.mod/claude/cid_history.json'))
```

## IPFS Gateway Links

Your CID can be accessed via:
- `ipfs://{cid}` - IPFS protocol
- `https://ipfs.io/ipfs/{cid}` - IPFS.io gateway
- `https://dweb.link/ipfs/{cid}` - Dweb.link gateway
- `https://cloudflare-ipfs.com/ipfs/{cid}` - Cloudflare gateway

## Share This Implementation

```python
# To share this entire feature implementation:
import mod as m

api = m.mod('api')()
cid = api.reg('claude', key=m.key())
print(f"Claude module with security: ipfs://{cid}")
```

## Files to Take With You

1. **QUICKSTART_SECURITY.md** - Quick start guide
2. **PERMISSIONS_AND_IPFS.md** - Complete documentation
3. **EXAMPLE_USAGE.md** - 10 practical examples
4. **CID_SUMMARY.md** (this file) - Quick reference
5. **demo.py** - Working demo script

## Run the Demo

```bash
cd ~/mod/mod/orbit/claude
python3 demo.py
```

## Full Documentation Locations

```bash
~/mod/mod/orbit/claude/
├── QUICKSTART_SECURITY.md          # Start here
├── PERMISSIONS_AND_IPFS.md         # Full docs
├── EXAMPLE_USAGE.md                # Examples
├── CID_SUMMARY.md                  # This file
├── FEATURE_IMPLEMENTATION_SUMMARY.md # Technical details
├── demo.py                         # Demo script
└── tests/test_claude.py            # Tests
```

## One-Liner Install & Protect

```python
import mod as m; c = m.mod('claude')(); c.set_owner(m.key()); c.show_history()
```

---

**Remember**: Every edit operation is automatically stored to IPFS with a CID.
Your code is now portable, auditable, and protected! 🔒📦

Copy this CID to access this summary anytime, anywhere! ✨
