#!/bin/bash
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_API_URL="http://localhost:8000"
m serve mod=api port=8000 &
npm run dev -- -p 3000
