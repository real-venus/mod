# Claude Module - Example Usage

## Quick Start with Owner Protection

```python
import mod as m

# Initialize Claude module
c = m.mod('claude')()

# Set yourself as owner (only you can edit)
c.set_owner(m.key())

print(f"Owner: {c.get_owner()}")
```

## Example 1: Protected Edit with IPFS Storage

```python
import mod as m

c = m.mod('claude')()
owner_key = m.key('mykey')

# Set owner
c.set_owner(owner_key)

# Owner can edit (automatically stored to IPFS)
result = c.edit_file(
    file_path='main.py',
    instructions='Add error handling to the parse_config function',
    path='/path/to/project',
    key=owner_key,
    store_ipfs=True  # Default
)

# Output shows:
# IPFS STORAGE
# CID: QmXxx...
# Gateway: https://ipfs.io/ipfs/QmXxx...

# View history
c.show_history(limit=5)
```

## Example 2: Multiple Users with Access Control

```python
import mod as m

# Setup
c = m.mod('claude')()
owner = m.key('owner')
user1 = m.key('user1')
user2 = m.key('user2')

# Owner sets themselves
c.set_owner(owner)

# Owner can edit
c.edit_file('app.py', 'Add login feature', key=owner)
# ✓ Success

# User1 tries to edit
try:
    c.edit_file('app.py', 'Delete everything', key=user1)
except PermissionError as e:
    print(f"Blocked: {e}")
    # Access denied: code editing requires owner permission.

# User2 can still read/analyze (no edit)
result = c.analyze_code(
    path='/path/to/project',
    focus='security'
)
# ✓ Success (read-only operations allowed)
```

## Example 3: IPFS History Tracking

```python
import mod as m

c = m.mod('claude')()
c.set_owner(m.key())

# Make several changes
c.edit_file('models.py', 'Add User model')
c.edit_file('views.py', 'Add authentication')
c.refactor('/path/to/project', 'Optimize database queries')

# View complete history
c.show_history(limit=20)

# Output:
# IPFS CID HISTORY (showing 3 most recent)
#
# 1. 2026-03-22 14:30:45
#    CID: QmXxx...
#    Description: Refactor: Optimize database queries
#    View: https://ipfs.io/ipfs/QmXxx...
#
# 2. 2026-03-22 14:28:30
#    CID: QmYyy...
#    Description: Edit views.py: Add authentication
#    View: https://ipfs.io/ipfs/QmYyy...
#
# 3. 2026-03-22 14:25:15
#    CID: QmZzz...
#    Description: Edit models.py: Add User model
#    View: https://ipfs.io/ipfs/QmZzz...

# Get latest CID programmatically
latest = c.get_latest_cid()
print(f"Latest: {latest}")

# Get history as data
history = c.get_history(limit=10)
for entry in history:
    print(f"{entry['date']}: {entry['cid']}")
```

## Example 4: Portable Code with IPFS

```python
import mod as m

# On Machine A: Make changes and store to IPFS
c = m.mod('claude')()
c.set_owner(m.key())

c.edit_file(
    'utils.py',
    'Add helper functions for data processing',
    store_ipfs=True
)

# Get CID to share
cid = c.get_latest_cid()
print(f"Share this: {cid}")
# Output: QmXxx...

# Copy this CID!

# On Machine B: Retrieve the code
ipfs = m.mod('ipfs')()
code_data = ipfs.get('QmXxx...')  # Use the CID from above

print(code_data['query'])        # What was done
print(code_data['description'])  # Description
print(code_data['result'])       # Claude's result
print(code_data['work_dir'])     # Where it was done
```

## Example 5: Custom Descriptions for History

```python
import mod as m

c = m.mod('claude')()
c.set_owner(m.key())

# Use custom descriptions for better tracking
c.forward(
    query="Refactor authentication to use JWT tokens",
    path='/path/to/project',
    store_ipfs=True,
    description="Migration: Basic auth -> JWT tokens (v2.0)"
)

c.forward(
    query="Add rate limiting middleware",
    path='/path/to/project',
    store_ipfs=True,
    description="Security: Add rate limiting (fixes #123)"
)

# History shows custom descriptions
c.show_history()
# 1. 2026-03-22 14:35:00
#    CID: QmXxx...
#    Description: Security: Add rate limiting (fixes #123)
```

## Example 6: Team Workflow

