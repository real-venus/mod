from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Hyperliquid", description="Hyperliquid DEX trading API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None

def get_mod():
    global _mod
    if _mod is None:
        from mod import Mod
        _mod = Mod()
    return _mod


# ── Health ──

@app.get("/health")
def health():
    return {"status": "ok", "module": "hyperliquid"}


# ── Market Data ──

@app.get("/market/{symbol}")
def market_data(symbol: str):
    return get_mod().fetch_market_data(symbol)

@app.get("/orderbook/{symbol}")
def orderbook(symbol: str):
    return get_mod().fetch_orderbook(symbol)

@app.get("/candles/{symbol}")
def candles(symbol: str, interval: str = "1h"):
    return get_mod().fetch_candles(symbol, interval)

@app.get("/mids")
def all_mids():
    return get_mod().fetch_all_mids()


# ── Account ──

@app.get("/user")
def user_state(address: Optional[str] = None):
    try:
        return get_mod().fetch_user_state(address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/positions")
def positions():
    mod = get_mod()
    if not mod.wallet_address:
        return []
    state = mod.fetch_user_state()
    out = []
    mids = {}
    try:
        mids = mod.fetch_all_mids()
    except Exception:
        pass
    for pos in state.get("assetPositions", []):
        szi = float(pos.get("position", {}).get("szi", 0))
        if szi == 0:
            continue
        entry = float(pos["position"].get("entryPx", 0))
        coin = pos["position"].get("coin", "")
        mark = float(mids.get(coin, entry))
        pnl = (mark - entry) * abs(szi) if szi > 0 else (entry - mark) * abs(szi)
        pnl_pct = (pnl / (entry * abs(szi)) * 100) if entry * abs(szi) > 0 else 0
        out.append({
            "symbol": coin, "size": szi, "entryPrice": entry, "markPrice": mark,
            "pnl": pnl, "pnlPercent": pnl_pct,
            "liquidationPrice": float(pos["position"].get("liquidationPx", 0)),
            "margin": float(pos["position"].get("marginUsed", 0)),
        })
    return out

@app.get("/balance")
def balance(address: Optional[str] = None):
    try:
        return get_mod().get_balance(address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/orders")
def open_orders(address: Optional[str] = None):
    return get_mod().get_open_orders(address)

@app.get("/fills")
def fills(address: Optional[str] = None):
    return get_mod().get_user_fills(address)

@app.get("/stats")
def stats():
    mod = get_mod()
    if not mod.wallet_address:
        return {"totalValue": 0, "pnl": 0, "pnlPercent": 0, "openPositions": 0}
    state = mod.fetch_user_state()
    total_value = float(state.get("marginSummary", {}).get("accountValue", 0))
    total_pnl = 0
    open_pos = 0
    for pos in state.get("assetPositions", []):
        if float(pos.get("position", {}).get("szi", 0)) != 0:
            open_pos += 1
            total_pnl += float(pos.get("position", {}).get("unrealizedPnl", 0))
    return {
        "totalValue": total_value, "pnl": total_pnl,
        "pnlPercent": (total_pnl / total_value * 100) if total_value > 0 else 0,
        "openPositions": open_pos,
    }


# ── Trading ──

class OrderRequest(BaseModel):
    symbol: str
    is_buy: bool
    size: float
    price: Optional[float] = None
    order_type: str = "limit"
    reduce_only: bool = False

@app.post("/order")
async def place_order(order: OrderRequest):
    mod = get_mod()
    if order.order_type == "market":
        result = mod.market_order(order.symbol, order.is_buy, order.size)
    else:
        result = mod.place_order(order.symbol, order.is_buy, order.size,
                                 order.price, reduce_only=order.reduce_only)
    return {"success": True, "order": result}

@app.delete("/order/{symbol}/{order_id}")
def cancel_order(symbol: str, order_id: int):
    return {"success": True, "result": get_mod().cancel_order(symbol, order_id)}

@app.post("/position/{symbol}/close")
def close_position(symbol: str):
    result = get_mod().close_position(symbol)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "result": result}


# ── Vaults ──

@app.get("/vaults")
def vaults():
    return get_mod().list_vaults()

@app.get("/vaults/top")
def top_vaults(sort_by: str = "pnl", limit: int = 10):
    return get_mod().get_top_vaults(sort_by, limit)

@app.get("/vault/{vault_address}")
def vault_details(vault_address: str):
    return get_mod().get_vault_details(vault_address)

@app.get("/vault/{vault_address}/performance")
def vault_performance(vault_address: str):
    return get_mod().get_vault_performance(vault_address)

@app.get("/vault/{vault_address}/analyze")
def vault_analyze(vault_address: str):
    return get_mod().analyze_vault(vault_address)

class VaultTransferRequest(BaseModel):
    vault_address: str
    amount: float

@app.post("/vault/deposit")
async def vault_deposit(req: VaultTransferRequest):
    return {"success": True, "result": get_mod().deposit_to_vault(req.vault_address, req.amount)}

@app.post("/vault/withdraw")
async def vault_withdraw(req: VaultTransferRequest):
    return {"success": True, "result": get_mod().withdraw_from_vault(req.vault_address, req.amount)}


# ── Traders ──

@app.get("/leaderboard")
def leaderboard(leaderboard_type: str = "pnl"):
    return get_mod().get_leaderboard(leaderboard_type)

@app.get("/trader/{address}")
def trader_profile(address: str):
    return get_mod().get_user_profile(address)

@app.get("/trader/{address}/stats")
def trader_stats(address: str):
    return get_mod().get_user_trade_stats(address)

@app.get("/trader/{address}/pnl")
def trader_pnl(address: str):
    return get_mod().get_user_pnl_history(address)

@app.get("/trader/{address}/analyze")
def trader_analyze(address: str):
    return get_mod().analyze_trader(address)

@app.get("/traders/top")
def top_traders(min_volume: float = 1000000):
    return get_mod().search_traders_by_volume(min_volume)


# ── Status ──

@app.get("/status")
def status():
    return get_mod().status()


# ── Generic Forward (mod protocol) ──

@app.post("/forward")
async def forward(req: Request):
    body = await req.json()
    fn = body.pop("fn", None)
    if fn is None:
        raise HTTPException(status_code=400, detail="missing fn")
    mod = get_mod()
    if not hasattr(mod, fn) or fn.startswith('_'):
        raise HTTPException(status_code=404, detail=f"unknown fn: {fn}")
    result = getattr(mod, fn)(**body)
    return {"result": result}


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", "8919"))
    uvicorn.run(app, host="0.0.0.0", port=port)
