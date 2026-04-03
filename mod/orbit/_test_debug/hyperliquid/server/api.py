"""
Hyperliquid API Server - FastAPI backend for Hyperliquid trading dashboard
"""
import sys
import os
from pathlib import Path

# Add parent directory to path FIRST before any hyperliquid imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import time
from datetime import datetime
from hyperliquid.mod import HyperliquidMod

try:
    # Try to import mod framework from orbit parent
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    import mod as m
except ImportError:
    print("Warning: mod framework not found")
    m = None

# Polymarket removed - focusing on Hyperliquid only

app = FastAPI(
    title="Hyperliquid API",
    description="Trading API for Hyperliquid DEX",
    version="1.0.0"
)

hl = HyperliquidMod()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
TESTNET = os.getenv("HYPERLIQUID_TESTNET", "true").lower() == "true"
WALLET_ADDRESS = os.getenv("HYPERLIQUID_WALLET_ADDRESS", "")
API_KEY = os.getenv("HYPERLIQUID_API_KEY", "")
API_SECRET = os.getenv("HYPERLIQUID_API_SECRET", "")

# Initialize Hyperliquid client
try:
    from hyperliquid.mod import HyperliquidMod
    hl = HyperliquidMod(
        api_key=API_KEY if API_KEY else None,
        api_secret=API_SECRET if API_SECRET else None,
        testnet=TESTNET
    )
    print(f"✓ Hyperliquid client initialized (testnet={TESTNET})")
except Exception as e:
    print(f"Error initializing Hyperliquid: {e}")
    hl = None



# Pydantic Models
class OrderRequest(BaseModel):
    symbol: str
    is_buy: bool
    size: float
    price: Optional[float] = None
    order_type: str = "limit"
    reduce_only: bool = False


class CancelOrderRequest(BaseModel):
    symbol: str
    order_id: int


# Routes
@app.get("/")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "hyperliquid-api",
        "testnet": TESTNET,
        "timestamp": datetime.now().isoformat(),
        "wallet": WALLET_ADDRESS if WALLET_ADDRESS else None,
    }


