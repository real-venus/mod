#!/bin/bash
# Polycopy Test Script - Validate installation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}Testing Polycopy Installation${NC}"
echo ""

# Check Python
echo -n "Checking Python... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    echo -e "${GREEN}✓${NC} ($PYTHON_VERSION)"
else
    echo -e "${RED}✗ Python 3 not found${NC}"
    exit 1
fi

# Check Node
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} ($NODE_VERSION)"
else
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi

# Check PM2
echo -n "Checking PM2... "
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    echo -e "${GREEN}✓${NC} (v$PM2_VERSION)"
else
    echo -e "${YELLOW}⚠${NC} PM2 not installed (will be installed on start)"
fi

# Check directories
echo -n "Checking directories... "
if [ -d "app" ] && [ -d "server" ] && [ -d "polycopy" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing directories${NC}"
    exit 1
fi

# Check required files
echo -n "Checking required files... "
MISSING_FILES=()

if [ ! -f "requirements.txt" ]; then
    MISSING_FILES+=("requirements.txt")
fi

if [ ! -f "server/requirements.txt" ]; then
    MISSING_FILES+=("server/requirements.txt")
fi

if [ ! -f "server/api.py" ]; then
    MISSING_FILES+=("server/api.py")
fi

if [ ! -f "app/package.json" ]; then
    MISSING_FILES+=("app/package.json")
fi

if [ ! -f "ecosystem.config.js" ]; then
    MISSING_FILES+=("ecosystem.config.js")
fi

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing files:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

# Check Python module
echo -n "Checking polycopy module... "
if python3 -c "import sys; sys.path.insert(0, '.'); from polycopy.mod import Mod" 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} Module import issues (may work after dependencies installed)"
fi

# Check scripts
echo -n "Checking shell scripts... "
SCRIPTS=("start.sh" "stop.sh" "restart.sh" "status.sh" "logs.sh")
ALL_EXECUTABLE=true

for script in "${SCRIPTS[@]}"; do
    if [ ! -x "$script" ]; then
        ALL_EXECUTABLE=false
        chmod +x "$script" 2>/dev/null || true
    fi
done

if $ALL_EXECUTABLE; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} Fixed permissions"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Installation check complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Install dependencies: ${BLUE}./start.sh${NC}"
echo "  2. Check status:         ${BLUE}./status.sh${NC}"
echo "  3. View logs:            ${BLUE}./logs.sh${NC}"
echo ""
