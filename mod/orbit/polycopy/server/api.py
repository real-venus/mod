"""
Polycopy API Server - FastAPI backend for Polymarket copy trading dashboard
"""
import sys
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import time
from datetime import datetime

# Add parent directory to path to import polycopy module
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    import mod as m
except ImportError:
    print("Warning: mod framework not found, using fallback import")
    # Fallback: direct import from polycopy module
    sys.path.insert(0, str(Path(__file__).parent.parent))

app = FastAPI(
    title="Polycopy API",
    description="Copy trading API for Polymarket",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
NETWORK = os.getenv("POLYCOPY_NETWORK", "testnet")
DRY_RUN = os.getenv("POLYCOPY_DRY_RUN", "true").lower() == "true"

# Initialize Polycopy client
try:
    # Import the Mod class from polycopy module
    from polycopy.mod import Mod
    polycopy = Mod()
    print("✓ Polycopy initialized successfully")
except Exception as e:
    print(f"Warning: Could not initialize Polycopy: {e}")
    polycopy = None


# Pydantic models
class TraderSearchRequest(BaseModel):
    query: Optional[str] = None
    min_volume: Optional[float] = None
    min_profit: Optional[float] = None
    limit: Optional[int] = 100


class MonitorRequest(BaseModel):
    address: str
    dry_run: Optional[bool] = True


class TradeRequest(BaseModel):
    token_id: str
    outcome: str
    amount: float
    side: str  # "BUY" or "SELL"


# Health check
@app.get("/")
async def root():
    return {
        "name": "Polycopy API",
        "version": "1.0.0",
        "status": "running",
        "network": NETWORK,
        "dry_run": DRY_RUN
    }


@app.get("/api/health")
async def health():
    try:
        # Get monitor status if available
        monitors = []
        if polycopy:
            try:
                status = polycopy.status()
                monitors = status.get("monitors", [])
            except:
                pass

        return {
            "success": True,
            "status": "healthy",
            "active_monitors": len(monitors),
            "network": NETWORK,
            "dry_run": DRY_RUN
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_stats():
    try:
        if not polycopy:
            return {"success": False, "error": "Polycopy not initialized"}

        # Get stats from mod framework storage
        stats = m.get('polycopy/stats', default={
            "total_trades": 0,
            "total_volume": 0,
            "success_count": 0,
            "fail_count": 0,
            "success_rate": 0,
            "active_positions": 0
        })

        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/traders/search")
async def search_traders(
    window: str = "30d",
    limit: int = 20,
    min_volume: float = 10000,
    min_apr: Optional[float] = None,
    sort_by: str = "apr"
):
    """Search for top Polymarket traders"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        # Use the trader search functionality
        filters = {
            'min_volume': min_volume,
            'sort_by': sort_by
        }

        if min_apr is not None:
            filters['min_apr'] = min_apr

        traders = polycopy.find_traders(
            window=window,
            limit=limit,
            **filters
        )

        return {
            "success": True,
            "traders": traders,
            "count": len(traders)
        }
    except Exception as e:
        print(f"Error searching traders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/traders/profile/{address}")
async def get_trader_profile(address: str, window: str = "30d"):
    """Get detailed trader profile"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        profile = polycopy.trader_profile(address, window=window)

        if not profile:
            raise HTTPException(status_code=404, detail="Trader not found")

        return {
            "success": True,
            "profile": profile
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching trader profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/traders/{address}/positions")
async def get_trader_positions(address: str):
    """Get trader's current positions"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        from polycopy.api import PolymarketAPI

        api = PolymarketAPI()
        result = api.get_user_positions(address)

        return {
            "success": True,
            "address": address,
            "positions": result.get("positions", []),
            "total_value": result.get("totalValue", "0")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/traders/{address}/trades")
async def get_trader_trades(address: str, limit: int = 100):
    """Get trader's recent trades"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        from polycopy.api import PolymarketAPI

        api = PolymarketAPI()
        result = api.get_user_trades(address, limit=limit)

        return {
            "success": True,
            "address": address,
            "trades": result.get("trades", []),
            "total_count": len(result.get("trades", []))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/monitor/start")
async def start_monitor(request: MonitorRequest):
    """Start monitoring a trader"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        result = polycopy.monitor(
            request.address,
            dry_run=request.dry_run
        )

        return {
            "success": True,
            "message": f"Started monitoring {request.address}",
            "dry_run": request.dry_run,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/monitor/stop")
async def stop_monitor():
    """Stop all monitors"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        result = polycopy.stop()

        return {
            "success": True,
            "message": "Stopped all monitors",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/vaults")
async def get_vaults():
    """Get copy trading vaults/strategies"""
    try:
        # Vaults are essentially saved copy trading configurations
        # Return configured addresses and their performance
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        # Get all configured copy trading setups
        config = m.get('polycopy/config', default={})
        addresses = config.get('addresses', [])

        vaults = []
        for address in addresses:
            try:
                profile = polycopy.trader_profile(address, window='30d')
                vaults.append({
                    'id': address,
                    'address': address,
                    'name': f"Copy Trader {address[:8]}...",
                    'apr': profile.get('apr', 0),
                    'volume': profile.get('volume', 0),
                    'pnl': profile.get('pnl', 0),
                    'active': True
                })
            except Exception as e:
                print(f"Error loading vault for {address}: {e}")
                continue

        return {
            "success": True,
            "vaults": vaults,
            "count": len(vaults)
        }
    except Exception as e:
        print(f"Error fetching vaults: {e}")
        return {
            "success": False,
            "vaults": [],
            "count": 0,
            "error": str(e)
        }


@app.get("/api/config")
async def get_config():
    """Get polycopy configuration"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        config = polycopy.config

        return {
            "success": True,
            "config": config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/config")
async def update_config(config_update: Dict[str, Any]):
    """Update polycopy configuration"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        polycopy.config_update(**config_update)

        return {
            "success": True,
            "message": "Configuration updated",
            "config": polycopy.config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/monitor/status")
async def monitor_status():
    """Get monitor status"""
    try:
        if not polycopy:
            raise HTTPException(status_code=500, detail="Polycopy not initialized")

        status = polycopy.status()

        return {
            "success": True,
            "status": status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
