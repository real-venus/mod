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
from pydantic import BaseModel
from typing import Optional
import mod as m

# Lazy singleton
_bridge = None

def get_bridge():
    global _bridge
    if _bridge is None:
        _bridge = m.mod('bridge')()
    return _bridge


app = FastAPI(
    title="Bridge API",
    description="Substrate/Solana to EVM identity bridge",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ──────────────────────────────────────────────

class ClaimRequest(BaseModel):
    auth_token: str = ""
    recipient: str
    address: str

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
    caller: Optional[str] = None

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
def balances():
    return get_bridge().get_total_balances()


# ── Claims ──────────────────────────────────────────────────────

@app.post("/claim")
def claim(req: ClaimRequest):
    result = get_bridge().claim(req.auth_token, req.recipient, req.address)
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

@app.get("/claims_array")
def claims_array():
    return get_bridge().claims_array()

@app.post("/delete_claim")
def delete_claim(req: DeleteClaimRequest):
    result = get_bridge().delete_claim(req.address, req.caller)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
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


# ── Generic forward ─────────────────────────────────────────────

@app.post("/forward")
async def forward(request: Request):
    """Generic forward — call any public bridge method by name."""
    body = await request.json()
    action = body.pop("action", body.pop("fn", None))
    if not action:
        raise HTTPException(status_code=400, detail="action or fn required")
    bridge = get_bridge()
    if not hasattr(bridge, action) or action.startswith("_"):
        raise HTTPException(status_code=404, detail=f"unknown action: {action}")
    fn = getattr(bridge, action)
    if not callable(fn):
        return {"result": fn}
    result = fn(**body)
    return {"result": result}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8840"))
    uvicorn.run(app, host="0.0.0.0", port=port)
