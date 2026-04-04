# Permission System - Quick Reference

## Setup

```bash
# Interactive setup
python scripts/setup_permissions.py

# Or set via environment
export MOD_OWNER_ADDRESS="0x7f46ae9b5a5e25110900a418376e021454c90f4a"
```

## Import

```python
from mod.core.server.auth.auth import (
    Auth,                           # Authentication
    PermissionManager,              # Permission checking
    AccessControl,                  # API helper
    check_permission,               # Quick check
    require_permission,             # Check or raise
    require_auth_and_permission,    # Decorator
    AuthConfig                      # Configuration
)
```

## Basic Permission Check

```python
from mod.core.server.auth.auth import check_permission

# Quick check
if check_permission(user_address, module_path, 'execute'):
    # Do something
    pass
```

## Permission Manager

```python
from mod.core.server.auth.auth import PermissionManager

pm = PermissionManager()

# Check access
pm.can_access(user_address, module_path, 'read')
pm.can_access(user_address, module_path, 'write')
pm.can_access(user_address, module_path, 'execute')

# List user's modules
modules = pm.list_user_modules(user_address)

# Get all accessible modules
accessible = pm.get_accessible_modules(user_address)

# Create user directory
user_path = pm.create_user_directory(user_address)

# Check if owner
pm.is_owner(user_address)

# Raise error if no permission
pm.check_and_raise(user_address, module_path, 'execute')
```

## With Authentication

```python
from mod.core.server.auth.auth import Auth, PermissionManager

# 1. User generates token
auth = Auth(key='user_key')
token = auth.token(data={'action': 'test'})

# 2. Server verifies token
server_auth = Auth()
verified = server_auth.verify(token)
user_address = verified['key']

# 3. Check permissions
pm = PermissionManager()
if pm.can_access(user_address, module_path, 'execute'):
    # Execute
    pass
```

## AccessControl Helper

```python
from mod.core.server.auth.auth.middleware import AccessControl

ac = AccessControl()

# Verify and check access
user_address, has_access = ac.verify_access(token, module_path, 'execute')

# Get user from token
user_address = ac.get_user_from_token(token)

# Check if owner
is_owner = ac.is_owner(token)
```

## Decorator

```python
from mod.core.server.auth.auth.middleware import require_auth_and_permission

@require_auth_and_permission(operation='execute')
def run_module(module_path: str, token: str, **kwargs):
    user_address = kwargs['user_address']  # Added automatically
    auth_info = kwargs['auth_info']        # Added automatically
    # Your code here
```

## FastAPI Example

```python
from fastapi import FastAPI, HTTPException
from mod.core.server.auth.auth.middleware import AccessControl

app = FastAPI()
ac = AccessControl()

@app.post("/modules/{module_name}/execute")
async def execute(module_name: str, token: str):
    module_path = f"/path/to/{module_name}"
    user, has_access = ac.verify_access(token, module_path, 'execute')

    if not has_access:
        raise HTTPException(403, "Access denied")

    return {"status": "success", "user": user}
```

## Configuration

```python
from mod.core.server.auth.auth import AuthConfig

config = AuthConfig()

# Get/set owner
owner = config.get_owner_address()
config.set_owner_address("0x...")

# Get/set token age
age = config.get_max_token_age()
config.set_max_token_age(7200)  # 2 hours

# Get/set strict mode
strict = config.is_strict_mode()
config.set_strict_mode(True)

# Get all settings
settings = config.get_all_settings()
```

## Access Rules

| User | Can Access |
|------|------------|
| Owner | All modules |
| User | Only `orbit/portal/{their_address}/*` |

## Operations

- `read`: View module
- `write`: Modify module
- `execute`: Run module

## Common Patterns

### Pattern 1: API Endpoint
```python
user, ok = ac.verify_access(token, path, 'execute')
if not ok:
    raise HTTPException(403)
# proceed...
```

### Pattern 2: Decorator
```python
@require_auth_and_permission(operation='execute')
def my_func(module_path, token, **kwargs):
    user = kwargs['user_address']
    # proceed...
```

### Pattern 3: Manual Check
```python
pm = PermissionManager()
if pm.can_access(user, path, 'write'):
    # proceed...
else:
    raise PermissionError()
```

## File Locations

- **Permissions**: `mod/mod/core/server/auth/auth/permissions.py`
- **Middleware**: `mod/mod/core/server/auth/auth/middleware.py`
- **Config**: `mod/mod/core/server/auth/auth/config.py`
- **Tests**: `mod/mod/core/server/auth/test/test_permissions.py`
- **Examples**: `mod/mod/core/server/auth/examples/basic_usage.py`
- **Docs**: `mod/mod/core/server/auth/PERMISSIONS.md`

## Run Examples

```bash
# Setup
python scripts/setup_permissions.py

# Examples
python mod/mod/core/server/auth/examples/basic_usage.py

# Tests
pytest mod/mod/core/server/auth/test/test_permissions.py -v
```

## Troubleshooting

```python
# Check owner
from mod.core.server.auth.auth import AuthConfig
print(AuthConfig().get_owner_address())

# Check user path
from mod.core.server.auth.auth import PermissionManager
print(PermissionManager().get_user_path(user_address))

# List user modules
print(PermissionManager().list_user_modules(user_address))
```
