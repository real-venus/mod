#!/bin/bash
# Polycopy Stop Script - Gracefully shutdown all services (PM2 version)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${YELLOW}Stopping Polycopy services...${NC}"
echo ""

# Stop polycopy monitors via mod framework
echo -e "${BLUE}Stopping polycopy monitors...${NC}"
python3 << 'EOF' 2>/dev/null || true
try:
    import mod as m
    polycopy = m.mod('polycopy')()
    result = polycopy.stop()
    print("✓ Monitors stopped")
    if 'final_stats' in result:
        stats = result['final_stats']
        print(f"  Total Trades: {stats.get('total_trades', 0)}")
        print(f"  Total Volume: ${stats.get('total_volume', 0):.2f}")
        print(f"  Success Rate: {stats.get('success_rate', 0):.1f}%")
except Exception as e:
    print(f"! No active monitors")
EOF

# Check if PM2 is running our services
if command -v pm2 &> /dev/null; then
    PM2_LIST=$(pm2 jlist 2>/dev/null || echo "[]")

    if echo "$PM2_LIST" | grep -q "polycopy-api\|polycopy-app"; then
        echo ""
        echo -e "${BLUE}Stopping PM2 services...${NC}"

        # Stop API
        if pm2 describe polycopy-api &>/dev/null; then
            echo -e "${BLUE}Stopping API server...${NC}"
            pm2 delete polycopy-api
            echo -e "${GREEN}✓ API server stopped${NC}"
        fi

        # Stop Web
        if pm2 describe polycopy-app &>/dev/null; then
            echo -e "${BLUE}Stopping Web UI...${NC}"
            pm2 delete polycopy-app
            echo -e "${GREEN}✓ Web UI stopped${NC}"
        fi

        # Save PM2 process list
        pm2 save --force &>/dev/null || true
    else
        echo -e "${YELLOW}No PM2 services running${NC}"
    fi
else
    echo -e "${YELLOW}PM2 not found, skipping PM2 cleanup${NC}"
fi

# Display final stats
echo ""
echo -e "${BLUE}Final Statistics:${NC}"
python3 << 'EOF' 2>/dev/null || true
try:
    import mod as m
    stats = m.get('polycopy/stats', default={})
    if stats:
        print(f"  Total Trades:        {stats.get('total_trades', 0)}")
        print(f"  Total Volume:        ${stats.get('total_volume', 0):.2f}")
        print(f"  Successful Trades:   {stats.get('success_count', 0)}")
        print(f"  Failed Trades:       {stats.get('fail_count', 0)}")
        print(f"  Success Rate:        {stats.get('success_rate', 0):.1f}%")
        print(f"  Active Positions:    {stats.get('active_positions', 0)}")
    else:
        print("  No statistics available")
except:
    print("  Statistics unavailable")
EOF

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Polycopy stopped successfully${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
