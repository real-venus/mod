# MOD Permission System

A flexible permission system for the MOD framework that provides access control for user modules.

## Overview

The permission system implements a simple but effective access control model:

- **Owner (Root Access)**: The computer/system owner has full access to all modules
- **Regular Users**: Can only access modules in `mod/orbit/_outer/{their_address}/{module}`
- **Isolation**: Users cannot access or modify modules owned by other users

## Architecture

```
mod/
└── orbit/
    └── _outer/
        ├── 0x7f46ae9b... (User 1's address)
        │   ├── module1/
        │   ├── module2/
        │   └── ...
        ├── 0x6478255b... (User 2's address)
        │   ├── module3/
        │   └── ...
        └── ...
```

## Components

### 1. PermissionManager

Core class for checking permissions:

```python
from mod.core.server.auth.auth import PermissionManager

pm = PermissionManager(owner_address="0xowner123")

# Check if user can access a module
can_read = pm.can_access(user_address, module_path, 'read')
can_write = pm.can_access(user_address, module_path, 'write')
can_execute = pm.can_access(user_address, module_path, 'execute')

# List user's modules
modules = pm.list_user_modules(user_address)

# Get all accessible modules
accessible = pm.get_accessible_modules(user_address)
```

### 2. AuthPermissionMiddleware

Combines authentication and permission checking:

```python
from mod.core.server.auth.auth import AuthPermissionMiddleware

middleware = AuthPermissionMiddleware()

# Verify token and check access
result = middleware.verify_and_check_access(
    token=auth_token,
    module_path="/path/to/module",
    operation="execute"
)
# Returns: {'user_address': '0x...', 'verified': True, 'has_permission': True}
```

### 3. Decorators

Easy-to-use decorators for protecting functions:

```python
from mod.core.server.auth.auth.middleware import require_auth_and_permission

@require_auth_and_permission(operation='execute')
def run_module(module_path: str, token: str, **kwargs):
    # This only runs if user is authenticated and has permission
    user_address = kwargs['user_address']
    print(f"User {user_address} is running module at {module_path}")
```

### 4. AccessControl Helper

Simple helper for API endpoints:

```python
from mod.core.server.auth.auth.middleware import AccessControl

ac = AccessControl()

# Verify access
user_address, has_access = ac.verify_access(token, module_path, 'execute')

if has_access:
    # Proceed with operation
    pass

# Check if user is owner
if ac.is_owner(token):
    # Admin operations
    pass
```

## Setup

### 1. Configure Owner Address

Run the interactive setup:

```bash
python -m mod.core.server.auth.auth.config setup
```

Or set it programmatically:

```python
from mod.core.server.auth.auth.config import AuthConfig

config = AuthConfig()
config.set_owner_address("0x7f46ae9b5a5e25110900a418376e021454c90f4a")
```

Or via environment variable:

```bash
export MOD_OWNER_ADDRESS="0x7f46ae9b5a5e25110900a418376e021454c90f4a"
```

### 2. Configuration Options

```python
from mod.core.server.auth.auth.config import AuthConfig

config = AuthConfig()

# Set maximum token age (default: 3600 seconds)
config.set_max_token_age(7200)

# Enable/disable strict mode
config.set_strict_mode(True)

# View all settings
print(config.get_all_settings())
```

## Usage Examples

### Example 1: Basic Permission Check

```python
from mod.core.server.auth.auth import check_permission

user_address = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
module_path = "/Users/broski/mod/mod/orbit/_outer/0x7f46ae9b.../my_module"

if check_permission(user_address, module_path, 'write'):
    # User can write to this module
    print("Access granted")
else:
    print("Access denied")
```

### Example 2: Require Permission (Raises Exception)

```python
from mod.core.server.auth.auth import require_permission

try:
    require_permission(user_address, module_path, 'execute')
    # If we get here, user has permission
    execute_module(module_path)
except PermissionError as e:
    print(f"Access denied: {e}")
```

### Example 3: Full Authentication + Permission Flow

