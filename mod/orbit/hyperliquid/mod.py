import os
import subprocess
import time
import json
import requests
import hmac
import hashlib
from typing import Dict, Any, Optional, List

import mod as m


class Mod:
    description = "Hyperliquid DEX - market data, trading, vaults, and trader analytics"
    fns = [
        'forward', 'serve', 'app', 'kill', 'status',
        'fetch_market_data', 'fetch_orderbook', 'fetch_candles', 'fetch_all_mids',
        'fetch_user_state', 'fetch_user_funding',
        'place_order', 'market_order', 'cancel_order', 'cancel_all_orders', 'modify_order',
        'get_open_orders', 'get_user_fills', 'get_position', 'get_balance', 'close_position',
        'list_vaults', 'get_vault_details', 'get_vault_performance', 'get_top_vaults',
        'deposit_to_vault', 'withdraw_from_vault', 'analyze_vault',
        'get_leaderboard', 'get_user_profile', 'get_user_pnl_history',
        'search_traders_by_volume', 'analyze_trader',
    ]
    api_port = 8919
    app_port = 3919

    def __init__(self, api_key=None, api_secret=None, testnet=False, **kwargs):
        self._dir = os.path.dirname(__file__)
        self.api_key = api_key or os.environ.get('HYPERLIQUID_API_KEY')
        self.api_secret = api_secret or os.environ.get('HYPERLIQUID_API_SECRET')
        self.testnet = testnet or os.environ.get('HYPERLIQUID_TESTNET', 'false').lower() == 'true'
        self.base_url = "https://api.hyperliquid-testnet.xyz" if self.testnet else "https://api.hyperliquid.xyz"
        self.info_url = f"{self.base_url}/info"
        self.exchange_url = f"{self.base_url}/exchange"
        self.wallet_address = os.environ.get('HYPERLIQUID_WALLET_ADDRESS', '')

    # ── Info / Fetch ──

    def _post_info(self, payload):
        r = requests.post(self.info_url, json=payload)
        r.raise_for_status()
        return r.json()

    def _post_exchange(self, payload):
        if not self.api_key:
            raise ValueError("API key required for exchange requests")
        headers = {"Content-Type": "application/json", "X-API-Key": self.api_key}
        r = requests.post(self.exchange_url, json=payload, headers=headers)
        r.raise_for_status()
        return r.json()

    def fetch_market_data(self, symbol: str = None) -> Dict[str, Any]:
        """Fetch market metadata and asset contexts"""
        return self._post_info({"type": "metaAndAssetCtxs"})

    def fetch_orderbook(self, symbol: str = "BTC") -> Dict[str, Any]:
        """Fetch L2 orderbook for a symbol"""
        return self._post_info({"type": "l2Book", "coin": symbol})

    def fetch_candles(self, symbol: str = "BTC", interval: str = "1h",
                      start_time: int = None, end_time: int = None) -> list:
        """Fetch OHLCV candlestick data"""
        now = int(time.time() * 1000)
        return self._post_info({
            "type": "candleSnapshot",
            "req": {
                "coin": symbol, "interval": interval,
                "startTime": start_time or now - 86400000,
                "endTime": end_time or now,
            }
        })

    def fetch_all_mids(self) -> Dict[str, str]:
        """Fetch mid prices for all assets"""
        return self._post_info({"type": "allMids"})

    def fetch_user_state(self, address: str = None) -> Dict[str, Any]:
        """Fetch user state (positions, balances, margin)"""
        address = address or self.wallet_address
        if not address:
            raise ValueError("address required")
        return self._post_info({"type": "clearinghouseState", "user": address})

    def fetch_user_funding(self, address: str = None, start_time: int = None,
                           end_time: int = None) -> list:
        """Fetch user funding history"""
        address = address or self.wallet_address
        return self._post_info({"type": "userFunding", "user": address,
                                "startTime": start_time, "endTime": end_time})

    # ── Trading ──

    def place_order(self, symbol: str, is_buy: bool, size: float, price: float,
                    order_type: str = "limit", reduce_only: bool = False,
                    post_only: bool = False, ioc: bool = False) -> Dict[str, Any]:
        """Place a limit order"""
        tif = "Ioc" if ioc else ("Alo" if post_only else "Gtc")
        return self._post_exchange({
            "type": "order",
            "orders": [{
                "coin": symbol, "is_buy": is_buy, "sz": size,
                "limit_px": price, "order_type": {"limit": {"tif": tif}},
                "reduce_only": reduce_only,
            }],
            "grouping": "na",
        })

    def market_order(self, symbol: str, is_buy: bool, size: float,
                     slippage: float = 0.05) -> Dict[str, Any]:
        """Place a market order with slippage protection"""
        mids = self.fetch_all_mids()
        mid = float(mids.get(symbol, 0))
        if mid == 0:
            price = 1000000 if is_buy else 0.01
        else:
            price = mid * (1 + slippage) if is_buy else mid * (1 - slippage)
        return self.place_order(symbol, is_buy, size, price, ioc=True)

    def cancel_order(self, symbol: str, order_id: int) -> Dict[str, Any]:
        """Cancel an order"""
        return self._post_exchange({"type": "cancel", "cancels": [{"coin": symbol, "o": order_id}]})

    def cancel_all_orders(self, symbol: str = None) -> Dict[str, Any]:
        """Cancel all open orders"""
        payload = {"type": "cancelAll"}
        if symbol:
            payload["coin"] = symbol
        return self._post_exchange(payload)

    def modify_order(self, symbol: str, order_id: int, new_price: float,
                     new_size: float) -> Dict[str, Any]:
        """Modify an existing order"""
        return self._post_exchange({
            "type": "modify",
            "modifies": [{"oid": order_id, "coin": symbol, "limit_px": new_price, "sz": new_size}],
        })

    # ── Account ──

    def get_open_orders(self, address: str = None) -> list:
        """Get open orders"""
        address = address or self.wallet_address
        return self._post_info({"type": "openOrders", "user": address})

    def get_user_fills(self, address: str = None) -> list:
        """Get trade fill history"""
        address = address or self.wallet_address
        return self._post_info({"type": "userFills", "user": address})

    def get_position(self, symbol: str, address: str = None) -> Optional[Dict[str, Any]]:
        """Get position for a specific symbol"""
        address = address or self.wallet_address
        state = self.fetch_user_state(address)
        for pos in state.get("assetPositions", []):
            if pos.get("position", {}).get("coin") == symbol:
                return pos
        return None

    def get_balance(self, address: str = None) -> Dict[str, Any]:
        """Get account balance"""
        address = address or self.wallet_address
        state = self.fetch_user_state(address)
        return {
            "marginSummary": state.get("marginSummary", {}),
            "crossMarginSummary": state.get("crossMarginSummary", {}),
        }

    def close_position(self, symbol: str, address: str = None) -> Dict[str, Any]:
        """Close entire position via market order"""
        address = address or self.wallet_address
        pos = self.get_position(symbol, address)
        if not pos:
            return {"error": "No position found"}
        szi = float(pos.get("position", {}).get("szi", 0))
        if szi == 0:
            return {"error": "Position size is zero"}
        return self.market_order(symbol, szi < 0, abs(szi))

    # ── Vaults ──

    def list_vaults(self) -> list:
        """List all vaults"""
        return self._post_info({"type": "vaults"})

    def get_vault_details(self, vault_address: str) -> Dict[str, Any]:
        """Get vault details"""
        return self._post_info({"type": "vaultDetails", "vaultAddress": vault_address})

    def get_vault_performance(self, vault_address: str, start_time: int = None,
                              end_time: int = None) -> Dict[str, Any]:
        """Get vault performance history"""
        return self._post_info({"type": "vaultHistoricalPnl", "vaultAddress": vault_address,
                                "startTime": start_time, "endTime": end_time})

    def get_top_vaults(self, sort_by: str = "pnl", limit: int = 10) -> list:
        """Get top vaults sorted by pnl/apy/tvl"""
        vaults = self.list_vaults()
        key_map = {"pnl": "pnl", "apy": "apy", "tvl": "tvl"}
        k = key_map.get(sort_by, "pnl")
        return sorted(vaults, key=lambda v: float(v.get(k, 0)), reverse=True)[:limit]

    def deposit_to_vault(self, vault_address: str, amount: float) -> Dict[str, Any]:
        """Deposit USDC to vault"""
        return self._post_exchange({"type": "vaultTransfer", "vaultAddress": vault_address,
                                    "isDeposit": True, "usd": amount})

    def withdraw_from_vault(self, vault_address: str, amount: float) -> Dict[str, Any]:
        """Withdraw USDC from vault"""
        return self._post_exchange({"type": "vaultTransfer", "vaultAddress": vault_address,
                                    "isDeposit": False, "usd": amount})

    def analyze_vault(self, vault_address: str) -> Dict[str, Any]:
        """Comprehensive vault analysis"""
        return {
            "details": self.get_vault_details(vault_address),
            "performance": self.get_vault_performance(vault_address),
        }

    # ── Traders ──

    def get_leaderboard(self, leaderboard_type: str = "pnl") -> list:
        """Get trader leaderboard"""
        return self._post_info({"type": "leaderboard", "leaderboardType": leaderboard_type})

    def get_user_profile(self, address: str) -> Dict[str, Any]:
        """Get trader profile"""
        return self._post_info({"type": "userProfile", "user": address})

    def get_user_pnl_history(self, address: str, start_time: int = None,
                             end_time: int = None) -> list:
        """Get trader PnL history"""
        return self._post_info({"type": "userHistoricalPnl", "user": address,
                                "startTime": start_time, "endTime": end_time})

    def get_user_trade_stats(self, address: str) -> Dict[str, Any]:
        """Get trader stats"""
        return self._post_info({"type": "userTradeStats", "user": address})

    def search_traders_by_volume(self, min_volume: float = 1000000) -> list:
        """Find high-volume traders"""
        lb = self.get_leaderboard("volume")
        return [t for t in lb if float(t.get("volume", 0)) >= min_volume]

    def analyze_trader(self, address: str) -> Dict[str, Any]:
        """Comprehensive trader analysis"""
        return {
            "profile": self.get_user_profile(address),
            "state": self.fetch_user_state(address),
            "recent_fills": self.get_user_fills(address),
            "pnl_history": self.get_user_pnl_history(address),
            "open_orders": self.get_open_orders(address),
            "stats": self.get_user_trade_stats(address),
        }

    # ── Forward (generic dispatch) ──

    def forward(self, fn: str = None, **kwargs) -> Any:
        """Generic function dispatch — call any fn by name"""
        if fn is None:
            return {"module": "hyperliquid", "fns": self.fns}
        if not hasattr(self, fn) or fn.startswith('_'):
            raise ValueError(f"unknown fn: {fn}")
        return getattr(self, fn)(**kwargs)

    # ── Serve / Kill / Status ──

    def serve(self, port=None, dev=True):
        """Start the Hyperliquid FastAPI server"""
        port = port or self.api_port
        cwd = self._dir
        cmd = f'uvicorn api:app --host 0.0.0.0 --port {port}'
        if dev:
            cmd += ' --reload'

        script = os.path.join(self._dir, '_serve.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod('pm.pm2')()
            name = 'hyperliquid-api'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2',
                    'url': f'http://localhost:{port}'}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess',
                    'pid': proc.pid, 'url': f'http://localhost:{port}'}

    def app(self, port=None, dev=True):
        """Start the Hyperliquid web dashboard"""
        port = port or self.app_port
        cwd = os.path.join(self._dir, 'app')
        if not os.path.exists(cwd):
            return {"error": "App directory not found"}

        cmd = f'npm run dev -- -p {port}' if dev else f'npm run start -- -p {port}'
        script = os.path.join(self._dir, '_app.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod('pm.pm2')()
            name = 'hyperliquid-app'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2',
                    'url': f'http://localhost:{port}'}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess',
                    'pid': proc.pid, 'url': f'http://localhost:{port}'}

    def kill(self, target='all'):
        """Stop hyperliquid services (api/app/all)"""
        results = {}
        try:
            pm2 = m.mod('pm.pm2')()
            if target in ('api', 'all'):
                if pm2.exists('hyperliquid-api'):
                    pm2.kill('hyperliquid-api')
                    results['api'] = 'stopped'
            if target in ('app', 'all'):
                if pm2.exists('hyperliquid-app'):
                    pm2.kill('hyperliquid-app')
                    results['app'] = 'stopped'
        except Exception as e:
            results['error'] = str(e)
        return results

    def status(self):
        """Check service status"""
        result = {"module": "hyperliquid", "testnet": self.testnet}
        try:
            pm2 = m.mod('pm.pm2')()
            result['api'] = 'running' if pm2.exists('hyperliquid-api') else 'stopped'
            result['app'] = 'running' if pm2.exists('hyperliquid-app') else 'stopped'
        except Exception:
            result['api'] = 'unknown'
            result['app'] = 'unknown'
        return result
