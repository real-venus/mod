# Quick Start: Owner Protection & IPFS Storage

## 30-Second Setup

```python
import mod as m

# Initialize and protect
c = m.mod('claude')()
c.set_owner(m.key())  # Only you can edit

# Make changes (auto-stored to IPFS)
c.edit_file('main.py', 'Add error handling')

# View history
c.show_history()
```

Done! ✓

## Key Concepts

### Owner = Can Edit
```python
c.set_owner(m.key())  # You are owner
c.edit_file('app.py', 'Add feature')  # ✓ Works
```

### Non-Owner = Read Only
```python
other_key = m.key('someone-else')
c.edit_file('app.py', 'Delete code', key=other_key)  # ✗ PermissionError
c.analyze_code('/project')  # ✓ Works (read-only)
```

### Every Edit → IPFS
```python
c.edit_file('utils.py', 'Add helpers')
# Outputs:
# IPFS STORAGE
# CID: QmXxx...
# Gateway: https://ipfs.io/ipfs/QmXxx...
```

## Common Commands

```python
# Setup
c.set_owner(m.key())           # Protect with your key
c.get_owner()                   # Check who owns

# Permission checks
c.is_owner(key)                 # Check if key is owner
c.require_owner(key, "edit")    # Raise error if not owner

# History
c.show_history(limit=10)        # Show last 10 changes
c.get_history()                 # Get as list
c.get_latest_cid()              # Get most recent CID

# Edit operations (require owner)
c.edit_file(file, instructions, key=owner)
c.refactor(path, instructions, key=owner)
c.generate_code(desc, path, key=owner)

# All accept:
#   key         - Who is making the change
#   store_ipfs  - Store to IPFS (default: True)
#   description - Custom description for history
```

## Files & Locations

```bash
~/.mod/claude/owner.json        # Owner configuration
~/.mod/claude/cid_history.json  # IPFS CID history
```

## Reset / Troubleshooting

```python
# Remove owner (disable protection)
import os
os.remove(os.path.expanduser('~/.mod/claude/owner.json'))

# Clear history
os.remove(os.path.expanduser('~/.mod/claude/cid_history.json'))

# Check IPFS
ipfs = m.mod('ipfs')()
print(ipfs.node_status())
```

## Examples

### Protect Your Code
```python
c = m.mod('claude')()
c.set_owner(m.key())  # Only you can edit
```

### Track All Changes
```python
c.edit_file('main.py', 'Fix bug')
c.refactor('/project', 'Optimize')
c.show_history()  # See all changes with CIDs
```

### Share via IPFS
```python
c.edit_file('utils.py', 'Add feature')
cid = c.get_latest_cid()
print(f"Share: https://ipfs.io/ipfs/{cid}")
```

### Audit Trail
```python
history = c.get_history()
for entry in history:
    print(f"{entry['date']}: {entry['description']} - {entry['cid']}")
```

## Need More?

- Full docs: `PERMISSIONS_AND_IPFS.md`
- Examples: `EXAMPLE_USAGE.md`
- Tests: `tests/test_claude.py`
