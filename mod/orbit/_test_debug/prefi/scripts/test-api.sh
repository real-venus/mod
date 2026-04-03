#!/usr/bin/env bash
#
# Quick API test script for PreFi backend
#

set -e

API="http://localhost:8830"

echo "🧪 Testing PreFi API..."
echo ""

# Test health endpoint
echo "1. Health check..."
curl -s "$API/health" && echo " ✓"
echo ""

# Test auth challenge
echo "2. Auth challenge..."
curl -s -X POST "$API/auth/challenge" \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}' | jq .
echo ""

# Test list markets
echo "3. List markets..."
curl -s "$API/markets" | jq .
echo ""

echo "✅ API tests complete!"
