#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# if running inside docker, use pm2
if [ -f /.dockerenv ]; then
    pm2-runtime ecosystem.config.js
else
    # build & start the container
    docker compose -f "$DIR/docker-compose.yml" up -d --build
    echo "openclaw container running"
    echo "  gateway: http://localhost:18789"
    echo "  api:     http://localhost:50120"
    echo "  app:     http://localhost:3120"
    echo ""
    echo "pm2 logs:  docker exec openclaw pm2 logs"
    echo "pm2 list:  docker exec openclaw pm2 list"
fi
