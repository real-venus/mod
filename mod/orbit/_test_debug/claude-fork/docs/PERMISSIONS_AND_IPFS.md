# Owner Permissions & IPFS Storage

This document explains the owner-based access control and IPFS storage features in the Claude module.

## Overview

The Claude module now includes:
1. **Owner-based access control** - Only the owner can perform edit operations
2. **Automatic IPFS storage** - Code updates are automatically stored to IPFS
3. **CID history tracking** - Track all IPFS CIDs with timestamps and descriptions

## Owner Permissions

### Setting an Owner

```python
import mod as m

# Initialize Claude module
c = m.mod('claude')()

# Set owner (only this address can edit code)
c.set_owner('0x1234...abcd')  # Your Ethereum address

# Or use a key object
key = m.key('mykey')
c.set_owner(key)
```

### How It Works

- **Owner can**: Edit, refactor, generate code, and all other operations
- **Non-owners can**: Read code, analyze, ask questions (read-only operations)
- **No owner set**: Everyone has full access (backward compatible)

### Protected Operations

Edit operations require owner permission:
- `edit_file()` - Edit specific files
- `refactor()` - Refactor code
- `generate_code()` - Generate new code
- `forward()` - Any query with edit keywords (edit, modify, change, update, fix, add, remove, delete)

### Permission Errors

If a non-owner tries to edit:

```python
# This will raise PermissionError
c.edit_file('main.py', 'Fix the bug', key=non_owner_key)

# Error message shows:
# Access denied: code editing requires owner permission.
# Current key: 0xabcd...
# Owner: 0x1234...
```

### Check Permissions

```python
# Check if a key is the owner
c.is_owner(key)  # Returns True/False

# Get current owner
c.get_owner()  # Returns owner address or None

# Require owner (raises error if not)
c.require_owner(key, operation="editing")
```

## IPFS Storage

### Automatic Storage

Edit operations are automatically stored to IPFS when `store_ipfs=True` (default):

```python
# Edit a file - automatically stores to IPFS
result = c.edit_file(
    'main.py',
    'Add error handling',
    store_ipfs=True  # Default
)

# Output shows:
# IPFS STORAGE
# CID: QmXxx...
# Gateway: https://ipfs.io/ipfs/QmXxx...
```

### Manual IPFS Storage

```python
# Use forward() with store_ipfs flag
result = c.forward(
    query="Refactor the auth module",
    path="/path/to/project",
    store_ipfs=True,
    description="Refactor auth for better security"
)
```

### What Gets Stored

Each IPFS entry contains:
```json
{
  "query": "Edit the file main.py: Add error handling",
  "result": { ... },  // Claude's output
  "work_dir": "/path/to/project",
  "model": "sonnet",
  "description": "Add error handling"
}
```

## CID History

### View History

```python
# Show last 10 entries
c.show_history()

# Show last 20 entries
c.show_history(limit=20)

# Output:
# IPFS CID HISTORY (showing 10 most recent)
#
# 1. 2026-03-22 14:30:45
#    CID: QmXxx...
#    Description: Edit main.py: Add error handling
#    View: https://ipfs.io/ipfs/QmXxx...
```

### Get History Programmatically

```python
# Get history as list of dicts
history = c.get_history(limit=10)

for entry in history:
    print(f"CID: {entry['cid']}")
    print(f"Date: {entry['date']}")
    print(f"Description: {entry['description']}")
```

### Get Latest CID

```python
# Get most recent CID
latest_cid = c.get_latest_cid()
print(f"Latest: {latest_cid}")
```

### History Location

CID history is stored at: `~/.mod/claude/cid_history.json`

Each entry contains:
```json
{
  "cid": "QmXxx...",
  "timestamp": 1711118445.0,
  "date": "2026-03-22 14:30:45",
  "description": "Edit main.py: Add error handling"
}
```

## Example Workflows

### Workflow 1: Secure Single Owner

