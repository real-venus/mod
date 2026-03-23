#!/bin/bash
# Demo: Running multiple local websites through Routy

echo "🌐 Routy Multi-Site Demo"
echo "========================"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    kill $APP1_PID $APP2_PID $APP3_PID $ROUTY_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start three simple web servers
echo "Starting test websites..."
python3 examples/simple_server.py 8001 "My Portfolio" &
APP1_PID=$!

python3 examples/simple_server.py 8002 "Cool Game" &
APP2_PID=$!

python3 examples/simple_server.py 8003 "Art Gallery" &
APP3_PID=$!

sleep 2

# Start Routy
echo "Starting Routy router..."
cargo run --release &
ROUTY_PID=$!

sleep 3

# Register websites
echo ""
echo "Registering websites with Routy..."
echo ""

curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "portfolio",
    "target_url": "http://localhost:8001",
    "description": "Personal portfolio site"
  }' -s | jq .

curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "game",
    "target_url": "http://localhost:8002",
    "description": "Fun web game"
  }' -s | jq .

curl -X POST http://localhost:3000/_api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "art",
    "target_url": "http://localhost:8003",
    "description": "Digital art collection"
  }' -s | jq .

echo ""
echo "✅ Setup complete!"
echo ""
echo "All websites are now accessible through Routy:"
echo ""
echo "  Dashboard:    http://localhost:3000"
echo "  Portfolio:    http://localhost:3000/portfolio/"
echo "  Game:         http://localhost:3000/game/"
echo "  Art Gallery:  http://localhost:3000/art/"
echo ""
echo "System stats:  http://localhost:3000/_api/stats"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
wait
