# Process Manager Switching Guide

This guide explains how to seamlessly switch between Docker and PM2 process managers.

## Overview

The server now supports **seamless switching** between Docker and PM2 backends. Both backends share the same interface and registry, making them fully interchangeable.

## Key Features

✅ **Unified Interface**: Both Docker and PM2 expose the same methods
✅ **Shared Registry**: Servers register themselves automatically regardless of backend
✅ **Environment-Based Defaults**: Set default PM with `MOD_PM` environment variable
✅ **Per-Call Override**: Specify `pm='pm2'` or `pm='docker'` per serve call

## Usage

### Method 1: Specify PM per call

```python
import mod as m

# Use PM2
m.serve('mymod', pm='pm2', port=8000)

# Use Docker
m.serve('mymod', pm='docker', port=8000)
```

### Method 2: Set default with environment variable

```bash
# Set PM2 as default
export MOD_PM=pm.pm2

# Set Docker as default (or omit - Docker is default)
export MOD_PM=pm.docker
```

Then in Python:

```python
import mod as m

# Uses default from MOD_PM environment variable
m.serve('mymod', port=8000)
```

### Method 3: Direct instantiation

```python
import mod as m

# PM2 backend
pm2 = m.mod('pm.pm2')()
pm2.forward(mod='mymod', port=8000)

# Docker backend
docker = m.mod('pm.docker')()
docker.forward(mod='mymod', port=8000)
```

## Common Interface Methods

Both PM2 and Docker backends support these methods:

| Method | Description |
|--------|-------------|
| `forward(mod, port, params, ...)` | Start a mod as a server |
| `start(...)` | Alias for forward |
| `stop(name)` | Stop a server |
| `restart(name)` | Restart a server |
| `kill(name)` | Kill and remove a server |
| `exists(name)` | Check if server exists |
| `server_exists(name)` | Alias for exists |
| `servers(search)` | List all servers |
| `ps()` | List running processes |
| `logs(name, lines, follow)` | Get server logs |
| `stats()` | Get process statistics |
| `sync()` | Sync statistics cache |
| `get_port(name)` | Get server port |
| `process_info(name)` | Get detailed process info |
| `params2cmd(params)` | Convert params dict to command string |

## Registry Integration

Both backends automatically:

1. **Register** servers when started:
   ```python
   # Automatically registers: mymod -> http://0.0.0.0:8000
   m.serve('mymod', port=8000, pm='pm2')
   ```

2. **Deregister** servers when stopped/killed:
   ```python
   # Automatically deregisters mymod from registry
   m.mod('server')().kill('mymod')
   ```

3. **Share the same registry** at `~/.mod/server/registry/registry.json`

## Example: Switching Backends

```python
import mod as m

# Start with PM2
m.serve('api', pm='pm2', port=8000)

# Check it's running
server = m.mod('server')()
assert 'api' in server.servers()

# Kill it (works regardless of backend)
server.kill('api')

# Start with Docker instead
m.serve('api', pm='docker', port=8000)

# Same commands work!
assert 'api' in server.servers()
server.logs('api', lines=50)
server.kill('api')
```

## Backend-Specific Differences

### Docker Advantages
- Isolated environments
- Network isolation with Docker networks
- Easy resource limits (CPU, memory)
- Portable across systems
- Volume mounting for data persistence

### PM2 Advantages
- Faster startup (no container overhead)
- Lower resource usage
- Native process management
- Built-in monitoring dashboard (`pm2 monit`)
- Process resurrection on reboot
- Better for development/local testing

## Testing

Run the integration test:

```bash
cd /Users/broski/mod/mod/core/server/pm/pm/pm2
python test_integration.py
```

## Implementation Details

### Registry Registration

**Docker** (`pm/pm/docker/docker.py:227`):
```python
self.registry.reg(mod, f'http://0.0.0.0:{port}')
```

**PM2** (`pm/pm/pm2/pm2.py:65`):
```python
if result.get('success', False):
    self.registry.reg(name, f'http://0.0.0.0:{port}')
```

### Backend Selection

The `pm/pm/pm.py` wrapper handles backend selection:

```python
class Pm:
    default_mod = os.getenv('MOD_PM', 'pm.docker')

    def __init__(self, mod: str = None, *args, **kwargs):
        if mod is None:
            mod = self.default_mod
        elif mod in ['pm2', 'PM2']:
            mod = 'pm.pm2'
        elif mod in ['docker', 'Docker']:
            mod = 'pm.docker'
```

## Troubleshooting

### PM2 not found
```bash
npm install -g pm2
```

### Docker not running
```bash
# macOS
open /Applications/Docker.app

# Linux
sudo systemctl start docker
```

### Port conflicts
Both backends use the same registry, so port conflicts are avoided automatically.

### Registry out of sync
```python
# Manually sync registry
m.mod('server')().registry.reset()

# Or sync stats
m.mod('pm.pm2')().sync()
```

## Contributing

When adding new features:

1. Implement in both `pm/pm/docker/docker.py` and `pm/pm/pm2/pm2.py`
2. Ensure method signatures match
3. Test with both backends
4. Update this guide

## License

Same as parent project.
