#!/bin/bash

# Test File Browser API Endpoints
# Run this script to verify the backend is working

API_URL="${API_URL:-http://localhost:8820}"
TEST_DIR="${TEST_DIR:-~/mod/mod/orbit/claude}"

echo "🧪 Testing File Browser API Endpoints"
echo "API URL: $API_URL"
echo "Test Directory: $TEST_DIR"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local name=$1
    local url=$2
    local expected_field=$3

    echo -n "Testing $name... "
    response=$(curl -s "$url")

    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Response: $response"
        return 1
    fi
}

echo "─────────────────────────────────────────"
echo "1. Testing /files/tree endpoint"
echo "─────────────────────────────────────────"
test_endpoint "File Tree" \
    "$API_URL/files/tree?path=$TEST_DIR&depth=2" \
    "tree"

echo ""
echo "─────────────────────────────────────────"
echo "2. Testing /files/content endpoint"
echo "─────────────────────────────────────────"
test_endpoint "File Content" \
    "$API_URL/files/content?path=$TEST_DIR/README.md" \
    "content"

echo ""
echo "─────────────────────────────────────────"
echo "3. Testing /files/search endpoint"
echo "─────────────────────────────────────────"
test_endpoint "File Search" \
    "$API_URL/files/search?path=$TEST_DIR&query=README" \
    "results"

echo ""
echo "─────────────────────────────────────────"
echo "4. Testing /files/grep endpoint"
echo "─────────────────────────────────────────"
test_endpoint "Content Search (grep)" \
    "$API_URL/files/grep?path=$TEST_DIR&query=mod&caseSensitive=false" \
    "matches"

echo ""
echo "─────────────────────────────────────────"
echo "✨ API Tests Complete"
echo "─────────────────────────────────────────"
echo ""
echo "Next steps:"
echo "1. Start the frontend: cd app && npm run dev"
echo "2. Open http://localhost:3000/examples/file-browser"
echo "3. Test keyboard shortcuts:"
echo "   - Cmd+P for file search"
echo "   - Cmd+Shift+F for content search"
echo ""
