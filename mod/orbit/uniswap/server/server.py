"""Uniswap V3 API — FastAPI server wrapping the Uniswap connector."""

import os
import sys
from typing import Optional, Any

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

app = FastAPI(title="Uniswap V3 API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None

def get_mod():
    global _mod
    if _mod is None:
        from uniswap.mod import Mod
        _mod = Mod()
    return _mod


class SaveRequest(BaseModel):
    data: Any
    name: str
    chain: str = 'ethereum'


@app.get("/health")
def health():
    return get_mod().health()


@app.get("/chains")
def chains():
    return get_mod().chains()


@app.get("/pools")
def pools(
    chain: str = Query('ethereum'),
    limit: int = Query(20, ge=1, le=100),
    orderBy: str = Query('totalValueLockedUSD'),
    source: str = Query('auto'),
    update: bool = Query(False),
):
    try:
        return get_mod().get_pools(chain, limit, orderBy, source=source, update=update)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/pool/{pool_id}")
def pool(
    pool_id: str,
    chain: str = Query('ethereum'),
    source: str = Query('auto'),
    update: bool = Query(False),
):
    try:
        result = get_mod().get_pool(chain, pool_id, source=source, update=update)
        if not result:
            raise HTTPException(404, "Pool not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/pool/{pool_id}/history")
def pool_history(
    pool_id: str,
    chain: str = Query('ethereum'),
    days: int = Query(30),
    source: str = Query('auto'),
    update: bool = Query(False),
):
    try:
        return get_mod().get_pool_day_data(chain, pool_id, days, source=source, update=update)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/swaps")
def swaps(
    chain: str = Query('ethereum'),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(100, ge=1, le=10000),
    source: str = Query('auto'),
    update: bool = Query(False),
):
    try:
        return get_mod().get_swaps(chain, days, limit, source, update=update)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/swaps/{pool_id}")
def swaps_by_pool(
    pool_id: str,
    chain: str = Query('ethereum'),
    days: int = Query(30),
    limit: int = Query(100, ge=1, le=10000),
    source: str = Query('auto'),
    update: bool = Query(False),
):
    try:
        return get_mod().get_swaps_by_pool(chain, pool_id, days, limit, source, update=update)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/tokens")
def tokens(
    chain: str = Query('ethereum'),
    limit: int = Query(20, ge=1, le=100),
    source: str = Query('auto'),
    update: bool = Query(False),
):
    try:
        return get_mod().get_tokens(chain, limit, source=source, update=update)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/clear-cache")
def clear_cache(method: Optional[str] = Query(None)):
    return get_mod().clear_cache(method)


@app.post("/save")
def save(req: SaveRequest):
    try:
        return get_mod().save_data(req.data, req.name, req.chain)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/saved")
def list_saved(chain: Optional[str] = None):
    return get_mod().list_saved(chain)


@app.get("/saved/{filename}")
def load_saved(filename: str):
    try:
        return get_mod().load_data(filename)
    except FileNotFoundError:
        raise HTTPException(404, "File not found")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/saved/{filename}")
def delete_saved(filename: str):
    try:
        return get_mod().delete_data(filename)
    except FileNotFoundError:
        raise HTTPException(404, "File not found")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/test")
def test():
    return get_mod().test()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 50088))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
