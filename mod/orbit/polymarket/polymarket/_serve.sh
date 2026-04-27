#!/bin/bash
cd /Users/broski/mod/mod/orbit/polymarket/polymarket
uvicorn server:app --host 0.0.0.0 --port 50091 --reload