@app.get("/market/{symbol}")
async def get_market_data(symbol: str):
    """Get market data for a symbol"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        data = hl.fetch_market_data(symbol)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/orderbook/{symbol}")
async def get_orderbook(symbol: str):
    """Get L2 orderbook for a symbol"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        book = hl.fetch_orderbook(symbol)

        # Transform to expected format
        asks = []
        bids = []

        if 'levels' in book:
            for level in book['levels']:
                if level[0].get('px') and level[0].get('sz'):
                    price = float(level[0]['px'])
                    size = float(level[0]['sz'])
                    asks.append({
                        'price': price,
                        'size': size,
                        'total': size
                    })

            for level in book['levels']:
                if level[1].get('px') and level[1].get('sz'):
                    price = float(level[1]['px'])
                    size = float(level[1]['sz'])
                    bids.append({
                        'price': price,
                        'size': size,
                        'total': size
                    })

        # Calculate cumulative totals
        total = 0
        for ask in asks:
            total += ask['size']
            ask['total'] = total

        total = 0
        for bid in bids:
            total += bid['size']
            bid['total'] = total

        return {
            'asks': asks[:20],
            'bids': bids[:20]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/candles/{symbol}")
async def get_candles(symbol: str, interval: str = "1h"):
    """Get candlestick data"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        candles = hl.fetch_candles(symbol, interval)

        # Transform to chart format
        chart_data = []
        for candle in candles:
            if isinstance(candle, dict):
                chart_data.append({
                    'time': datetime.fromtimestamp(candle.get('t', 0) / 1000).strftime('%H:%M'),
                    'open': float(candle.get('o', 0)),
                    'high': float(candle.get('h', 0)),
                    'low': float(candle.get('l', 0)),
                    'close': float(candle.get('c', 0)),
                    'volume': float(candle.get('v', 0)),
                })

        return chart_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/order")
async def place_order(order: OrderRequest):
    """Place a new order"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    if not API_KEY or not API_SECRET:
        raise HTTPException(status_code=401, detail="API credentials not configured")

    try:
        if order.order_type == "market":
            result = hl.market_order(
                symbol=order.symbol,
                is_buy=order.is_buy,
                size=order.size
            )
        else:
            result = hl.place_order(
                symbol=order.symbol,
                is_buy=order.is_buy,
                size=order.size,
                price=order.price,
                reduce_only=order.reduce_only
            )

        return {
            "success": True,
            "order": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/order/{symbol}/{order_id}")
async def cancel_order(symbol: str, order_id: int):
    """Cancel an order"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    if not API_KEY or not API_SECRET:
        raise HTTPException(status_code=401, detail="API credentials not configured")

    try:
        result = hl.cancel_order(symbol, order_id)
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/positions")
async def get_positions():
    """Get current positions"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    if not WALLET_ADDRESS:
        return []

    try:
        state = hl.fetch_user_state(WALLET_ADDRESS)

        positions = []
        if 'assetPositions' in state:
            for pos in state['assetPositions']:
                if float(pos.get('position', {}).get('szi', 0)) != 0:
                    size = float(pos['position']['szi'])
                    entry_px = float(pos['position'].get('entryPx', 0))

                    # Get current mark price
                    mark_px = entry_px  # Fallback
                    try:
                        mids = hl.fetch_all_mids()
                        coin = pos['position'].get('coin', '')
                        if coin in mids:
                            mark_px = float(mids[coin])
                    except:
                        pass

                    pnl = (mark_px - entry_px) * abs(size) if size > 0 else (entry_px - mark_px) * abs(size)
                    pnl_percent = (pnl / (entry_px * abs(size))) * 100 if entry_px * abs(size) > 0 else 0

                    positions.append({
                        'symbol': pos['position'].get('coin', 'UNKNOWN'),
                        'size': size,
                        'entryPrice': entry_px,
                        'markPrice': mark_px,
                        'pnl': pnl,
                        'pnlPercent': pnl_percent,
                        'liquidationPrice': float(pos['position'].get('liquidationPx', 0)),
                        'margin': float(pos['position'].get('marginUsed', 0)),
                    })

        return positions
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/position/{symbol}/close")
async def close_position(symbol: str):
    """Close a position"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    if not API_KEY or not API_SECRET or not WALLET_ADDRESS:
        raise HTTPException(status_code=401, detail="API credentials or wallet not configured")

    try:
        # Get current position
        state = hl.fetch_user_state(WALLET_ADDRESS)
        size = 0

        for pos in state.get('assetPositions', []):
            if pos['position'].get('coin') == symbol:
                size = float(pos['position'].get('szi', 0))
                break

        if size == 0:
            raise HTTPException(status_code=400, detail=f"No open position for {symbol}")

        # Place opposite market order to close
        result = hl.market_order(
            symbol=symbol,
            is_buy=size < 0,  # If short (negative), buy to close
            size=abs(size)
        )

        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/stats")
async def get_stats():
    """Get account statistics"""
    if not hl or not WALLET_ADDRESS:
        return {
            "totalValue": 0,
            "pnl": 0,
            "pnlPercent": 0,
            "openPositions": 0
        }

    try:
        state = hl.fetch_user_state(WALLET_ADDRESS)

        total_value = float(state.get('marginSummary', {}).get('accountValue', 0))
        total_pnl = 0
        open_positions = 0

        for pos in state.get('assetPositions', []):
            size = float(pos.get('position', {}).get('szi', 0))
            if size != 0:
                open_positions += 1
                unrealized_pnl = float(pos.get('position', {}).get('unrealizedPnl', 0))
                total_pnl += unrealized_pnl

        pnl_percent = (total_pnl / total_value * 100) if total_value > 0 else 0

        return {
            "totalValue": total_value,
            "pnl": total_pnl,
            "pnlPercent": pnl_percent,
            "openPositions": open_positions
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/user")
async def get_user_state(address: Optional[str] = None):
    """Get user state"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    addr = address or WALLET_ADDRESS
    if not addr:
        raise HTTPException(status_code=400, detail="No wallet address provided")

    try:
        state = hl.fetch_user_state(addr)
        return state
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# VAULT ENDPOINTS
# ============================================================================

@app.get("/vaults")
async def get_vaults():
    """Get all available vaults"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        vaults = hl.list_vaults()
        return vaults
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/vaults/top")
async def get_top_vaults(sort_by: str = "pnl", limit: int = 10):
    """Get top performing vaults"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        vaults = hl.get_top_vaults(sort_by=sort_by, limit=limit)
        return vaults
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/vaults/leaderboard")
async def get_vault_leaderboard():
    """Get vault performance leaderboard"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        leaderboard = hl.get_vault_leaderboard()
        return leaderboard
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/vault/{vault_address}")
async def get_vault_details(vault_address: str):
    """Get detailed vault information"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        details = hl.get_vault_details(vault_address)
        return details
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/vault/{vault_address}/performance")
async def get_vault_performance(vault_address: str):
    """Get vault performance history"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        performance = hl.get_vault_performance(vault_address)
        return performance
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/vault/{vault_address}/analyze")
async def analyze_vault(vault_address: str):
    """Get comprehensive vault analysis"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        analysis = hl.analyze_vault(vault_address)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class VaultDepositRequest(BaseModel):
    vault_address: str
    amount: float


@app.post("/vault/deposit")
async def deposit_to_vault(request: VaultDepositRequest):
    """Deposit USDC to a vault"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    if not API_KEY or not API_SECRET:
        raise HTTPException(status_code=401, detail="API credentials not configured")

    try:
        result = hl.deposit_to_vault(request.vault_address, request.amount)
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/vault/withdraw")
async def withdraw_from_vault(request: VaultDepositRequest):
    """Withdraw USDC from a vault"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    if not API_KEY or not API_SECRET:
        raise HTTPException(status_code=401, detail="API credentials not configured")

    try:
        result = hl.withdraw_from_vault(request.vault_address, request.amount)
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# TRADER EXPLORATION ENDPOINTS
# ============================================================================

@app.get("/leaderboard")
async def get_leaderboard(leaderboard_type: str = "pnl"):
    """Get trader leaderboard (pnl, roi, volume)"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        leaderboard = hl.get_leaderboard(leaderboard_type)
        return leaderboard
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/trader/{address}")
async def get_trader_profile(address: str):
    """Get detailed trader profile"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        profile = hl.get_user_profile(address)
        return profile
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/trader/{address}/stats")
async def get_trader_stats(address: str):
    """Get trader statistics"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        stats = hl.get_user_trade_stats(address)
        return stats
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/trader/{address}/pnl")
async def get_trader_pnl(address: str):
    """Get trader PnL history"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        pnl = hl.get_user_pnl_history(address)
        return pnl
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/trader/{address}/analyze")
async def analyze_trader(address: str):
    """Get comprehensive trader analysis"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        analysis = hl.analyze_trader(address)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/traders/top")
async def get_top_traders(min_volume: float = 1000000):
    """Get high-volume traders"""
    if not hl:
        raise HTTPException(status_code=500, detail="Hyperliquid client not initialized")

    try:
        traders = hl.search_traders_by_volume(min_volume)
        return traders
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
