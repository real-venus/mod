# Permissions

Owner has root access. Users are sandboxed to `orbit/portal/{their_address}/`.

```
orbit/portal/
  0x7f46ae9b.../    <- user1 can only access this
    module1/
    module2/
  0x6478255b.../    <- user2 can only access this
    module3/
```

## API

```python
from mod.core.server.auth.auth import PermissionManager

pm = PermissionManager(owner_address="0x...")

pm.can_access(address, path, 'read')     # bool
pm.can_access(address, path, 'write')    # bool
pm.can_access(address, path, 'execute')  # bool
pm.list_user_modules(address)            # [str]
pm.check_and_raise(address, path, 'read') # raises PermissionError
```
