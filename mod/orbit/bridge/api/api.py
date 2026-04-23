"""
Bridge API — FastAPI wrapper over bridge mod.

Serves the bridge Mod class methods as REST endpoints.
Launched/killed via mod.py serve_api() / kill_api().
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import mod as m
import time
import logging
from collections import defaultdict, deque

# Lazy singleton
_bridge = None

def get_bridge():
    global _bridge
    if _bridge is None:
        _bridge = m.mod('bridge')()
    return _bridge


IS_PRODUCTION = os.getenv('BRIDGE_ENV') == 'production'

app = FastAPI(
    title="Bridge API",
    description="Substrate/Solana to EVM identity bridge",
    version="2.0.0",
    debug=not IS_PRODUCTION,
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )

PRODUCTION_ORIGINS = [
    'https://modc2.com',
    'https://bridge.modc2.com',
]
DEV_ORIGINS = PRODUCTION_ORIGINS + [
    'http://localhost:8841',
    'http://localhost:3000',
]
ALLOWED_ORIGINS = os.getenv('BRIDGE_CORS_ORIGINS', '').split(',') if os.getenv('BRIDGE_CORS_ORIGINS') else (
    PRODUCTION_ORIGINS if IS_PRODUCTION else DEV_ORIGINS
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
rate_limit_store = defaultdict(lambda: deque())
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 10

def check_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    requests = rate_limit_store[client_ip]
    while requests and requests[0] < now - RATE_LIMIT_WINDOW:
        requests.popleft()
    if len(requests) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Max 10 requests per minute.")
    requests.append(now)
    return True


# ── Request models ──────────────────────────────────────────────

class ClaimRequest(BaseModel):
    address: str
    signature: str
    timestamp: int
    recipient: str = ""

class CommitRequest(BaseModel):
    source_address: str
    evm_address: str
    signature: str
    source_type: str  # 'substrate' | 'solana'

class UpdateCommitmentRequest(BaseModel):
    source_address: str
    evm_address: str
    signature: str
    source_type: str

class DeleteClaimRequest(BaseModel):
    address: str
    auth_token: str

class DeployRequest(BaseModel):
    network: str = "testnet"
    key: Optional[str] = None
    name: str = "Bridge Token"
    symbol: str = "BRG"
    initial_supply: int = 0


# ── Health / Status ─────────────────────────────────────────────

@app.get("/")
def root():
    return get_bridge().health()

@app.get("/health")
def health():
    return get_bridge().health()

@app.get("/status")
def status():
    return get_bridge().status()

@app.post("/status")
def status_post():
    """POST alias for /status (app compatibility)."""
    return get_bridge().status()

@app.get("/owner")
def owner():
    return {"owner": get_bridge().owner()}

@app.get("/contract_info")
def contract_info():
    return get_bridge().contract_info()


# ── Snapshot ────────────────────────────────────────────────────

@app.get("/in_snapshot/{address}")
def in_snapshot(address: str):
    return get_bridge().in_snapshot(address)

@app.get("/balances")
def balances(request: Request, page: int = 0, limit: int = 500):
    check_rate_limit(request)
    if limit > 100:
        raise HTTPException(status_code=403, detail="Bulk queries (limit > 100) require authentication.")
    all_balances = get_bridge().get_total_balances()
    if limit > 1000:
        limit = 1000
    items = list(all_balances.items())
    start = page * limit
    end = start + limit
    paged = dict(items[start:end])
    return {"balances": paged, "total": len(items), "page": page, "limit": limit}

@app.post("/get_total_balances")
def get_total_balances_post():
    """POST alias for /balances (app compatibility)."""
    return get_bridge().get_total_balances()


# ── Claims ──────────────────────────────────────────────────────

@app.post("/claim")
def claim(req: ClaimRequest):
    result = get_bridge().claim(
        address=req.address, signature=req.signature,
        recipient=req.recipient or None, timestamp=req.timestamp,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/has_claimed/{address}")
def has_claimed(address: str):
    return get_bridge().has_claimed(address)

@app.get("/unclaimed/{address}")
def unclaimed(address: str):
    return {"address": address, "unclaimed": get_bridge().unclaimed(address)}

@app.get("/claims")
def claims():
    return get_bridge().get_claims()

@app.post("/get_claims")
def get_claims_post():
    """POST alias for /claims (app compatibility)."""
    return get_bridge().get_claims()

@app.get("/claims_array")
def claims_array():
    return get_bridge().claims_array()

@app.post("/delete_claim")
def delete_claim(req: DeleteClaimRequest):
    result = get_bridge().delete_claim(req.address, auth_token=req.auth_token)
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result

class ResetRequest(BaseModel):
    auth_token: str

@app.post("/reset")
def reset(req: ResetRequest):
    """Reset all bridge data. Requires admin auth. For testing only."""
    result = get_bridge().reset(auth_token=req.auth_token)
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


# ── Commitments ─────────────────────────────────────────────────

@app.post("/commit")
def commit(req: CommitRequest):
    result = get_bridge().commit(
        req.source_address, req.evm_address, req.signature, req.source_type
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/update_commitment")
def update_commitment(req: UpdateCommitmentRequest):
    result = get_bridge().update_commitment(
        req.source_address, req.evm_address, req.signature, req.source_type
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/commitments")
def commitments():
    return get_bridge().get_commitments()

@app.post("/get_commitments")
def get_commitments_post():
    """POST alias for /commitments (app compatibility)."""
    return get_bridge().get_commitments()

@app.get("/commitment/{source_address}")
def commitment(source_address: str):
    result = get_bridge().get_commitment(source_address)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ── Contract ops ────────────────────────────────────────────────

@app.post("/store_abi")
def store_abi():
    result = get_bridge().store_abi()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/compile")
def compile():
    result = get_bridge().compile()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/test")
def test():
    return get_bridge().test()

@app.post("/deploy")
def deploy(req: DeployRequest):
    result = get_bridge().deploy(
        network=req.network, key=req.key,
        name=req.name, symbol=req.symbol,
        initial_supply=req.initial_supply,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8840"))
    uvicorn.run(app, host="0.0.0.0", port=port)
