# proton

ProtonMail account manager — store, manage, and share encrypted ProtonMail credentials locally.

## Usage

```python
import mod as m
p = m.mod('proton')()

# Add an account
p.add(email='user@proton.me', password='secret123', label='main')

# List accounts (passwords masked)
p.list()

# Get full credentials
p.get(email='user@proton.me')

# Update
p.update(email='user@proton.me', password='newpass')

# Remove
p.remove(email='user@proton.me')

# Share with someone (generates a one-time token)
token = p.share(email='user@proton.me', expires=3600)

# Import from a share token
p.import_share(token='the-token-string')

# Export all to file
p.export(path='./accounts.json')

# Store info
p.info()
```

## CLI

```bash
m proton list
m proton add email=user@proton.me password=secret123
m proton get email=user@proton.me
m proton share email=user@proton.me
m proton remove email=user@proton.me
m proton export
m proton info
```

## Encryption

Pass `master=<password>` to any command to encrypt/decrypt the store:

```python
p.add(email='user@proton.me', password='secret', master='my-master-key')
p.list(master='my-master-key')
```

## Sharing

`share()` generates a one-time token that expires (default 1 hour). The recipient calls `import_share(token=...)` to add the account to their local store. Tokens are consumed on use.

## Storage

Credentials are stored at `~/.mod/proton/` using the mod framework's key-value store with optional encryption.