```python
import mod as m
from mod.core.server.auth.auth import Auth, PermissionManager

# 1. User creates authentication token
auth = Auth(key='user_private_key')
token = auth.token(data={'action': 'execute_module'})

# 2. Server receives request and verifies
auth_server = Auth()
headers = auth_server.verify(token)
user_address = headers['key']

# 3. Check permissions
pm = PermissionManager()
module_path = "/path/to/module"

if pm.can_access(user_address, module_path, 'execute'):
    # Execute the module
    result = execute_module(module_path)
else:
    raise PermissionError("Access denied")
```

### Example 4: API Endpoint with Permissions

```python
from fastapi import FastAPI, HTTPException
from mod.core.server.auth.auth.middleware import AccessControl

app = FastAPI()
ac = AccessControl()

@app.post("/execute/{module_name}")
async def execute_module(module_name: str, token: str, data: dict):
    # Get module path
    module_path = f"/path/to/modules/{module_name}"

    # Verify access
    user_address, has_access = ac.verify_access(token, module_path, 'execute')

    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    # Execute module
    result = run_module(module_path, data)
    return {"user": user_address, "result": result}
```

### Example 5: Creating User Directories

```python
from mod.core.server.auth.auth import PermissionManager

pm = PermissionManager()

# Create directory for new user
new_user = "0x1234567890abcdef"
user_path = pm.create_user_directory(new_user)

print(f"Created directory at: {user_path}")
# Creates: mod/orbit/_outer/0x1234567890abcdef/
# With a README.md explaining the access control
```

## Permission Operations

The system supports three types of operations:

- **`read`**: View module code, configuration, and outputs
- **`write`**: Modify module code and configuration
- **`execute`**: Run the module

All three operations are subject to the same access control rules:
- Owner can perform all operations on all modules
- Users can only perform operations on their own modules

## Security Considerations

1. **Owner Address Security**: Keep the owner address secure and only set it to trusted addresses
2. **Token Expiration**: Tokens expire after `max_token_age` seconds (default: 3600)
3. **Signature Verification**: All tokens must be signed with the user's private key
4. **Path Traversal**: The system prevents path traversal attacks
5. **Strict Mode**: Enable strict mode for production environments

## Testing

Run the test suite:

```bash
pytest mod/mod/core/server/auth/test/test_permissions.py -v
```

## Migration Path

If you want to move to `mod/peers/` in the future, you can update the `PermissionManager` class:

```python
class PermissionManager:
    def __init__(self, ...):
        # Current: mod/orbit/_outer/{user}
        # Future:  mod/peers/{user}
        self.outer_path = self.mod_root / "mod" / "peers"
```

All the permission logic will work the same way, just with different paths.

## Common Patterns

### Pattern 1: Module Registration

```python
def register_module(user_address: str, module_name: str, token: str):
    """Register a new module for a user."""
    pm = PermissionManager()

    # Create user directory if needed
    user_path = pm.create_user_directory(user_address)

    # Module path
    module_path = user_path / module_name
    module_path.mkdir(exist_ok=True)

    # User automatically has access to their own modules
    assert pm.can_access(user_address, str(module_path), 'write')

    return str(module_path)
```

### Pattern 2: Module Execution

```python
def execute_user_module(module_path: str, token: str, data: dict):
    """Execute a module with permission checking."""
    ac = AccessControl()

    # Verify and get user
    user_address, has_access = ac.verify_access(token, module_path, 'execute')

    if not has_access:
        raise PermissionError(f"User {user_address} cannot execute {module_path}")

    # Load and execute
    import importlib.util
    spec = importlib.util.spec_from_file_location("module", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module.run(data)
```

### Pattern 3: Admin Operations

```python
def admin_list_all_modules(token: str):
    """List all modules (admin only)."""
    ac = AccessControl()

    # Check if owner
    if not ac.is_owner(token):
        raise PermissionError("Admin access required")

    pm = PermissionManager()
    return pm._list_all_modules()
```

## Future Enhancements

Potential additions for future versions:

1. **Shared Modules**: Allow users to grant access to specific users
2. **Groups**: Create user groups with shared access
3. **Quotas**: Limit number of modules per user
4. **Audit Logging**: Track all access attempts
5. **Rate Limiting**: Prevent abuse
6. **On-Chain Permissions**: Store permissions in smart contracts

## Support

For issues or questions:
- Check the test files for examples
- Review the source code comments
- Open an issue on GitHub
