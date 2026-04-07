"""
polymarket - prediction market interface with trading, data, scraping & backtesting

Usage:
    import mod as m
    p = m.mod('polymarket')()
    p.search("election")
    p.trending()
    p.serve()                         # start API + app
    p.serve(api_only=True)            # API only
"""
import os
import json
import subprocess
import requests
from typing import Any, Dict, List, Optional, Union

import mod as c


class Polymarket(c.Mod):
    """
    Full Polymarket interface with Rust-powered trading, scraping, and backtesting.

    Usage:
        p = Polymarket()                          # read-only
        p = Polymarket(private_key="0x...")        # with trading

        # Markets
        p.search("election")
        p.trending()
        p.markets()
        p.market(condition_id)
        p.orderbook(token_id)

        # Trading (requires private_key)
        p.auth()
        p.buy(token_id, price=0.5, size=10)
        p.sell(token_id, price=0.7, size=10)
        p.positions()

        # Server
        p.serve()                                  # start API + Next.js app
        p.kill()                                   # stop services
        p.status()                                 # check services
    """

    name = 'polymarket'
    description = 'Polymarket prediction market — trading, data, scraping, backtesting'

    base_url = "https://clob.polymarket.com"
    gamma_url = "https://gamma-api.polymarket.com"
    data_url = "https://data-api.polymarket.com"

    api_port = 50091
    app_port = 3091

    def __init__(self, private_key: str = None, db_path: str = None, **kwargs):
        self.private_key = private_key
        self.session = requests.Session()
        self._engine = None
        self._db_path = db_path
        self._dir = os.path.dirname(os.path.dirname(__file__))    # polymarket/ (project root)
        self._mod_dir = os.path.dirname(__file__)                  # polymarket/polymarket/ (anchor)
        self._app_dir = os.path.join(self._dir, 'app')

    @property
    def engine(self):
        """Lazy-load the Rust engine"""
        if self._engine is None:
            try:
                from polymarket_rs import PolymarketEngine
                self._engine = PolymarketEngine(
                    private_key=self.private_key,
                    db_path=self._db_path,
                )
            except ImportError:
                return None
        return self._engine

    # ═══════════════════════════════════
    #  SERVE
    # ═══════════════════════════════════

    def serve(self, api_port=None, app_port=None, dev=True, api_only=False, app_only=False):
        """
        Start the Polymarket server (FastAPI) and/or the Next.js app.

        Args:
            api_port:  API server port (default 50091)
            app_port:  Next.js app port (default 3091)
            dev:       run in dev mode (default True)
            api_only:  only start the API server
            app_only:  only start the Next.js app
        """
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port
        results = {}

        if not app_only:
            results['api'] = self._serve_api(api_port, dev=dev)

        if not api_only:
            results['app'] = self._serve_app(app_port, dev=dev)

        return results

    def _serve_api(self, port=None, dev=True):
        """Start the FastAPI server (server.py lives in polymarket/polymarket/)"""
        port = port or self.api_port
        cwd = self._mod_dir

        if dev:
            cmd = f'uvicorn server:app --host 0.0.0.0 --port {port} --reload'
        else:
            cmd = f'uvicorn server:app --host 0.0.0.0 --port {port}'

        script = os.path.join(cwd, '_serve.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = c.mod('pm.pm2')()
            name = 'polymarket-api'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'name': name}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid}

    def _serve_app(self, port=None, dev=True):
        """Start the Next.js app (app/ lives at project root)"""
        port = port or self.app_port
        cwd = self._app_dir

        if not os.path.exists(os.path.join(cwd, 'node_modules')):
            subprocess.run(['npm', 'install'], cwd=cwd, capture_output=True)

        cmd = f'npm run {"dev" if dev else "start"} -- -p {port}'

        script = os.path.join(cwd, '_serve.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\nexport NEXT_PUBLIC_API_URL=http://localhost:{self.api_port}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = c.mod('pm.pm2')()
            name = 'polymarket-app'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'name': name}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid}

    def kill(self, service=None):
        """
        Stop running services.

        Args:
            service: 'api', 'app', or None (both)
        """
        results = {}
        try:
            pm2 = c.mod('pm.pm2')()
            if service in (None, 'api') and pm2.exists('polymarket-api'):
                pm2.kill('polymarket-api')
                results['api'] = 'killed'
            if service in (None, 'app') and pm2.exists('polymarket-app'):
                pm2.kill('polymarket-app')
                results['app'] = 'killed'
        except Exception as e:
            results['error'] = str(e)
        return results

    def status(self):
        """Check if services are running"""
        results = {'api_port': self.api_port, 'app_port': self.app_port}
        try:
            pm2 = c.mod('pm.pm2')()
            results['api'] = 'running' if pm2.exists('polymarket-api') else 'stopped'
            results['app'] = 'running' if pm2.exists('polymarket-app') else 'stopped'
        except Exception:
            results['api'] = 'unknown'
            results['app'] = 'unknown'
        return results

    # ═══════════════════════════════════
    #  BUILD
    # ═══════════════════════════════════

    def build(self):
        """Build the Rust bindings (Cargo.toml + src/ live in polymarket/polymarket/)"""
        rs_dir = self._mod_dir
        print(f"Building polymarket-rs from {rs_dir}...")
        subprocess.run(['maturin', 'develop', '--release'], cwd=rs_dir, check=True)
        print("Build complete.")

    # ═══════════════════════════════════
    #  AUTH
    # ═══════════════════════════════════

    def auth(self):
        """Derive or create API credentials"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        return e.derive_api_key()

    def set_creds(self, api_key: str, secret: str, passphrase: str):
        """Set API credentials directly"""
        e = self.engine
        if e is None: return
        e.set_creds(api_key, secret, passphrase)

    @property
    def address(self):
        e = self.engine
        return e.address() if e else None

    # ═══════════════════════════════════
    #  TRADING
    # ═══════════════════════════════════

    def buy(self, token_id: str, price: float, size: float,
            order_type: str = "GTC", neg_risk: bool = False, expiration: int = None):
        """Buy shares"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        result = e.place_order(token_id, price, size, "BUY", order_type, neg_risk, expiration)
        return json.loads(result)

    def sell(self, token_id: str, price: float, size: float,
             order_type: str = "GTC", neg_risk: bool = False, expiration: int = None):
        """Sell shares"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        result = e.place_order(token_id, price, size, "SELL", order_type, neg_risk, expiration)
        return json.loads(result)

    def market_buy(self, token_id: str, size: float, neg_risk: bool = False):
        """Market buy (FOK at best ask)"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        return json.loads(e.market_order(token_id, size, "BUY", neg_risk))

    def market_sell(self, token_id: str, size: float, neg_risk: bool = False):
        """Market sell (FOK at best bid)"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        return json.loads(e.market_order(token_id, size, "SELL", neg_risk))

    def place_order(self, token_id: str, price: float, size: float, side: str,
                    order_type: str = "GTC", neg_risk: bool = False, expiration: int = None):
        """Place a limit order"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        return json.loads(e.place_order(token_id, price, size, side, order_type, neg_risk, expiration))

    def cancel(self, order_id: str):
        """Cancel an order"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        return json.loads(e.cancel_order(order_id))

    def cancel_all(self):
        """Cancel all open orders"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        return json.loads(e.cancel_all())

    def cancel_market(self, condition_id: str):
        """Cancel all orders for a market"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        return json.loads(e.cancel_market_orders(condition_id))

    def open_orders(self, market: str = None):
        """Get open orders"""
        e = self.engine
        if e is None: return []
        return json.loads(e.open_orders(market))

    def positions(self):
        """Get current positions"""
        e = self.engine
        if e is None: return []
        return json.loads(e.positions())

    def position_value(self):
        """Get total position value"""
        e = self.engine
        if e is None: return {}
        return json.loads(e.position_value())

    def trades(self, market: str = None, limit: int = None):
        """Get trade history"""
        e = self.engine
        if e is None: return []
        return json.loads(e.trades(market, limit))

    def heartbeat(self):
        """Send heartbeat to keep session alive"""
        e = self.engine
        if e is None: return {}
        return json.loads(e.heartbeat())

    # ═══════════════════════════════════
    #  MARKET DATA
    # ═══════════════════════════════════

    def markets(self, limit: int = 100, active: bool = True, order: str = None):
        """Get markets"""
        e = self.engine
        if e:
            return json.loads(e.markets(limit, None, active, not active, order))
        params = {"limit": limit, "active": str(active).lower()}
        return self.session.get(f"{self.gamma_url}/markets", params=params).json()

    def market(self, condition_id: str):
        """Get single market"""
        e = self.engine
        if e:
            return json.loads(e.market(condition_id))
        return self.session.get(f"{self.gamma_url}/markets/{condition_id}").json()

    def search(self, query: str):
        """Search markets"""
        e = self.engine
        if e:
            return json.loads(e.search(query))
        url = f"{self.gamma_url}/public-search"
        return self.session.get(url, params={"query": query}).json()

    def orderbook(self, token_id: str):
        """Get order book"""
        e = self.engine
        if e:
            return json.loads(e.orderbook(token_id))
        return self.session.get(f"{self.base_url}/order-book", params={"token_id": token_id}).json()

    def midpoint(self, token_id: str) -> float:
        """Get midpoint price"""
        e = self.engine
        if e:
            return e.midpoint(token_id)
        resp = self.session.get(f"{self.base_url}/midpoint-price", params={"token_id": token_id}).json()
        return float(resp.get("price", 0))

    def last_trade_price(self, token_id: str) -> float:
        """Get last trade price"""
        e = self.engine
        if e:
            return e.last_trade_price(token_id)
        resp = self.session.get(f"{self.base_url}/last-trade-price", params={"token_id": token_id}).json()
        return float(resp.get("price", 0))

    def price_history(self, condition_id: str):
        """Get price history from CLOB"""
        e = self.engine
        if e:
            return json.loads(e.price_history(condition_id))
        return self.session.get(f"{self.base_url}/market/{condition_id}/prices-history").json()

    def trending(self, limit: int = 20):
        """Get trending markets by volume"""
        e = self.engine
        if e:
            return json.loads(e.trending(limit))
        url = f"{self.gamma_url}/markets"
        return self.session.get(url, params={"limit": limit, "active": True, "order": "volume", "ascending": False}).json()

    def events(self, limit: int = 50, tag: str = None):
        """Get events"""
        e = self.engine
        if e:
            return json.loads(e.events(limit, None, True, False, None, None, tag))
        return self.session.get(f"{self.gamma_url}/events", params={"_limit": limit, "active": True}).json()

    def event(self, event_id: str):
        """Get single event"""
        e = self.engine
        if e:
            return json.loads(e.event(event_id))
        return self.session.get(f"{self.gamma_url}/events/{event_id}").json()

    def by_liquidity(self, limit: int = 20):
        """Get markets sorted by liquidity"""
        e = self.engine
        if e:
            return json.loads(e.by_liquidity(limit))
        return self.markets(limit=limit, order="liquidity")

    def ending_soon(self, limit: int = 20):
        """Get markets ending soon"""
        e = self.engine
        if e:
            return json.loads(e.ending_soon(limit))
        return self.markets(limit=limit, order="end_date")

    def tags(self):
        """Get all market tags/categories"""
        e = self.engine
        if e:
            return json.loads(e.tags())
        return self.session.get(f"{self.gamma_url}/tags").json()

    def server_time(self):
        """Get CLOB server time"""
        e = self.engine
        if e:
            return e.server_time()
        return self.session.get(f"{self.base_url}/server-time").json()

    # ═══════════════════════════════════
    #  WEBSOCKET
    # ═══════════════════════════════════

    def ws_market(self, token_ids: list):
        """Subscribe to market WebSocket"""
        e = self.engine
        if e is None: return
        e.ws_subscribe_market(token_ids)

    def ws_user(self, api_key: str, secret: str, passphrase: str, markets: list):
        """Subscribe to user WebSocket"""
        e = self.engine
        if e is None: return
        e.ws_subscribe_user_with_creds(api_key, secret, passphrase, markets)

    def ws_stop(self):
        """Stop WebSocket connections"""
        e = self.engine
        if e is None: return
        e.ws_stop()

    # ═══════════════════════════════════
    #  HISTORY SCRAPING
    # ═══════════════════════════════════

    def discover(self, count: int = 50):
        """Auto-discover and track top markets by volume"""
        e = self.engine
        if e is None: return 0
        return e.auto_discover(count)

    def track(self, condition_id: str, token_ids: list, question: str = "", neg_risk: bool = False):
        """Track a specific market for history scraping"""
        e = self.engine
        if e is None: return
        e.track_market(condition_id, token_ids, question, neg_risk)

    def scrape(self, interval: int = 60):
        """Start background history scraper"""
        e = self.engine
        if e is None: return
        e.start_scraper(interval)
        print(f"Scraper started (interval: {interval}s)")

    def scrape_stop(self):
        """Stop the background scraper"""
        e = self.engine
        if e is None: return
        e.stop_scraper()
        print("Scraper stopped")

    def scrape_status(self):
        """Get scraper status"""
        e = self.engine
        if e is None: return {}
        s = e.scraper_status()
        return {
            "running": s.running,
            "markets_tracked": s.markets_tracked,
            "price_points": s.total_price_points,
            "trades_saved": s.total_trades_saved,
            "last_scrape": s.last_scrape,
            "errors": s.errors,
        }

    # ═══════════════════════════════════
    #  STORED HISTORY
    # ═══════════════════════════════════

    def stored_prices(self, condition_id: str, start: int = 0, end: int = 9999999999):
        """Get stored price history"""
        e = self.engine
        if e is None: return []
        return json.loads(e.stored_prices(condition_id, start, end))

    def stored_trades(self, condition_id: str, start: int = 0, end: int = 9999999999):
        """Get stored trade history"""
        e = self.engine
        if e is None: return []
        return json.loads(e.stored_trades(condition_id, start, end))

    def stored_markets(self):
        """List all markets with stored data"""
        e = self.engine
        if e is None: return []
        return e.stored_markets()

    def store_stats(self):
        """Get store statistics"""
        e = self.engine
        if e is None: return {}
        s = e.store_stats()
        return {
            "markets": s.markets_tracked,
            "price_points": s.total_price_points,
            "trades": s.total_trades_saved,
            "last_update": s.last_scrape,
        }

    # ═══════════════════════════════════
    #  BACKTESTING
    # ═══════════════════════════════════

    def backtest(self, start: int, end: int, strategy: str = "threshold",
                 buy_threshold: float = 0.3, sell_threshold: float = 0.7,
                 initial_capital: float = 1000.0, position_size_pct: float = 10.0,
                 condition_ids: list = None):
        """Run a backtest on stored history data"""
        e = self.engine
        if e is None: return {"error": "rust engine not available"}
        result = e.quick_backtest(
            start, end, strategy, buy_threshold, sell_threshold,
            initial_capital, position_size_pct, condition_ids or [],
        )
        return {
            "pnl": result.total_pnl,
            "return_pct": result.total_return_pct,
            "win_rate": result.win_rate,
            "total_trades": result.total_trades,
            "winning": result.winning_trades,
            "losing": result.losing_trades,
            "max_drawdown_pct": result.max_drawdown_pct,
            "sharpe": result.sharpe_ratio,
            "final_capital": result.final_capital,
            "equity_curve": result.equity_curve,
            "trades": result.trades,
        }

    # ═══════════════════════════════════
    #  USER DATA (Python fallback)
    # ═══════════════════════════════════

    def get_user_positions(self, address: str) -> dict:
        """Get user positions with pagination"""
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
            except Exception:
                break
        return {"user": address, "positions": all_positions, "totalValue": self._calculate_total_value(all_positions)}

    def get_user_trades(self, address: str, limit: int = 50) -> dict:
        """Get user trade history"""
        try:
            url = f"{self.data_url}/users/{address}/trades"
            response = self.session.get(url, params={"limit": limit, "sort": "desc"}).json()
            trades = response.get('trades', response.get('data', response if isinstance(response, list) else []))
            return {"user": address, "trades": trades if isinstance(trades, list) else []}
        except Exception:
            return {"user": address, "trades": []}

    def _calculate_total_value(self, positions: list) -> str:
        return str(sum(float(p.get("currentValue", 0) or 0) for p in positions))

    # ═══════════════════════════════════
    #  TEST
    # ═══════════════════════════════════

    def test(self):
        """Test the polymarket module"""
        results = {}
        s = self.search("test")
        results['search'] = type(s) in (list, dict)
        t = self.trending(5)
        results['trending'] = type(t) in (list, dict)
        m = self.markets(5)
        results['markets'] = type(m) in (list, dict)
        st = self.server_time()
        results['server_time'] = st is not None
        results['engine'] = self.engine is not None
        return results

    # Aliases
    m = markets
    s = search
    t = trending
    ob = orderbook
    b = buy
    sl = sell
    mb = market_buy
    ms = market_sell
