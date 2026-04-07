#!/bin/bash
cd /Users/broski/mod/mod/orbit/uniswap/server
uvicorn server:app --host 0.0.0.0 --port 50088 --reload
