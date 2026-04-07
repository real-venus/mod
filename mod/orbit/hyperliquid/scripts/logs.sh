#!/bin/bash
# Quick access to logs

if [ "$1" == "api" ]; then
    pm2 logs hyperliquid-api
elif [ "$1" == "app" ]; then
    pm2 logs hyperliquid-app
else
    pm2 logs hyperliquid
fi
