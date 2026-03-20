#!/bin/bash

# Shared port utilities for uniswap scripts

# Find a process using a port and return its PID
port_pid() {
    local port=$1
    lsof -ti tcp:$port 2>/dev/null
}

# Kill whatever is on a port
kill_port() {
    local port=$1
    local pids=$(port_pid $port)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing process(es) on port $port: $pids${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Find an open port starting from a base port
find_open_port() {
    local port=$1
    local max_tries=20
    local i=0
    while [ $i -lt $max_tries ]; do
        if ! lsof -ti tcp:$port >/dev/null 2>&1; then
            echo $port
            return 0
        fi
        port=$((port + 1))
        i=$((i + 1))
    done
    echo ""
    return 1
}

# Ensure a port is free — kill existing process if needed
ensure_port() {
    local port=$1
    local name=$2
    if lsof -ti tcp:$port >/dev/null 2>&1; then
        echo -e "${YELLOW}Port $port in use ($name) — killing existing process${NC}"
        kill_port $port
    fi
    echo -e "${GREEN}✓ Port $port free ($name)${NC}"
}
