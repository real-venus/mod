#!/bin/bash

BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Viewing PM2 logs (Ctrl+C to exit)${NC}"
pm2 logs
