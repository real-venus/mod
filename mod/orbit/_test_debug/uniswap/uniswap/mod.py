"""Uniswap V3 Multichain Strategy Engine — Python wrapper for Rust backend"""

import json
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional

import os as _os
import pathlib as _pathlib

def _load_engine_url():
    """Load engine URL from config.json or fallback to default"""
    config_paths = [
        _pathlib.Path(__file__).parent.parent / "config.json",
        _pathlib.Path(__file__).parent / "config.json",
    ]
    for p in config_paths:
        if p.exists():
            try:
                with open(p) as f:
                    cfg = json.load(f)
                port = cfg.get("engine", {}).get("port", 8080)
                return f"http://localhost:{port}"
            except Exception:
                pass
    return "http://localhost:8080"

ENGINE_URL = _os.environ.get("ENGINE_URL") or _load_engine_url()


class UniswapV3Mod:
    """ANCHOR CLASS - Uniswap V3 Multichain Strategy Engine

    Rust backend with support for Base and Polygon chains.
    Strategies: DCA, Limit Order, Range LP, Momentum, Cross-Chain Arb, Rebalance.
    """

    description = """
    Uniswap V3 Multichain Strategy Engine (Rust backend):
    - Chains: Base (8453), Polygon (137)
    - Swap execution with MEV protection
    - Automated strategies: DCA, Limit Orders, Range LP, Momentum, Arb, Rebalance, Copy Trade
    - Copy trading: track wallets, scrape 30-day trade history, mirror trades
    - Token whitelist management
    - Real-time pool state monitoring
    - On-chain quoting via QuoterV2
    """

    def __init__(self, engine_url: str = ENGINE_URL):
        self.url = engine_url.rstrip("/")

    def _get(self, path: str, params: dict = None) -> dict:
        url = f"{self.url}{path}"
        if params:
            qs = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
            url += f"?{qs}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())

    def _post(self, path: str, data: dict) -> dict:
        url = f"{self.url}{path}"
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())

    def _delete(self, path: str) -> dict:
        url = f"{self.url}{path}"
        req = urllib.request.Request(url, method="DELETE")
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())

    # --- Core ---

    def health(self) -> dict:
        return self._get("/health")

    def chains(self) -> list:
        return self._get("/chains")

    def tokens(self, chain: str = "base") -> dict:
        return self._get("/tokens", {"chain": chain})

    def pools(self, chain: str = "base") -> list:
        return self._get("/pools", {"chain": chain})

    def pool_state(self, address: str, chain: str = "base") -> dict:
        return self._get(f"/pool/{address}", {"chain": chain})

    def quote(self, chain: str, token_in: str, token_out: str, amount: str, fee: int = 3000) -> dict:
        return self._get("/quote", {
            "chain": chain,
            "token_in": token_in,
            "token_out": token_out,
            "amount": amount,
            "fee": fee,
        })

    def balance(self, chain: str, token: str, wallet: str) -> dict:
        return self._get("/balance", {"chain": chain, "token": token, "wallet": wallet})

    def build_swap(self, chain: str, token_in: str, token_out: str,
                   amount_in: str, amount_out_min: str, recipient: str, fee: int = 3000) -> dict:
        return self._post("/swap/build", {
            "chain": chain,
            "token_in": token_in,
            "token_out": token_out,
            "amount_in": amount_in,
            "amount_out_min": amount_out_min,
            "recipient": recipient,
            "fee": fee,
        })

    # --- Strategies ---

    def list_strategies(self) -> list:
        return self._get("/strategies")

    def create_strategy(self, kind: str, chain: str, config: dict) -> dict:
        return self._post("/strategies", {"kind": kind, "chain": chain, "config": config})

    def get_strategy(self, strategy_id: str) -> dict:
        return self._get(f"/strategies/{strategy_id}")

    def delete_strategy(self, strategy_id: str) -> dict:
        return self._delete(f"/strategies/{strategy_id}")

    def pause_strategy(self, strategy_id: str) -> dict:
        return self._post(f"/strategies/{strategy_id}/pause", {})

    def resume_strategy(self, strategy_id: str) -> dict:
        return self._post(f"/strategies/{strategy_id}/resume", {})

    def strategy_history(self, strategy_id: str) -> list:
        return self._get(f"/strategies/{strategy_id}/history")

    # --- Convenience ---

    def dca(self, chain: str, token_in: str, token_out: str,
            amount_per_tick: str, interval_secs: int = 3600, fee: int = 3000) -> dict:
        """Create a DCA strategy"""
        return self.create_strategy("dca", chain, {
            "token_in": token_in,
            "token_out": token_out,
            "amount_per_tick": amount_per_tick,
            "fee": fee,
            "interval_secs": interval_secs,
        })

    def limit_order(self, chain: str, pool_address: str, token_in: str, token_out: str,
                    amount: str, target_price: float, direction: str = "above", fee: int = 3000) -> dict:
        """Create a limit order strategy"""
        return self.create_strategy("limit_order", chain, {
            "pool_address": pool_address,
            "token_in": token_in,
            "token_out": token_out,
            "amount": amount,
            "target_price": target_price,
            "direction": direction,
            "fee": fee,
        })

    def momentum(self, chain: str, pool_address: str, token_in: str, token_out: str,
                 amount: str, sma_short: int = 10, sma_long: int = 50, fee: int = 3000) -> dict:
        """Create a momentum strategy"""
        return self.create_strategy("momentum", chain, {
            "pool_address": pool_address,
            "token_in": token_in,
            "token_out": token_out,
            "amount": amount,
            "sma_short": sma_short,
            "sma_long": sma_long,
            "fee": fee,
        })

    def arb(self, pool_base: str, pool_polygon: str, amount: str,
            min_spread: float = 0.005, fee: int = 3000, **token_addrs) -> dict:
        """Create a cross-chain arb strategy"""
        config = {
            "pool_base": pool_base,
            "pool_polygon": pool_polygon,
            "amount": amount,
            "min_spread": min_spread,
            "fee": fee,
            **token_addrs,
        }
        return self.create_strategy("arb", "base", config)

    # --- Copy Trading ---

    def get_watchlist(self) -> list:
        """Get all watched wallets"""
        return self._get("/watchlist")

    def add_to_watchlist(self, address: str, nickname: str = None) -> dict:
        """Add a wallet to the watchlist"""
        return self._post("/watchlist", {"address": address, "nickname": nickname})

    def remove_from_watchlist(self, address: str) -> dict:
        """Remove a wallet from the watchlist"""
        return self._delete(f"/watchlist/{address}")

    def get_wallet_trades(self, address: str, chain: str = "base", days: int = 30) -> list:
        """Get scraped trades for a watched wallet"""
        return self._get(f"/watchlist/{address}/trades", {"chain": chain, "days": days})

    def get_wallet_performance(self, address: str) -> dict:
        """Get 30-day performance metrics for a wallet"""
        return self._get(f"/watchlist/{address}/performance")

    def sync_wallet(self, address: str) -> dict:
        """Trigger trade sync (scrape on-chain Swap events) for a wallet"""
        return self._post(f"/watchlist/{address}/sync", {})

    def copy_trade(self, wallet: str, chain: str = "base", max_trade_size: str = "1000000000000000000",
                   token_whitelist: list = None, interval_secs: int = 60) -> dict:
        """Create a copy trading strategy to mirror a wallet's trades"""
        config = {
            "wallet_address": wallet,
            "max_trade_size": max_trade_size,
            "slippage_tolerance": 0.01,
            "interval_secs": interval_secs,
        }
        if token_whitelist:
            config["token_whitelist"] = token_whitelist
        return self.create_strategy("copy_trade", chain, config)

    # --- Token Whitelist ---

    def get_whitelist(self, chain: str = "base") -> list:
        """Get whitelisted tokens for a chain"""
        return self._get("/whitelist", {"chain": chain})

    def add_to_whitelist(self, chain: str, address: str, symbol: str, decimals: int) -> dict:
        """Add a token to the whitelist"""
        return self._post("/whitelist", {
            "chain": chain,
            "address": address,
            "symbol": symbol,
            "decimals": decimals,
        })

    def remove_from_whitelist(self, chain: str, address: str) -> dict:
        """Remove a token from the whitelist"""
        return self._delete(f"/whitelist/{chain}/{address}")
