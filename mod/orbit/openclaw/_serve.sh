#!/bin/bash
cd /Users/broski/mod/mod/orbit/openclaw
uvicorn api:app --host 0.0.0.0 --port 50120 --reload
