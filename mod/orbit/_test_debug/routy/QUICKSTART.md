# Routy Quick Start

## Installation

```bash
cd mod/orbit/routy
cargo build --release
```

## Run the Server

### Option 1: Direct Cargo Run
```bash
cargo run --release
```

### Option 2: Using Scripts
```bash
./scripts/start.sh
```

### Option 3: Via Mod Framework
```python
import mod as m
m.fn('routy/start')()
```

Server starts at: `http://localhost:3000`

## Register a Website

### Via cURL
```bash
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "myapp",
    "target_url": "http://localhost:8080",
    "description": "My awesome app"
  }'
```

### Via Mod Framework
```python
import mod as m

# Register
m.fn('routy/register')(
    name='myapp',
    url='http://localhost:8080',
    description='My awesome app'
)

# List websites
m.fn('routy/list')()

# Get stats
m.fn('routy/stats')()
```

## Access Registered Websites

Once registered, access your website at:
```
http://localhost:3000/myapp/
```

All paths are forwarded:
```
http://localhost:3000/myapp/api/users → http://localhost:8080/api/users
http://localhost:3000/myapp/index.html → http://localhost:8080/index.html
```

## Test with Example Apps

### Run the Full Demo
```bash
# Terminal 1: Starts 3 test websites + Routy
./examples/multi_site_demo.sh
```

Then visit:
- Dashboard: http://localhost:3000
- Portfolio: http://localhost:3000/portfolio/
- Game: http://localhost:3000/game/
- Art: http://localhost:3000/art/

### Run Your Own Test Server
```bash
# Terminal 1: Start a simple test server
python3 examples/simple_server.py 8080 "My App"

# Terminal 2: Start Routy
cargo run --release

# Terminal 3: Register it
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{"name": "myapp", "target_url": "http://localhost:8080"}'

# Visit: http://localhost:3000/myapp/
```

## Configuration

Edit `routy.config.json` (created on first run):

```json
{
  "host": "127.0.0.1",
  "port": 3000,
  "max_websites": 50,
  "cpu_limit_percent": 80.0,
  "memory_limit_mb": 1024,
  "enable_monitoring": true
}
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/_api/register` | POST | Register new website |
| `/_api/websites` | GET | List all websites |
| `/_api/stats` | GET | Get system statistics |
| `/:website/*path` | GET/POST/etc | Proxy to website |

## Common Use Cases

### Local Development
Host frontend + backend under one domain:
```bash
# Register frontend (Vite/React/etc on port 5173)
curl -X POST http://localhost:3000/_api/register \
  -d '{"name": "app", "target_url": "http://localhost:5173"}'

# Register API (FastAPI/Flask/etc on port 8000)
curl -X POST http://localhost:3000/_api/register \
  -d '{"name": "api", "target_url": "http://localhost:8000"}'

# Access:
# http://localhost:3000/app/  → Your frontend
# http://localhost:3000/api/  → Your backend
```

### Share Multiple Projects
```bash
# Project 1
curl -X POST http://localhost:3000/_api/register \
  -d '{"name": "project1", "target_url": "http://localhost:8001"}'

# Project 2
curl -X POST http://localhost:3000/_api/register \
  -d '{"name": "project2", "target_url": "http://localhost:8002"}'

# Share single URL with others:
# http://yourdomain.com/project1/
# http://yourdomain.com/project2/
```

## Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
lsof -ti:3000

# Kill existing process
kill $(lsof -ti:3000)
```

### Website not responding
```bash
# Check if target is running
curl http://localhost:8080

# Check Routy stats
curl http://localhost:3000/_api/stats

# View Routy logs (if running in terminal)
```

### CPU limit exceeded
Edit `routy.config.json` and increase `cpu_limit_percent`, then restart Routy.

## What's Next?

- Deploy to production with Nginx/Caddy reverse proxy
- Add authentication for registration endpoint
- Implement persistent storage for registered websites
- Add health checks and auto-recovery
- Enable WebSocket support for real-time apps

See `README.md` for full documentation.
