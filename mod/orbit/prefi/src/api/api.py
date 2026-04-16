import os
import sys
import json
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from pathlib import Path

# Add prefi root to path so `prefi.mod` import works,
# and add mod root so `mod` package imports work inside Mod
prefi_root = os.path.join(os.path.dirname(__file__), '..')
mod_root = os.path.join(prefi_root, '..', '..', '..')
sys.path.insert(0, prefi_root)
sys.path.insert(0, mod_root)

app = FastAPI(title="PreFi API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None

def get_mod():
    global _mod
    if _mod is None:
        from prefi.mod import Mod
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
        config = {}
        if os.path.exists(config_path):
            with open(config_path) as f:
                config = json.load(f)
        _mod = Mod(config)
    return _mod


# ── Health & Status ────────────────────────────────────────────────

@app.get("/health")
def health():
    return get_mod().health()

@app.get("/status")
def status():
    return get_mod().status()


# ── Markets ────────────────────────────────────────────────────────

@app.get("/markets")
def list_markets():
    return get_mod().list_markets()

@app.get("/markets/{market_id}")
def get_market(market_id: int):
    result = get_mod().get_market(market_id)
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    return result

@app.post("/markets")
def create_market(
    asset: str = Query(..., description="Asset pair e.g. ETH/USD"),
    token_address: str = Query(..., description="Token address for oracle"),
    duration: int = Query(86400, description="Duration in seconds"),
):
    return get_mod().create_market(asset, token_address, duration)

@app.post("/markets/{market_id}/resolve")
def resolve_market(
    market_id: int,
    actual_price: str = Query(..., description="Actual price (human readable e.g. '3500.50')"),
):
    return get_mod().resolve_market(market_id, actual_price)


# ── Predictions ────────────────────────────────────────────────────

@app.get("/predictions/{address}")
def get_predictions(address: str):
    return get_mod().get_user_predictions(address)

@app.post("/predictions")
def place_prediction(
    market_id: int = Query(...),
    predicted_price: str = Query(..., description="Predicted price (human readable)"),
    stake_amount: str = Query(..., description="Stake amount (human readable)"),
    address: str = Query(..., description="Player address"),
):
    return get_mod().record_prediction(market_id, address, predicted_price, stake_amount)

@app.post("/predictions/{market_id}/claim")
def claim_reward(market_id: int, address: str = Query(...)):
    return get_mod().record_claim(market_id, address)


# ── Leaderboard & Rewards ─────────────────────────────────────────

@app.get("/leaderboard")
def leaderboard(market_id: Optional[int] = Query(None)):
    return get_mod().leaderboard(market_id)

@app.get("/rewards/{address}")
def get_rewards(address: str, market_id: Optional[int] = Query(None)):
    return get_mod().get_rewards(address, market_id)


# ── Prices ─────────────────────────────────────────────────────────

@app.get("/prices")
def get_prices():
    return get_mod().get_prices()

@app.get("/prices/{asset}")
def get_asset_price(asset: str):
    return get_mod().get_asset_price(asset)


# ── Deployment Info ────────────────────────────────────────────────

@app.get("/deployment")
def deployment():
    return get_mod().get_deployment_info()

@app.get("/config")
def config():
    m = get_mod()
    return {
        'api_port': m.api_port,
        'app_port': m.app_port,
        'network': m.network,
        'contracts': m.contracts,
    }


# ── Test ───────────────────────────────────────────────────────────

@app.get("/test")
def test():
    return get_mod().test()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8830))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
