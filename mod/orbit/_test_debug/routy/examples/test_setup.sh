#!/bin/bash
# Example setup script for testing Routy

echo "🚀 Routy Test Setup"
echo ""

# Start Routy in the background
echo "Starting Routy server..."
cargo run --release &
ROUTY_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "Registering test websites..."
echo ""

# Register example website 1
echo "1. Registering 'example1' → http://example.com"
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "example1",
    "target_url": "http://example.com",
    "description": "Example website 1"
  }' -s | jq .

echo ""

# Register example website 2
echo "2. Registering 'github' → https://github.com"
curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github",
    "target_url": "https://github.com",
    "description": "GitHub homepage"
  }' -s | jq .

echo ""
echo "Listing registered websites..."
curl http://localhost:3000/_api/websites -s | jq .

echo ""
echo "Getting system stats..."
curl http://localhost:3000/_api/stats -s | jq .

echo ""
echo "✅ Setup complete!"
echo ""
echo "Visit http://localhost:3000 to see the dashboard"
echo "Try accessing:"
echo "  - http://localhost:3000/example1/"
echo "  - http://localhost:3000/github/"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for user interrupt
wait $ROUTY_PID
