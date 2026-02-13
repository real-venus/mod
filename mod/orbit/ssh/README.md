# SSH Key Manager

A simple, secure SSH key management utility that generates and manages SSH keys without exposing system information.

## Features

- **Generate SSH Keys**: Create ed25519 (or other types) SSH key pairs
- **List Keys**: View all existing SSH keys with sanitized output
- **Remove Keys**: Delete SSH key pairs safely
- **Privacy-Focused**: Automatically sanitizes keys to remove hostnames and system info
- **Fingerprint Support**: Optional fingerprint display for key verification

## Installation

```python
from ssh import SSHKeyManager
```

## Usage

### Initialize Manager

```python
# Default: ed25519 keys
manager = SSHKeyManager()

# Or specify key type
manager = SSHKeyManager(key_type='rsa')
```

### Generate New Key

```python
# Generate with default name
manager.add()

# Generate with custom name and comment
manager.add(key_name='github', comment='my-github-key')
```

### List All Keys

```python
# Basic listing
keys = manager.keys()

# Include fingerprints
keys = manager.keys(include_fingerprint=True)

for key in keys:
    print(f"Name: {key['name']}")
    print(f"Public Key: {key['public_key']}")
```

### Get Public Key

```python
# Get sanitized public key
pub_key = manager.get_public_key('id_ed25519')

# Get raw public key (with comments)
pub_key = manager.get_public_key('id_ed25519', sanitized=False)
```

### Remove Key

```python
manager.rm('id_ed25519_github')
```

## Key Features

### Privacy & Security

- **Sanitized Output**: Automatically removes hostnames and user info from public keys
- **Secure Permissions**: SSH directory created with proper 0o700 permissions
- **No System Leaks**: Public keys stripped of identifying comments

### Supported Key Types

- `ed25519` (default, recommended)
- `rsa`
- `ecdsa`
- `dsa`

## API Reference

### `SSHKeyManager(key_type='ed25519')`

Initialize the SSH key manager.

**Parameters:**
- `key_type` (str): Type of SSH key to manage (default: 'ed25519')

### `keys(include_fingerprint=False)`

List all SSH keys of the specified type.

**Parameters:**
- `include_fingerprint` (bool): Include key fingerprints in output

**Returns:**
- List of dictionaries containing key information

### `add(key_name=None, comment="")`

Generate a new SSH key pair.

**Parameters:**
- `key_name` (str): Custom name for the key (optional)
- `comment` (str): Comment to add to the key (optional)

**Returns:**
- `True` if successful, `False` if key already exists

### `rm(key_name)`

Remove an SSH key pair.

**Parameters:**
- `key_name` (str): Name of the key to remove

**Returns:**
- `True` if removed, `False` if not found

### `get_public_key(key_name, sanitized=True)`

Retrieve public key content.

**Parameters:**
- `key_name` (str): Name of the key
- `sanitized` (bool): Remove system info from output (default: True)

**Returns:**
- Public key string or `None` if not found

## Example Workflow

```python
from ssh import SSHKeyManager

# Initialize manager
manager = SSHKeyManager()

# Create a new key for GitHub
manager.add(key_name='github', comment='github-deploy')

# Get the public key to add to GitHub
pub_key = manager.get_public_key('id_ed25519_github')
print(pub_key)

# List all keys
for key in manager.keys(include_fingerprint=True):
    print(f"{key['name']}: {key['fingerprint']}")

# Remove old key
manager.rm('id_ed25519_old')
```

## Requirements

- Python 3.6+
- `ssh-keygen` command-line tool (standard on Unix/Linux/macOS)

## License

MIT

## Author

Built with simplicity and security in mind. 🔐