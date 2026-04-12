#!/bin/bash
cd /Users/broski/mod/mod/orbit/hyperliquid
uvicorn api:app --host 0.0.0.0 --port app --reload
