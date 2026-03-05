#!/bin/bash
# Polycopy Status Check Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}          Polycopy Status Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check PM2
echo -e "${YELLOW}PM2 Processes:${NC}"
if command -v pm2 &> /dev/null; then
    pm2 list | grep -E "polycopy|Process"
else
    echo -e "${RED}✗ PM2 not installed${NC}"
fi

echo ""

# Check API
echo -e "${YELLOW}API Server (http://localhost:8001):${NC}"
if curl -s http://localhost:8001/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is responding${NC}"
    API_VERSION=$(curl -s http://localhost:8001/ | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")
    echo -e "  Version: $API_VERSION"
else
    echo -e "${RED}✗ API is not responding${NC}"
fi

echo ""

# Check Web UI
echo -e "${YELLOW}Web UI (http://localhost:3001):${NC}"
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Web UI is responding${NC}"
else
    echo -e "${RED}✗ Web UI is not responding${NC}"
fi

echo ""

# Check Health
echo -e "${YELLOW}API Health:${NC}"
HEALTH=$(curl -s http://localhost:8001/api/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$HEALTH" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"  Success: {data.get('success', False)}\")
    print(f\"  Active Monitors: {data.get('active_monitors', 0)}\")
except:
    print('  Unable to parse health response')
" 2>/dev/null || echo "  Unable to parse health response"
else
    echo -e "${RED}  Unable to fetch health status${NC}"
fi

echo ""

# Check Stats
echo -e "${YELLOW}Trading Statistics:${NC}"
STATS=$(curl -s http://localhost:8001/api/stats 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$STATS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    stats = data.get('stats', {})
    print(f\"  Total Trades: {stats.get('total_trades', 0)}\")
    print(f\"  Total Volume: \${stats.get('total_volume', 0):.2f}\")
    print(f\"  Success Rate: {stats.get('success_rate', 0):.1f}%\")
    print(f\"  Active Positions: {stats.get('active_positions', 0)}\")
except:
    print('  No statistics available')
" 2>/dev/null || echo "  No statistics available"
else
    echo "  Statistics unavailable"
fi

echo ""

# System Info
echo -e "${YELLOW}System Info:${NC}"
echo "  Python: $(python3 --version 2>&1 | cut -d' ' -f2)"
echo "  Node: $(node --version)"
if command -v pm2 &> /dev/null; then
    echo "  PM2: $(pm2 --version)"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Quick actions
echo -e "${YELLOW}Quick Actions:${NC}"
echo "  View logs:   pm2 logs polycopy"
echo "  Restart:     pm2 restart all"
echo "  Monitor:     pm2 monit"
echo "  Stop:        ./stop.sh"
echo ""
