# Auto-Owner Setup

## Overview

The Claude module now supports **automatic owner assignment**. When no owner is configured, the **first person to authenticate** (sign in via MetaMask, SubWallet, or password) automatically becomes the owner.

## How It Works

### 1. **Initial State - No Owner**
- When the system starts with no owner configured (`~/.mod/claude/owner.json` doesn't exist)
- Any user can access read-only operations
- No one can perform edit operations (until owner is set)

### 2. **First User Authentication**
- User signs in via web UI (MetaMask, SubWallet, password, or local key)
- Backend checks if `owner.json` exists
- If no owner is set, the authenticating user's address is written to `owner.json`
- Server logs: `✓ First user authenticated - set as owner: 0x...`

### 3. **After Owner is Set**
- All subsequent users can still authenticate
- Only the owner can perform edit operations (code modifications, refactoring, etc.)
- Non-owners have read-only access

## Configuration Files

### Owner Config Location
```bash
~/.mod/claude/owner.json
```

### Owner Config Format
```json
{
  "owner": "0x1234567890abcdef1234567890abcdef12345678"
}
```

## API Endpoints

### Check Owner Status
```bash
GET /owner
```

**Response:**
```json
{
  "has_owner": true,
  "owner": "0x1234567890abcdef1234567890abcdef12345678",
  "message": "Owner is set"
}
```

Or when no owner exists:
```json
{
  "has_owner": false,
  "owner": null,
  "message": "No owner set - first authenticated user will become owner"
}
```

## Python Module Usage

### Check Current Owner
```python
import mod as m

c = m.mod('claude')()

# Get current owner
owner = c.get_owner()
print(f"Owner: {owner}")

# Check if you are the owner
if c.is_owner():
    print("You are the owner")
else:
    print("You are not the owner")
```

### Reload Owner After First Auth
```python
# If owner was just set via web UI, reload it
c.reload_owner()
```

### Manually Set Owner
```python
# Set specific address as owner
c.set_owner("0x1234567890abcdef1234567890abcdef12345678")

# Or use current key
c.set_owner(m.key().address)
```

## Testing

### Test Auto-Owner Setup

1. **Remove existing owner (if testing):**
   ```bash
   rm ~/.mod/claude/owner.json
   ```

2. **Start the server:**
   ```bash
   cd ~/mod/mod/orbit/claude/server
   cargo run
   ```

3. **Open web UI and authenticate:**
   - Navigate to `http://localhost:8820`
   - Click "Connect Wallet" and sign with MetaMask/SubWallet
   - Or use "Local Key" or "Password" authentication

4. **Verify owner was set:**
   ```bash
   cat ~/.mod/claude/owner.json
   ```

5. **Check server logs:**
   Look for: `✓ First user authenticated - set as owner: 0x...`

### Test Python Module

```python
import mod as m

c = m.mod('claude')()

# Test 1: Check owner
print(f"Owner: {c.get_owner()}")

# Test 2: Try edit operation (requires owner)
try:
    c.edit_file(
        file_path="test.py",
        instructions="Add a comment",
        key=m.key()  # Use your key
    )
    print("✓ Edit operation succeeded (you are owner)")
except PermissionError as e:
    print(f"✗ Edit operation failed: {e}")

# Test 3: Reload owner
new_owner = c.reload_owner()
print(f"Reloaded owner: {new_owner}")
```

## Security Model

### Permission Levels

1. **No Owner Set**
   - Read operations: ✓ Anyone
   - Edit operations: ✗ No one (until owner is set)

2. **Owner Set**
   - Read operations: ✓ Anyone authenticated
   - Edit operations: ✓ Only owner
   - Owner address stored in: `~/.mod/claude/owner.json`

### Edit Operations (Require Owner)
- `edit_file()` - Edit specific files
- `generate_code()` - Generate new code
- `refactor()` - Refactor existing code
- Any operation with keywords: edit, modify, change, update, refactor, fix, add, remove, delete

### Read Operations (Anyone)
- `ask()` - Ask AI questions
- `analyze_code()` - Analyze codebase
- `debug()` - Debug analysis
- View job history
- List repositories

## Web UI Integration

The web UI automatically:
- Checks owner status before authentication
- Detects when user becomes owner
- Logs ownership status to console
- Persists authentication in localStorage

## Troubleshooting

### Owner file is corrupted
```bash
# View current owner file
cat ~/.mod/claude/owner.json

# If corrupted, recreate it manually
echo '{"owner": "0xYOUR_ADDRESS_HERE"}' > ~/.mod/claude/owner.json
```

### Reset ownership
```bash
# Remove owner file (next auth will set new owner)
rm ~/.mod/claude/owner.json

# Then restart server and re-authenticate
```

### Check who is owner via API
```bash
curl http://localhost:8820/owner
```

### Permission denied errors
```python
# Make sure you're using the owner's key
c = m.mod('claude')(owner="0xYOUR_OWNER_ADDRESS")
c.edit_file(..., key=m.key())  # This key must match owner
```

## Implementation Details

### Backend (Rust)
- `server/src/auth.rs`: Auto-owner assignment during verification
- `server/src/api.rs`: `/owner` endpoint
- Owner file created at `~/.mod/claude/owner.json`

### Frontend (TypeScript)
- `app/src/app/page.tsx`: Owner status check in `signChallenge()`
- Logs ownership to console
- No UI notification (can be added if desired)

### Python Module
- `claude/claude.py`:
  - `_load_owner()` - Load from config
  - `set_owner()` - Set owner manually
  - `get_owner()` - Get current owner
  - `reload_owner()` - Reload from disk
  - `is_owner()` - Check if key is owner
  - `require_owner()` - Enforce owner permission

## Benefits

1. **Zero-configuration**: No manual setup needed
2. **Secure by default**: First user gets control
3. **Simple reset**: Just delete owner.json
4. **Multi-environment**: Each environment can have different owner
5. **Audit trail**: Owner address tracked on disk
6. **Flexible auth**: Works with any auth method (MetaMask, password, local key)

## Example Workflows

### Solo Developer
```bash
# Start fresh instance
rm ~/.mod/claude/owner.json
cargo run  # Start server

# Sign in via web UI → automatically become owner
# Now you can use edit operations from Python
```

### Team Environment
```bash
# Team lead authenticates first → becomes owner
# Other team members can authenticate but can't edit
# Owner can manually change ownership by editing owner.json
```

### CI/CD Pipeline
```python
# Set owner to CI system's key
c = m.mod('claude')()
c.set_owner(os.environ['CI_KEY_ADDRESS'])

# Now CI can perform automated edits
```
