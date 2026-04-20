#!/bin/bash
# Polymarket — stop API + App
echo "Stopping Polymarket..."
pm2 delete polymarket-api 2>/dev/null && echo "  API stopped" || echo "  API not running"
pm2 delete polymarket-app 2>/dev/null && echo "  App stopped" || echo "  App not running"