```python
import mod as m

# Team lead sets up protection
c = m.mod('claude')()
lead_key = m.key('team-lead')
c.set_owner(lead_key)

# Team lead makes approved changes
c.edit_file(
    'config.py',
    'Update production database settings',
    key=lead_key,
    description="PROD: Update DB config for new cluster"
)

# Share the CID with team
cid = c.get_latest_cid()
print(f"Review changes at: https://ipfs.io/ipfs/{cid}")

# Team members can view but not edit
dev_key = m.key('developer')

# ✓ Can analyze
c.analyze_code(path='/project', focus='performance')

# ✗ Cannot edit
try:
    c.edit_file('config.py', 'Change settings', key=dev_key)
except PermissionError:
    print("Only team lead can make changes")
```

## Example 7: Audit Trail

```python
import mod as m

c = m.mod('claude')()
c.set_owner(m.key())

# Make changes over time
c.edit_file('api.py', 'Add v2 endpoints')
c.edit_file('models.py', 'Update schema')
c.refactor('/project', 'Clean up imports')

# Export audit trail
history = c.get_history()

print("Audit Trail:")
print("=" * 80)
for i, entry in enumerate(history, 1):
    print(f"{i}. {entry['date']}")
    print(f"   Action: {entry['description']}")
    print(f"   CID: {entry['cid']}")
    print(f"   Verify: https://ipfs.io/ipfs/{entry['cid']}")
    print()

# Save audit to file
import json
with open('audit_trail.json', 'w') as f:
    json.dump(history, f, indent=2)
```

## Example 8: No Owner Mode (Backward Compatible)

```python
import mod as m

# If you don't set an owner, everyone has access (like before)
c = m.mod('claude')()

# Anyone can edit
c.edit_file('test.py', 'Fix bug')  # ✓ Works

# To enable protection later:
c.set_owner(m.key())

# Now protected
```

## Example 9: Advanced - Custom IPFS Storage

```python
import mod as m

c = m.mod('claude')()
c.set_owner(m.key())

# Control when to store to IPFS
result = c.forward(
    query="Analyze this code for bugs",
    path='/project',
    store_ipfs=False  # Don't store analysis (not an edit)
)

# Only store important edits
result = c.forward(
    query="Fix critical security vulnerability in auth.py",
    path='/project',
    store_ipfs=True,  # Store this!
    description="SECURITY FIX: Auth bypass vulnerability (CVE-2026-XXX)"
)
```

## Example 10: Check Permissions Before Operation

```python
import mod as m

c = m.mod('claude')()
c.set_owner('0x1234...')

user_key = m.key('user')

# Check before attempting
if c.is_owner(user_key):
    print("You can make changes")
    c.edit_file('app.py', 'Update feature')
else:
    print("You can only view code")
    c.analyze_code('/project')

# Or get current owner
owner = c.get_owner()
print(f"Owner is: {owner}")
```

## Common Patterns

### Pattern 1: Single Developer Protection
```python
c = m.mod('claude')()
c.set_owner(m.key())  # Only you can edit
```

### Pattern 2: Read-Only for Others
```python
# Owner
c.edit_file('main.py', 'Add feature', key=owner_key)

# Others
c.analyze_code('/project')  # ✓ Allowed
c.ask("Explain this code")  # ✓ Allowed
```

### Pattern 3: Full Audit Trail
```python
# Enable IPFS for all edits
c.edit_file(..., store_ipfs=True)
c.refactor(..., store_ipfs=True)
c.generate_code(..., store_ipfs=True)

# Review anytime
c.show_history()
```

### Pattern 4: Share Code via IPFS
```python
# Make changes
c.edit_file('utils.py', 'Add helpers')

# Get shareable CID
cid = c.get_latest_cid()

# Share with others
print(f"Code: ipfs://{cid}")
print(f"View: https://ipfs.io/ipfs/{cid}")
```

## Troubleshooting

### Error: IPFS module not available
```python
# Install IPFS module first
import mod as m
m.install('ipfs')

# Or check if IPFS daemon is running
ipfs = m.mod('ipfs')()
print(ipfs.node_status())
```

### Error: Permission denied
```python
# Check who is owner
c = m.mod('claude')()
print(f"Owner: {c.get_owner()}")
print(f"Your key: {m.key().address}")
print(f"Is owner: {c.is_owner()}")

# If you're locked out, reset owner:
import os
os.remove(os.path.expanduser('~/.mod/claude/owner.json'))
```

### Clear History
```python
import os
history_path = os.path.expanduser('~/.mod/claude/cid_history.json')
os.remove(history_path)
```
