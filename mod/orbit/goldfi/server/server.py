import os
import sys
import json
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

# Add goldfi root to path so `goldfi.mod` import works,
# and add mod root so `mod` package imports work inside Mod
goldfi_root = os.path.join(os.path.dirname(__file__), '..')
mod_root = os.path.join(goldfi_root, '..', '..', '..')
sys.path.insert(0, goldfi_root)
sys.path.insert(0, mod_root)

app = FastAPI(title="GoldFi API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None

def get_mod():
    global _mod
    if _mod is None:
        from goldfi.mod import Mod
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
        config = {}
        if os.path.exists(config_path):
            with open(config_path) as f:
                config = json.load(f)
        _mod = Mod(config)
    return _mod

@app.get("/health")
def health():
    return {"status": "ok", "service": "goldfi"}

@app.get("/status")
def status():
    return get_mod().status()

@app.get("/leaderboard")
def leaderboard():
    return get_mod().leaderboard()

@app.get("/assets")
def assets():
    m = get_mod()
    return {
        "tracked": m.tracked_assets,
        "registry": {k: {ex: info.get("symbol") for ex, info in v.items()} for k, v in m.ASSETS.items()},
    }

@app.get("/prices")
def prices():
    return get_mod().get_prices()

@app.get("/rewards")
def rewards(epoch_id: Optional[str] = Query(None)):
    return get_mod().rewards(epoch_id)

@app.get("/history")
def history():
    return get_mod().history()

@app.get("/traders")
def traders():
    return get_mod()._load_traders()

@app.post("/register")
def register(address: str = Query(...), exchange: Optional[str] = Query(None)):
    return get_mod().register(address, exchange)

@app.post("/unregister")
def unregister(address: str = Query(...)):
    return get_mod().unregister(address)

@app.post("/sync")
def sync():
    return get_mod().sync()

@app.post("/start_epoch")
def start_epoch(inflation_pool: Optional[float] = Query(None)):
    return get_mod().start_epoch(inflation_pool)

@app.post("/end_epoch")
def end_epoch():
    return get_mod().end_epoch()

@app.get("/epoch/{epoch_id}")
def get_epoch(epoch_id: str):
    return get_mod()._load_epoch(epoch_id) or {"error": "Epoch not found"}

@app.get("/test")
def test():
    return get_mod().test()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 50095))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
