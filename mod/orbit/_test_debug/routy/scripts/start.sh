#!/bin/bash
# Start Routy router

# Build if needed
if [ ! -f "target/release/routy" ]; then
    echo "Building Routy..."
    cargo build --release
fi

# Run
echo "Starting Routy router..."
exec ./target/release/routy
