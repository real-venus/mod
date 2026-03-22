# Server Management

Any module can be served as an HTTP API. The server system uses PM2 for process management and includes service discovery through a built-in registry.

## Quick Start

```python
import mod as m

# Start a server for any module
m.serve('api', port=8000)

# List running servers
m.servers()  # ['api']

# Stop a server
m.kill('api')
```

From the CLI:
```bash
m serve api port=8000
m servers
m kill api
```

## How It Works

When you serve a module:

1. The framework loads the module and inspects its functions
2. A Flask app is created with each function as a POST endpoint
3. The server is started via PM2 (or Docker)
4. The server registers itself in the service registry
5. Functions are accessible at `POST http://localhost:{port}/{function_name}`

### Endpoint Format

Each public function becomes a POST endpoint that accepts JSON:

```bash
# Module function: agent.forward(query="hello", steps=5)
# Becomes: POST /forward

curl -X POST http://localhost:8000/forward \
  -H "Content-Type: application/json" \
  -d '{"query": "hello", "steps": 5}'
```

Every server also exposes:
- `GET /info` — module info and schema
- Health check endpoints

## Server Options

```python
m.serve(
    mod='api',           # Module name
    port=8000,           # Port (auto-assigned if not specified)
    remote=False,        # Enable remote access
    pm='pm2',            # Process manager ('pm2' or 'docker')
    fns=None,            # Specific functions to expose (None = all)
    run_mode='server',   # Run mode
    paywall=False,       # Enable payment gating
)
```

## Port Management

```python
# Get a free port
port = m.free_port()

# Get multiple free ports
ports = m.get_ports(3)  # [8001, 8002, 8003]

# List used ports
m.used_ports()

# Check if port is in use
from mod.core.utils import port_used
port_used(8000)  # True/False
```

## Service Registry

The server system maintains a registry for service discovery.

```python
server = m.mod('server')()

# Get all registered servers
server.namespace()
# {'api': 'http://localhost:8000', 'agent': 'http://localhost:8001'}

# Get server URLs
server.urls()

# Get server names
server.servers()

# Check if server exists
server.exists('api')  # True

# Get module info from running servers
server.mods()  # Fetches /info from each server
```

## Server Lifecycle

```python
server = m.mod('server')()

# Start
server.serve('mymod', port=8080)

# Wait for it to be ready
server.wait_for_server('mymod', max_time=30)

# View logs
server.logs('mymod')

# Stop one server
server.kill('mymod')

# Stop all servers
server.kill_all()
```

## PM2 Integration

Servers are managed through PM2, which provides:
- Process monitoring and auto-restart
- Log management
- Resource monitoring
- Startup scripts

```bash
# View PM2 status directly
pm2 status

# View server logs
pm2 logs api

# Monitor resources
pm2 monit
```
