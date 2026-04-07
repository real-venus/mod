"""Polymarket API — FastAPI server backed by polymarket-rs Rust engine."""

import os
from typing import Optional, List

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Polymarket API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None


def get_mod():
    global _mod
    if _mod is None:
        from mod import Polymarket
        pk = os.environ.get("POLYMARKET_PRIVATE_KEY")
        db = os.environ.get("POLYMARKET_DB_PATH")
        _mod = Polymarket(private_key=pk, db_path=db)
    return _mod


# ── Health ────────────────────────────────────────────────────────

@app.get("/health")
def health():
    m = get_mod()
    return {"status": "ok", "engine": m.engine is not None}


@app.get("/server-time")
def server_time():
    return {"time": get_mod().server_time()}


# ── Markets ───────────────────────────────────────────────────────

@app.get("/markets")
def markets(
    limit: int = Query(100, ge=1, le=500),
    active: bool = Query(True),
    order: Optional[str] = Query(None),
):
    try:
        return get_mod().markets(limit=limit, active=active, order=order)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/markets/{condition_id}")
def market(condition_id: str):
    try:
        return get_mod().market(condition_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/search")
def search(q: str = Query(..., min_length=1)):
    try:
        return get_mod().search(q)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/trending")
def trending(limit: int = Query(20, ge=1, le=100)):
    try:
        return get_mod().trending(limit)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/by-liquidity")
def by_liquidity(limit: int = Query(20, ge=1, le=100)):
    try:
        return get_mod().by_liquidity(limit)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/ending-soon")
def ending_soon(limit: int = Query(20, ge=1, le=100)):
    try:
        return get_mod().ending_soon(limit)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/tags")
def tags():
    try:
        return get_mod().tags()
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Events ────────────────────────────────────────────────────────

@app.get("/events")
def events(limit: int = Query(50, ge=1, le=200), tag: Optional[str] = Query(None)):
    try:
        return get_mod().events(limit=limit, tag=tag)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/events/{event_id}")
def event(event_id: str):
    try:
        return get_mod().event(event_id)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Orderbook / Prices ───────────────────────────────────────────

@app.get("/orderbook/{token_id}")
def orderbook(token_id: str):
    try:
        return get_mod().orderbook(token_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/midpoint/{token_id}")
def midpoint(token_id: str):
    try:
        return {"token_id": token_id, "price": get_mod().midpoint(token_id)}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/last-trade-price/{token_id}")
def last_trade_price(token_id: str):
    try:
        return {"token_id": token_id, "price": get_mod().last_trade_price(token_id)}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/price-history/{condition_id}")
def price_history(condition_id: str):
    try:
        return get_mod().price_history(condition_id)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Trading ───────────────────────────────────────────────────────

class OrderRequest(BaseModel):
    token_id: str
    price: float
    size: float
    side: str = "BUY"
    order_type: str = "GTC"
    neg_risk: bool = False
    expiration: Optional[int] = None


class MarketOrderRequest(BaseModel):
    token_id: str
    size: float
    side: str = "BUY"
    neg_risk: bool = False


@app.post("/order")
def place_order(req: OrderRequest):
    try:
        return get_mod().place_order(
            req.token_id, req.price, req.size, req.side,
            req.order_type, req.neg_risk, req.expiration,
        )
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/market-order")
def market_order(req: MarketOrderRequest):
    m = get_mod()
    try:
        if req.side.upper() == "BUY":
            return m.market_buy(req.token_id, req.size, req.neg_risk)
        else:
            return m.market_sell(req.token_id, req.size, req.neg_risk)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/order/{order_id}")
def cancel_order(order_id: str):
    try:
        return get_mod().cancel(order_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/orders")
def cancel_all():
    try:
        return get_mod().cancel_all()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/orders")
def open_orders(market: Optional[str] = Query(None)):
    try:
        return get_mod().open_orders(market)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/positions")
def positions():
    try:
        return get_mod().positions()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/position-value")
def position_value():
    try:
        return get_mod().position_value()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/trades")
def trades(market: Optional[str] = Query(None), limit: Optional[int] = Query(None)):
    try:
        return get_mod().trades(market, limit)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── User Data ─────────────────────────────────────────────────────

@app.get("/users/{address}/positions")
def user_positions(address: str):
    try:
        return get_mod().get_user_positions(address)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/users/{address}/trades")
def user_trades(address: str, limit: int = Query(50, ge=1, le=500)):
    try:
        return get_mod().get_user_trades(address, limit)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Scraping ──────────────────────────────────────────────────────

@app.post("/scraper/discover")
def discover(count: int = Query(50, ge=1, le=500)):
    try:
        tracked = get_mod().discover(count)
        return {"tracked": tracked}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/scraper/start")
def scraper_start(interval: int = Query(60, ge=10)):
    try:
        get_mod().scrape(interval)
        return {"status": "started", "interval": interval}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/scraper/stop")
def scraper_stop():
    try:
        get_mod().scrape_stop()
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/scraper/status")
def scraper_status():
    try:
        return get_mod().scrape_status()
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Stored History ────────────────────────────────────────────────

@app.get("/history/prices/{condition_id}")
def stored_prices(
    condition_id: str,
    start: int = Query(0),
    end: int = Query(9999999999),
):
    try:
        return get_mod().stored_prices(condition_id, start, end)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/history/trades/{condition_id}")
def stored_trades(
    condition_id: str,
    start: int = Query(0),
    end: int = Query(9999999999),
):
    try:
        return get_mod().stored_trades(condition_id, start, end)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/history/markets")
def stored_markets():
    try:
        return get_mod().stored_markets()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/history/stats")
def store_stats():
    try:
        return get_mod().store_stats()
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Backtesting ───────────────────────────────────────────────────

class BacktestRequest(BaseModel):
    start: int
    end: int
    strategy: str = "threshold"
    buy_threshold: float = 0.3
    sell_threshold: float = 0.7
    initial_capital: float = 1000.0
    position_size_pct: float = 10.0
    condition_ids: Optional[List[str]] = None


@app.post("/backtest")
def backtest(req: BacktestRequest):
    try:
        return get_mod().backtest(
            req.start, req.end, req.strategy,
            req.buy_threshold, req.sell_threshold,
            req.initial_capital, req.position_size_pct,
            req.condition_ids,
        )
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 50091))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