```python
import mod as m

# Setup
c = m.mod('claude')()
owner_key = m.key('owner')
c.set_owner(owner_key)

# Owner can edit
result = c.edit_file(
    'app.py',
    'Add login feature',
    key=owner_key
)

# Non-owner cannot edit
user_key = m.key('user')
try:
    c.edit_file('app.py', 'Delete everything', key=user_key)
except PermissionError as e:
    print(f"Blocked: {e}")

# View what was done
c.show_history(limit=5)
```

### Workflow 2: Track All Changes

```python
# Every edit is tracked
c.refactor(
    '/path/to/project',
    'Optimize database queries',
    store_ipfs=True
)

c.edit_file(
    'models.py',
    'Add User model',
    store_ipfs=True
)

c.generate_code(
    'Create authentication middleware',
    '/path/to/project',
    'middleware/auth.py',
    store_ipfs=True
)

# View complete audit trail
c.show_history(limit=20)

# Share specific version
latest = c.get_latest_cid()
print(f"Share this version: https://ipfs.io/ipfs/{latest}")
```

### Workflow 3: Portable Code with IPFS

```python
# Make changes
c.edit_file('utils.py', 'Add helper functions')

# Get CID to take with you
cid = c.get_latest_cid()
print(f"Your code is at: {cid}")

# Later, on another machine:
ipfs = m.mod('ipfs')()
code_data = ipfs.get(cid)
print(code_data['query'])
print(code_data['result'])
```

## Configuration Files

### Owner Config
Location: `~/.mod/claude/owner.json`

```json
{
  "owner": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### CID History
Location: `~/.mod/claude/cid_history.json`

```json
[
  {
    "cid": "QmXxx...",
    "timestamp": 1711118445.0,
    "date": "2026-03-22 14:30:45",
    "description": "Edit main.py: Add error handling"
  }
]
```

## API Reference

### Owner Methods

- `set_owner(owner)` - Set the owner address
- `get_owner()` - Get current owner address
- `is_owner(key)` - Check if key is owner
- `require_owner(key, operation)` - Require owner permission or raise error

### IPFS Methods

- `ipfs()` - Get IPFS client instance
- `get_history(limit)` - Get CID history
- `show_history(limit)` - Display CID history
- `get_latest_cid()` - Get most recent CID

### Updated Edit Methods

All editing methods now support:
- `key` - Key for permission check
- `store_ipfs` - Store to IPFS (default: True)
- `description` - Custom description for history

Methods:
- `edit_file(file_path, instructions, key, store_ipfs, ...)`
- `refactor(path, instructions, key, store_ipfs, ...)`
- `generate_code(description, path, key, store_ipfs, ...)`
- `forward(query, key, store_ipfs, description, ...)`

## Security Notes

1. **Owner address is public** - Stored in `~/.mod/claude/owner.json`
2. **IPFS data is public** - Anyone with CID can view the data
3. **Keys are not stored in IPFS** - Only addresses are tracked
4. **Permission checks are local** - Based on local owner config

## Troubleshooting

### IPFS Not Working

```python
# Check IPFS is installed
ipfs = m.mod('ipfs')()
print(ipfs.version())

# Ensure IPFS daemon is running
ipfs.ensure_ipfs_running()
```

### Permission Denied Errors

```python
# Check who is owner
print(f"Owner: {c.get_owner()}")

# Check your current key
key = m.key()
print(f"Your address: {key.address}")
print(f"Is owner: {c.is_owner(key)}")
```

### Clear Owner (Reset)

```python
import os
config_path = os.path.expanduser('~/.mod/claude/owner.json')
os.remove(config_path)
# Now everyone has access again
```

## Migration

If you have existing Claude code, the new features are **backward compatible**:

- No owner set = everyone can edit (same as before)
- `store_ipfs` defaults to `False` for `forward()` to avoid breaking changes
- Only `edit_file()`, `refactor()`, and `generate_code()` default to `store_ipfs=True`

To opt-in to full protection:

```python
c = m.mod('claude')()
c.set_owner(m.key())  # Restrict to your key
# Now you're protected!
```
