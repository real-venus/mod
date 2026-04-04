# Auth & Permissions

Access control for the MOD framework.

## Structure

```
orbit/
  orbit/          <- owner's modules (full access)
  portal/         <- other users' modules
    {address}/
      {module}/
```

## Rules

- **Owner**: full root access to everything
- **Users**: can only access `orbit/portal/{their_address}/`
- **Operations**: read, write, execute

## Usage

```python
from mod.core.server.auth.auth import Auth, PermissionManager, AccessControl

# Auth
auth = Auth(key='my_key')
token = auth.token(data={'action': 'execute'})
verified = auth.verify(token)

# Permissions
pm = PermissionManager()
pm.can_access(user_address, module_path, 'execute')

# API helper
ac = AccessControl()
user_address, has_access = ac.verify_access(token, module_path, 'execute')
```

## Config

```bash
export MOD_OWNER_ADDRESS="0x..."
# or
python -m mod.core.server.auth.auth.config setup
```

## Tests

```bash
pytest mod/core/server/auth/test/ -v
```
