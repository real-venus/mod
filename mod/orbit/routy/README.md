# Routy

A high-performance Rust-based router for hosting multiple websites under a single domain with URL-based routing and resource limits.

## Features

- **Multi-Website Hosting**: Host multiple websites under one domain with clean URL routing
- **Resource Limits**: Built-in CPU and memory monitoring to prevent resource exhaustion
- **Reverse Proxy**: Efficient request forwarding to backend services
- **Rate Limiting**: Configurable limits on number of websites and system resources
- **REST API**: Simple API for registering and managing websites
- **Real-time Monitoring**: Track CPU usage and active website count

## Quick Start

### Installation

```bash
# Build the project
cargo build --release

# Run the server
cargo run --release
```

The server will start on `http://127.0.0.1:3000` by default.

### Configuration

On first run, `routy.config.json` will be created with default settings:

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

Edit this file to customize your deployment.

## Usage

### Registering a Website

```bash
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "myapp",
    "target_url": "http://localhost:8080",
    "description": "My awesome application"
  }'
```

### Accessing Websites

Once registered, access your website at:
```
http://localhost:3000/myapp/
```

Any path after the website name is forwarded to the target:
```
http://localhost:3000/myapp/api/users → http://localhost:8080/api/users
http://localhost:3000/myapp/assets/logo.png → http://localhost:8080/assets/logo.png
```

### List All Websites

```bash
curl http://localhost:3000/_api/websites
```

### Get System Stats

```bash
curl http://localhost:3000/_api/stats
```

Response:
```json
{
  "cpu_usage_percent": 15.2,
  "website_count": 3,
  "max_websites": 50,
  "cpu_limit_percent": 80.0
}
```

## API Reference

### `POST /_api/register`

Register a new website.

**Request Body:**
```json
{
  "name": "string",           // Alphanumeric with hyphens/underscores
  "target_url": "string",     // Valid HTTP/HTTPS URL
  "description": "string"     // Optional description
}
```

**Response:**
```json
{
  "success": true,
  "message": "Website registered successfully"
}
```

### `GET /_api/websites`

List all registered websites.

**Response:**
```json
[
  {
    "name": "myapp",
    "target_url": "http://localhost:8080",
    "description": "My awesome application",
    "created_at": 1234567890
  }
]
```

### `GET /_api/stats`

Get current system statistics.

**Response:**
```json
{
  "cpu_usage_percent": 15.2,
  "website_count": 3,
  "max_websites": 50,
  "cpu_limit_percent": 80.0
}
```

### `GET /:website/*path`

Proxy request to registered website.

## Resource Limits

Routy enforces resource limits to prevent abuse:

1. **Maximum Websites**: Configurable limit on total registered websites
2. **CPU Limit**: Rejects new registrations and proxying when CPU exceeds threshold
3. **Memory Limit**: Configurable memory limit (monitoring only)

When limits are exceeded, requests receive a `503 Service Unavailable` response.

## Example Use Cases

### Local Development

Host multiple development projects under one domain:

```bash
# Register frontend
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{"name": "frontend", "target_url": "http://localhost:5173"}'

# Register API
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{"name": "api", "target_url": "http://localhost:8080"}'

# Access them
# http://localhost:3000/frontend/ → Your React/Vue/etc app
# http://localhost:3000/api/ → Your backend API
```

### Community Sharing Platform

Allow users to share their creations:

```bash
# User A shares their game
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{"name": "spaceshooter", "target_url": "http://localhost:9000"}'

# User B shares their portfolio
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{"name": "portfolio", "target_url": "http://localhost:9001"}'

# Others can access:
# http://yourdomain.com/spaceshooter/
# http://yourdomain.com/portfolio/
```

### Microservices Gateway

Route to different microservices:

```bash
curl -X POST http://localhost:3000/_api/register \
  -d '{"name": "users", "target_url": "http://users-service:8001"}'

curl -X POST http://localhost:3000/_api/register \
  -d '{"name": "orders", "target_url": "http://orders-service:8002"}'

# Access services through single gateway
# http://gateway.com/users/profile
# http://gateway.com/orders/history
```

## Architecture

```
Client Request
     ↓
http://localhost:3000/myapp/api/users
     ↓
   Routy Router
     ↓
   Resource Check (CPU < 80%?)
     ↓
   Website Lookup (myapp → http://localhost:8080)
     ↓
   Reverse Proxy
     ↓
http://localhost:8080/api/users
     ↓
   Response
```

## Performance

- Built with Tokio for async I/O
- Efficient request proxying with minimal overhead
- Real-time resource monitoring without blocking
- Thread-safe concurrent request handling

## Security Considerations

- URL validation prevents malformed targets
- Name validation (alphanumeric + hyphens/underscores only)
- Resource limits prevent DoS attacks
- Header sanitization in proxy
- No automatic HTTPS (use reverse proxy like Nginx for production)

## Production Deployment

For production, place Routy behind a reverse proxy like Nginx or Caddy:

```nginx
# Nginx example
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Roadmap

- [ ] Website removal API
- [ ] Authentication for registration
- [ ] Persistent storage (SQLite/Redis)
- [ ] Request rate limiting per website
- [ ] WebSocket support
- [ ] HTTPS support
- [ ] Custom domain mapping
- [ ] Analytics and logging
- [ ] Health checks for registered websites
- [ ] Auto-scaling based on load
