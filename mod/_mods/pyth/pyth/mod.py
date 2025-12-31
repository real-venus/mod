"""Pyth Network Price Feed Integration Module"""

import requests
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class PriceFeed:
    """Pyth price feed data structure"""
    id: str
    symbol: str
    asset_type: str
    description: str
    base: str
    quote: str


class BaseMod:
    """Pyth Network Price Feed Module - Multi-chain support"""
    
    description = "Pyth Network Price Feed Integration with multi-chain support"
    
    # Pyth contract addresses per chain
    PYTH_CONTRACTS = {
        "base": "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
        "ethereum": "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
        "arbitrum": "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
        "optimism": "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
        "polygon": "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
        "avalanche": "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
        "bsc": "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
    }
    
    # Pyth API endpoints
    PYTH_API_BASE = "https://hermes.pyth.network"
    PYTH_BENCHMARKS_API = "https://benchmarks.pyth.network/v1/shims/tradingview"
    
    def __init__(self, chain: str = "base"):
        """Initialize Pyth module with specified chain"""
        self.chain = chain.lower()
        self.pyth_contract = self.PYTH_CONTRACTS.get(self.chain)
        if not self.pyth_contract:
            raise ValueError(f"Unsupported chain: {chain}. Supported: {list(self.PYTH_CONTRACTS.keys())}")
    
    def get_all_price_feeds(self) -> List[PriceFeed]:
        """Fetch all available Pyth price feeds"""
        try:
            url = f"{self.PYTH_API_BASE}/v2/price_feeds"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            feeds = []
            for feed in data:
                feeds.append(PriceFeed(
                    id=feed.get('id', ''),
                    symbol=feed.get('attributes', {}).get('symbol', ''),
                    asset_type=feed.get('attributes', {}).get('asset_type', ''),
                    description=feed.get('attributes', {}).get('description', ''),
                    base=feed.get('attributes', {}).get('base', ''),
                    quote=feed.get('attributes', {}).get('quote', '')
                ))
            
            return feeds
        except Exception as e:
            return [{"error": str(e)}]
    
    def get_price_feeds_by_type(self, asset_type: str = "crypto") -> List[PriceFeed]:
        """Get price feeds filtered by asset type (crypto, equity, fx, metal, rates)"""
        all_feeds = self.get_all_price_feeds()
        return [feed for feed in all_feeds if isinstance(feed, PriceFeed) and feed.asset_type == asset_type]
    
    def get_latest_price(self, price_feed_id: str) -> Dict:
        """Get latest price for a specific feed ID"""
        try:
            url = f"{self.PYTH_API_BASE}/v2/updates/price/latest"
            params = {"ids[]": price_feed_id}
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def get_price_by_symbol(self, symbol: str) -> Optional[Dict]:
        """Get price by symbol (e.g., 'BTC/USD')"""
        feeds = self.get_all_price_feeds()
        for feed in feeds:
            if isinstance(feed, PriceFeed) and feed.symbol.upper() == symbol.upper():
                return self.get_latest_price(feed.id)
        return {"error": f"Symbol {symbol} not found"}
    
    def list_crypto_feeds(self) -> List[Dict[str, str]]:
        """List all cryptocurrency price feeds"""
        crypto_feeds = self.get_price_feeds_by_type("crypto")
        return [
            {
                "id": feed.id,
                "symbol": feed.symbol,
                "description": feed.description,
                "base": feed.base,
                "quote": feed.quote
            }
            for feed in crypto_feeds if isinstance(feed, PriceFeed)
        ]
    
    def list_equity_feeds(self) -> List[Dict[str, str]]:
        """List all equity/stock price feeds"""
        equity_feeds = self.get_price_feeds_by_type("equity")
        return [
            {
                "id": feed.id,
                "symbol": feed.symbol,
                "description": feed.description,
                "base": feed.base,
                "quote": feed.quote
            }
            for feed in equity_feeds if isinstance(feed, PriceFeed)
        ]
    
    def list_fx_feeds(self) -> List[Dict[str, str]]:
        """List all foreign exchange price feeds"""
        fx_feeds = self.get_price_feeds_by_type("fx")
        return [
            {
                "id": feed.id,
                "symbol": feed.symbol,
                "description": feed.description,
                "base": feed.base,
                "quote": feed.quote
            }
            for feed in fx_feeds if isinstance(feed, PriceFeed)
        ]
    
    def get_supported_chains(self) -> List[str]:
        """Get list of supported blockchain networks"""
        return list(self.PYTH_CONTRACTS.keys())
    
    def get_chain_contract(self, chain: str = None) -> str:
        """Get Pyth contract address for specified chain"""
        target_chain = chain.lower() if chain else self.chain
        return self.PYTH_CONTRACTS.get(target_chain, "Chain not supported")
    
    def switch_chain(self, chain: str):
        """Switch to a different blockchain network"""
        chain = chain.lower()
        if chain not in self.PYTH_CONTRACTS:
            raise ValueError(f"Unsupported chain: {chain}. Supported: {list(self.PYTH_CONTRACTS.keys())}")
        self.chain = chain
        self.pyth_contract = self.PYTH_CONTRACTS[chain]
        return f"Switched to {chain} - Contract: {self.pyth_contract}"
    
    def get_feed_info(self) -> Dict:
        """Get comprehensive feed information for current chain"""
        return {
            "chain": self.chain,
            "pyth_contract": self.pyth_contract,
            "supported_chains": self.get_supported_chains(),
            "api_base": self.PYTH_API_BASE,
            "total_feeds": len(self.get_all_price_feeds())
        }
