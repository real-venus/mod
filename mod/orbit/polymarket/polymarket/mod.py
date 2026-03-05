import mod as c
import requests
from typing import Any, Dict, List, Optional, Union

class Polymarket(c.Mod):
    """
    Minimal Polymarket interface - do anything you want.
    """
    
    base_url = "https://clob.polymarket.com"
    gamma_url = "https://gamma-api.polymarket.com"
    data_url = "https://data-api.polymarket.com"

    def __init__(self, private_key: str = None):
        self.private_key = private_key or c.get_key().private_key
        self.session = requests.Session()
    
    def get(self, endpoint: str, params: dict = None) -> dict:
        """GET request to Polymarket API"""
        url = f"{self.base_url}{endpoint}"
        return self.session.get(url, params=params).json()
    
    def post(self, endpoint: str, data: dict = None) -> dict:
        """POST request to Polymarket API"""
        url = f"{self.base_url}{endpoint}"
        return self.session.post(url, json=data).json()
    
    def markets(self, limit: int = 100, active: bool = True) -> List[dict]:
        """Get all markets"""
        params = {"limit": limit, "active": str(active).lower()}
        return self.get("/markets", params)
    
    def market(self, condition_id: str) -> dict:
        """Get single market by condition ID"""
        return self.get(f"/markets/{condition_id}")
    
    def search(self, query: str, limit: int = 20) -> List[dict]:
        """Search markets by query"""
        url = f"{self.gamma_url}/markets"
        params = {"_q": query, "_limit": limit, "active": True}
        return self.session.get(url, params=params).json()
    
    def orderbook(self, token_id: str) -> dict:
        """Get orderbook for a token"""
        return self.get(f"/book", {"token_id": token_id})
    
    def price(self, token_id: str) -> dict:
        """Get current price for a token"""
        return self.get(f"/price", {"token_id": token_id})
    
    def prices(self, token_ids: List[str]) -> dict:
        """Get prices for multiple tokens"""
        return self.get(f"/prices", {"token_ids": ",".join(token_ids)})
    
    def trades(self, token_id: str = None, maker: str = None) -> List[dict]:
        """Get recent trades"""
        params = {}
        if token_id: params["token_id"] = token_id
        if maker: params["maker"] = maker
        return self.get("/trades", params)
    
    def midpoint(self, token_id: str) -> float:
        """Get midpoint price"""
        return float(self.get(f"/midpoint", {"token_id": token_id}).get("mid", 0))
    
    def spread(self, token_id: str) -> dict:
        """Get bid-ask spread"""
        return self.get(f"/spread", {"token_id": token_id})
    
    def trending(self, limit: int = 10) -> List[dict]:
        """Get trending markets"""
        url = f"{self.gamma_url}/markets"
        params = {"_limit": limit, "active": True, "_sort": "volume24hr:desc"}
        return self.session.get(url, params=params).json()
    
    def events(self, limit: int = 50) -> List[dict]:
        """Get events"""
        url = f"{self.gamma_url}/events"
        return self.session.get(url, params={"_limit": limit, "active": True}).json()
    
    def raw(self, method: str, url: str, **kwargs) -> Any:
        """Raw request - do literally anything"""
        return getattr(self.session, method.lower())(url, **kwargs).json()

    def get_user_positions(self, address: str) -> dict:
        """Get user positions with pagination support"""
        all_positions = []
        page = 0
        limit = 100
        has_more = True

        while has_more and page < 10:
            try:
                url = f"{self.data_url}/users/{address}/positions"
                params = {"active": True, "limit": limit, "offset": page * limit}
                response = self.session.get(url, params=params).json()

                positions = response.get('positions', response.get('data', response if isinstance(response, list) else []))
                if isinstance(positions, list):
                    all_positions.extend(positions)
                    has_more = len(positions) >= limit
                    page += 1
                else:
                    break
            except Exception as e:
                if page == 0:
                    return {"user": address, "positions": [], "totalValue": "0", "timestamp": ""}
                break

        return {
            "user": address,
            "positions": self._normalize_positions(all_positions),
            "totalValue": self._calculate_total_value(all_positions),
            "timestamp": ""
        }

    def get_user_trades(self, address: str, limit: int = 50) -> dict:
        """Get user trade history"""
        try:
            url = f"{self.data_url}/users/{address}/trades"
            params = {"limit": limit, "sort": "desc"}
            response = self.session.get(url, params=params).json()

            trades = response.get('trades', response.get('data', response if isinstance(response, list) else []))
            return {
                "user": address,
                "trades": self._normalize_trades(trades if isinstance(trades, list) else []),
                "totalTrades": len(trades) if isinstance(trades, list) else 0,
                "timestamp": ""
            }
        except Exception:
            return {"user": address, "trades": [], "totalTrades": 0, "timestamp": ""}

    def place_order(self, token_id: str, side: str, size: float, price: float) -> dict:
        """Place order on Polymarket CLOB"""
        try:
            endpoint = "/order"
            data = {
                "token_id": token_id,
                "side": side.upper(),
                "size": str(size),
                "price": str(price)
            }
            return self.post(endpoint, data)
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _normalize_positions(self, positions: list) -> list:
        """Normalize position data structure"""
        normalized = []
        for item in positions:
            if not item:
                continue
            normalized.append({
                "id": item.get("asset") or item.get("id") or item.get("positionId", ""),
                "market": {
                    "id": item.get("conditionId") or item.get("market_id") or item.get("marketId", ""),
                    "question": item.get("title") or item.get("question", ""),
                    "slug": item.get("slug", ""),
                },
                "outcome": item.get("outcome") or item.get("outcomeToken", ""),
                "quantity": str(item.get("size") or item.get("quantity", "0")),
                "price": str(item.get("curPrice") or item.get("avgPrice") or item.get("price", "0")),
                "value": str(item.get("currentValue") or "0"),
                "timestamp": ""
            })
        return normalized

    def _normalize_trades(self, trades: list) -> list:
        """Normalize trade data structure"""
        normalized = []
        for item in trades:
            if not item:
                continue
            normalized.append({
                "id": item.get("transactionHash") or item.get("id", ""),
                "market": {
                    "id": item.get("conditionId") or item.get("market_id", ""),
                    "question": item.get("title") or item.get("question", ""),
                },
                "outcome": item.get("outcome", ""),
                "side": item.get("side", "").lower(),
                "quantity": str(item.get("size") or item.get("quantity", "0")),
                "price": str(item.get("price", "0")),
                "timestamp": ""
            })
        return normalized

    def _calculate_total_value(self, positions: list) -> str:
        """Calculate total value of positions"""
        total = sum(float(p.get("currentValue", 0) or 0) for p in positions)
        return str(total)

    # Aliases for convenience
    m = markets
    s = search
    t = trending
    p = price
    ob = orderbook
