# PM Architecture

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        server.py                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Server.serve(mod, pm='pm', ...)                     │   │
│  │    ↓                                                  │   │
│  │  Server.set_pm(pm)  # Sets the PM backend            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                         pm/pm.py                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pm(mod=None)  # Wrapper/Router                      │   │
│  │    ↓                                                  │   │
│  │  Reads MOD_PM env or uses parameter                  │   │
│  │    ↓                                                  │   │
│  │  Delegates to: pm.docker OR pm.pm2                   │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────┬────────────────────────┬────────────────────┘
                ↓                        ↓
    ┌───────────────────────┐    ┌──────────────────────┐
    │   pm/pm/docker/       │    │   pm/pm/pm2/         │
    │   docker.py           │    │   pm2.py             │
    ├───────────────────────┤    ├──────────────────────┤
    │ • forward()           │    │ • forward()          │
    │ • start()             │    │ • start()            │
    │ • stop()              │    │ • stop()             │
    │ • kill()              │    │ • kill()             │
    │ • exists()            │    │ • exists()           │
    │ • servers()           │    │ • servers()          │
    │ • logs()              │    │ • logs()             │
    │ • stats()             │    │ • stats()            │
    │ • sync()              │    │ • sync()             │
    │ • get_port()          │    │ • get_port()         │
    │ • process_info()      │    │ • process_info()     │
    │ • params2cmd()        │    │ • params2cmd()       │
    └───────────┬───────────┘    └──────────┬───────────┘
                │                           │
                └───────────┬───────────────┘
                            ↓
            ┌────────────────────────────────┐
            │  registry/registry.py          │
            │  (Shared Registry)             │
            ├────────────────────────────────┤
            │ • reg(name, url)               │
            │ • dereg(name)                  │
            │ • namespace(search)            │
            │ • exists(name)                 │
            │                                │
            │ Storage:                       │
            │ ~/.mod/server/registry/        │
            │   registry.json                │
            └────────────────────────────────┘
```

## Data Flow: Starting a Server

### With PM2
```
User calls m.serve('api', pm='pm2', port=8000)
    ↓
Server.serve() → Server.set_pm('pm2')
    ↓
Server.pm.forward(mod='api', port=8000)
    ↓
PM2.forward()
    ├─→ Create serve script: ~/.mod/scripts/serve/api_serve.py
    ├─→ PM2.start_script() → pm2 start api_serve.py --name api
    └─→ Registry.reg('api', 'http://0.0.0.0:8000')
    ↓
Server running and registered ✓
```

### With Docker
```
User calls m.serve('api', pm='docker', port=8000)
    ↓
Server.serve() → Server.set_pm('docker')
    ↓
Server.pm.forward(mod='api', port=8000)
    ↓
Docker.forward()
    ├─→ Docker.run() → Updates docker-compose.yml
    ├─→ Executes: docker-compose up -d
    └─→ Registry.reg('api', 'http://0.0.0.0:8000')
    ↓
Container running and registered ✓
```

## Registry Lifecycle

### Registration (Both Backends)
```
PM.forward() completes successfully
    ↓
registry.reg(name, f'http://0.0.0.0:{port}')
    ↓
~/.mod/server/registry/registry.json:
{
  "api": "http://0.0.0.0:8000",
  "chain": "http://0.0.0.0:8001",
  ...
}
```

### Deregistration (Both Backends)
```
Server.kill(name)
    ↓
PM.kill(name) → Process/Container stopped
    ↓
registry.dereg(name)
    ↓
Name removed from registry.json
```

## Interface Compatibility Matrix

| Method | Docker | PM2 | Notes |
|--------|--------|-----|-------|
| `forward(mod, port, ...)` | ✅ | ✅ | Primary serving method |
| `start(...)` | ✅ | ✅ | Alias for forward |
| `stop(name)` | ✅ | ✅ | Stops without removing |
| `restart(name)` | ✅ | ✅ | Restarts process |
| `kill(name)` | ✅ | ✅ | Stops and removes |
| `exists(name)` | ✅ | ✅ | Checks if running |
| `server_exists(name)` | ✅ | ✅ | Alias for exists |
| `servers(search)` | ✅ | ✅ | Lists servers |
| `ps()` | ✅ | ✅ | Lists processes |
| `logs(name, lines, follow)` | ✅ | ✅ | Gets logs |
| `stats()` | ✅ | ✅ | Gets statistics |
| `sync()` | ✅ | ✅ | Updates cache |
| `get_port(name)` | ✅ | ✅ | Gets port number |
| `process_info(name)` | ✅ | ✅ | Detailed process info |
| `params2cmd(params)` | ✅ | ✅ | Params serialization |
| `kill_all()` | ✅ | ✅ | Kills all processes |

## Backend-Specific Methods

### Docker Only
- `build(mod)` - Build Docker image
- `up(mod)` - Docker-compose up
- `down(mod)` - Docker-compose down
- `images()` - List Docker images
- `networks()` - List Docker networks
- `add_network(name)` - Create network
- `ensure_network(name)` - Ensure network exists
- `ensure_image(mod)` - Ensure image exists

### PM2 Only
- `save()` - Save PM2 process list
- `resurrect()` - Resurrect saved processes
- `flush(name)` - Flush logs
- `monit()` - Open PM2 monitoring

## Files Structure

```
mod/core/server/
├── server.py                    # Main server orchestrator
├── pm/
│   ├── pm/
│   │   ├── pm.py               # Backend router/wrapper
│   │   ├── docker/
│   │   │   └── docker.py       # Docker implementation
│   │   └── pm2/
│   │       ├── pm2.py          # PM2 implementation
│   │       └── test_integration.py
│   ├── PM_SWITCHING_GUIDE.md   # User guide
│   └── ARCHITECTURE.md         # This file
└── registry/
    └── registry.py             # Shared registry

Generated at runtime:
~/.mod/server/
├── registry/
│   └── registry.json           # Server registry (shared)
└── pm2_stats.json             # PM2 stats cache

~/.mod/scripts/serve/
└── {name}_serve.py            # PM2 serve scripts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOD_PM` | `pm.docker` | Default PM backend |

## Future Enhancements

Potential improvements:

1. **Auto-detection**: Detect available PM and auto-select
2. **Migration**: Tools to migrate from Docker to PM2 and vice versa
3. **Hybrid mode**: Some services in Docker, others in PM2
4. **Health checks**: Unified health check interface
5. **Resource limits**: PM2 support for memory/CPU limits
6. **Process groups**: Group related services
7. **Load balancing**: Built-in load balancing for multiple instances
