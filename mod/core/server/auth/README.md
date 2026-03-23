# MOD Authentication & Permission System

This directory contains the authentication and permission management system for the MOD framework.

## Structure

```
auth/
├── auth/
│   ├── __init__.py           # Module exports
│   ├── auth.py               # Core authentication (token generation/verification)
│   ├── permissions.py        # Permission management and access control
│   ├── middleware.py         # Combined auth+permissions middleware
│   ├── config.py            # Configuration management
│   ├── jwt/                 # JWT-specific implementations
│   └── oath/                # OATH-based authentication
├── test/
│   ├── test_auth.py         # Authentication tests
│   ├── test_permissions.py  # Permission system tests
│   └── ...
├── PERMISSIONS.md           # Comprehensive permission system documentation
└── README.md                # This file
```

## Quick Start

### 1. Setup Owner Address

```bash
cd /Users/broski/mod
python scripts/setup_permissions.py
```

Or in Python:

```python
from mod.core.server.auth.auth import AuthConfig

config = AuthConfig()
config.set_owner_address("0x7f46ae9b5a5e25110900a418376e021454c90f4a")
```

### 2. Use in Your Code

```python
from mod.core.server.auth.auth import (
    Auth,
    PermissionManager,
    AccessControl
)

# Authentication
auth = Auth(key='my_private_key')
token = auth.token(data={'action': 'test'})

# Verify token
verified = auth.verify(token)
user_address = verified['key']

# Check permissions
pm = PermissionManager()
can_access = pm.can_access(user_address, '/path/to/module', 'execute')
```

## Components

### 1. Authentication (`auth.py`)

Handles cryptographic token generation and verification:
- Supports multiple crypto types: ECDSA, SR25519, Solana, Ed25519
- Token expiration (default: 1 hour)
- Signature-based verification

### 2. Permissions (`permissions.py`)

Access control for modules:
- Owner has root access to all modules
- Users can only access `mod/orbit/_outer/{their_address}/{module}`
- Three operation types: read, write, execute

### 3. Middleware (`middleware.py`)

Combines authentication and permissions:
- Decorators for protecting functions
- AccessControl helper for API endpoints
- Combined verify and check access

### 4. Configuration (`config.py`)

Manages system configuration:
- Owner address
- Token expiration settings
- Strict mode
- Interactive setup

## Permission Model

```
mod/
└── orbit/
    └── _outer/
        ├── {owner_address}/          ← Owner has full access
        │   ├── module1/
        │   └── module2/
        ├── {user1_address}/          ← User1 can only access this
        │   ├── module3/
        │   └── module4/
        └── {user2_address}/          ← User2 can only access this
            └── module5/
```

### Access Rules

| User Type | Access Level | Scope |
|-----------|-------------|-------|
| Owner | Full (root) | All modules in `mod/orbit/_outer/` |
| User | Full | Only `mod/orbit/_outer/{their_address}/` |
| User | None | Other users' directories |

## Usage Examples

### Example 1: Simple Permission Check

```python
from mod.core.server.auth.auth import check_permission

if check_permission(user_address, module_path, 'write'):
    # Write to module
    pass
```

### Example 2: Decorator Pattern

```python
from mod.core.server.auth.auth.middleware import require_auth_and_permission

@require_auth_and_permission(operation='execute')
def run_module(module_path: str, token: str, **kwargs):
    user_address = kwargs['user_address']
    # Module execution logic here
```

### Example 3: API Endpoint

```python
from fastapi import FastAPI, HTTPException
from mod.core.server.auth.auth.middleware import AccessControl

app = FastAPI()
ac = AccessControl()

@app.post("/modules/{module_name}/execute")
async def execute_module(module_name: str, token: str):
    module_path = f"/path/to/{module_name}"
    user_address, has_access = ac.verify_access(token, module_path, 'execute')

    if not has_access:
        raise HTTPException(403, "Access denied")

    # Execute module
    return {"status": "success"}
```

## Configuration

### Option 1: Environment Variable

```bash
export MOD_OWNER_ADDRESS="0x7f46ae9b5a5e25110900a418376e021454c90f4a"
```

### Option 2: Config File

```bash
python -m mod.core.server.auth.auth.config setup
```

Creates: `~/.mod/auth_config.json`

```json
{
  "owner_address": "0x7f46ae9b5a5e25110900a418376e021454c90f4a",
  "max_token_age": 3600,
  "strict_mode": true
}
```

### Option 3: Programmatic

```python
from mod.core.server.auth.auth import AuthConfig

config = AuthConfig()
config.set_owner_address("0x...")
config.set_max_token_age(7200)
config.set_strict_mode(True)
```

## Testing

Run the test suite:

```bash
# All auth tests
pytest mod/mod/core/server/auth/test/ -v

# Just permission tests
pytest mod/mod/core/server/auth/test/test_permissions.py -v

# Just auth tests
pytest mod/mod/core/server/auth/test/test_auth.py -v
```

## Security Notes

1. **Token Expiration**: Tokens expire after `max_token_age` (default: 1 hour)
2. **Signature Verification**: All tokens must be cryptographically signed
3. **Path Traversal**: Prevented by path resolution and comparison
4. **Owner Security**: Only set owner address to trusted addresses
5. **Strict Mode**: Enable in production for additional checks

## Integration with MOD

The permission system integrates seamlessly with the MOD framework:

```python
import mod as m

# Load a module (permission check happens automatically)
module = m.mod('orbit._outer.{user_address}.my_module')

# Execute a function (permission check happens automatically)
result = m.fn('orbit._outer.{user_address}.my_module/my_function')(data)
```

## Migration to `mod/peers/`

If you want to migrate from `mod/orbit/_outer/` to `mod/peers/`:

1. Update `PermissionManager.__init__`:
   ```python
   self.outer_path = self.mod_root / "mod" / "peers"
   ```

2. All permission logic remains the same
3. Update documentation references

## Troubleshooting

### Owner has no access?

Check owner address is set:
```python
from mod.core.server.auth.auth import AuthConfig
config = AuthConfig()
print(config.get_owner_address())
```

### Token verification fails?

Check token age:
```python
config = AuthConfig()
print(f"Max token age: {config.get_max_token_age()} seconds")
```

### User can't access their own modules?

Verify path structure:
```python
from mod.core.server.auth.auth import PermissionManager
pm = PermissionManager()
print(pm.get_user_path(user_address))
```

## Documentation

- **[PERMISSIONS.md](./PERMISSIONS.md)** - Comprehensive permission system guide
- **[Test Examples](./test/test_permissions.py)** - Working code examples
- **[Main README](../../../../README.md)** - MOD framework overview

## Support

For issues or questions:
1. Check the test files for examples
2. Review `PERMISSIONS.md` for detailed documentation
3. Check source code comments
4. Open an issue on GitHub
