import commune as c
import requests
from typing import Any, Dict, List, Optional, Union

class Polymarket(c.Module):
    """
    Minimal Polymarket interface - do anything you want.
    """
    
    base_url = "https://clob.polymarket.com"
    gamma_url = "https://gamma-api.polymarket.com"
    
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
    
    # Aliases for convenience
    m = markets
    s = search
    t = trending
    p = price
    ob = orderbook
