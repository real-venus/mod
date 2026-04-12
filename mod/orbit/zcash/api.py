import os
import sys

# Ensure module imports work
_root = os.path.dirname(__file__)
_mod_root = os.path.join(_root, '..', '..', '..')
sys.path.insert(0, _root)
sys.path.insert(0, _mod_root)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Zcash Explorer API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None

def get_mod():
    global _mod
    if _mod is None:
        from zcash.mod import Mod
        _mod = Mod()
    return _mod

# ── Health ──

@app.get("/health")
def health():
    return {"status": "ok", "module": "zcash"}

# ── Blockchain ──

@app.get("/info")
def info():
    result = get_mod().info()
    if 'error' in result:
        raise HTTPException(status_code=502, detail=result['error'])
    return result

@app.get("/block")
def block_latest():
    result = get_mod().block()
    if 'error' in result:
        raise HTTPException(status_code=502, detail=result['error'])
    return result

@app.get("/block/{height_or_hash}")
def block_by_id(height_or_hash: str):
    if height_or_hash.isdigit():
        result = get_mod().block(height=int(height_or_hash))
    else:
        result = get_mod().block(hash=height_or_hash)
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    return result

@app.get("/tx/{txid}")
def transaction(txid: str):
    result = get_mod().tx(txid=txid)
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    return result

@app.get("/address/{addr}")
def address(addr: str):
    result = get_mod().address(addr=addr)
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    return result

@app.get("/mempool")
def mempool():
    result = get_mod().mempool()
    if 'error' in result:
        raise HTTPException(status_code=502, detail=result['error'])
    return result

@app.get("/price")
def price():
    result = get_mod().price()
    if 'error' in result:
        raise HTTPException(status_code=502, detail=result['error'])
    return result

@app.get("/network")
def network():
    result = get_mod().network()
    if 'error' in result:
        raise HTTPException(status_code=502, detail=result['error'])
    return result

@app.get("/search/{query}")
def search(query: str):
    result = get_mod().search(query=query)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

# ── Generic Forward ──

@app.post("/forward")
async def forward(body: dict):
    fn = body.pop("fn", None)
    if fn is None:
        raise HTTPException(status_code=400, detail="missing fn")
    mod = get_mod()
    if not hasattr(mod, fn) or fn.startswith('_'):
        raise HTTPException(status_code=404, detail=f"unknown fn: {fn}")
    try:
        result = getattr(mod, fn)(**body)
        return {"result": result}
    except TypeError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── Runner ──

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8930))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)
