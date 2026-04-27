#!/bin/bash
cd /Users/broski/mod/mod/orbit/polymarket/app
export NEXT_PUBLIC_API_URL=http://localhost:50091
export NEXT_PUBLIC_BASE_PATH=/polymarket
npm run dev -- -p 3091
