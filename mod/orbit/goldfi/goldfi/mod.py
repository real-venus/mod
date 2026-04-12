import json
import os
import time
import subprocess
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path

class Mod:
    description = """GoldFi - Quadratic reward trading competition for precious metals.
    Tracks gold/silver (and more) PnL on Hyperliquid & Uniswap, distributes
    inflation rewards using x^2 (profit) / -x^2 (loss). Weekly epochs."""

    # ── Asset registry: precious metals focus, extensible ────────────
    ASSETS = {
        'gold': {
            'hyperliquid': {'symbol': 'GOLD', 'name': 'Gold'},
            'uniswap': {
                'symbol': 'PAXG',
                'name': 'PAX Gold',
                'address': '0x45804880De22913dAFE09f4980848ECE6EcbAf78',  # PAXG on Ethereum
                'decimals': 18,
                'pair_token': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  # USDC
            },
        },
        'silver': {
            'hyperliquid': {'symbol': 'SILVER', 'name': 'Silver'},
            'uniswap': {
                'symbol': 'SLV',
                'name': 'Silver Token',
                'address': None,  # no major silver token yet on uniswap
                'decimals': 18,
                'pair_token': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            },
        },
    }

    @classmethod
    def add_asset(cls, name, hyperliquid_symbol=None, uniswap_address=None, uniswap_symbol=None, decimals=18):
        """Add a new tracked asset at runtime"""
        cls.ASSETS[name] = {
            'hyperliquid': {'symbol': hyperliquid_symbol or name.upper(), 'name': name.title()},
            'uniswap': {
                'symbol': uniswap_symbol or name.upper(),
                'name': name.title(),
                'address': uniswap_address,
                'decimals': decimals,
                'pair_token': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            },
        }

    def __init__(self, config=None):
        self.config = config or {}
        self.store_dir = Path(os.path.expanduser('~/.goldfi'))
        self.epochs_dir = self.store_dir / 'epochs'
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self.epochs_dir.mkdir(parents=True, exist_ok=True)
        self.traders_path = self.store_dir / 'traders.json'
        self.current_epoch_path = self.store_dir / 'current_epoch.json'
        self.default_exchange = self.config.get('default_exchange', 'hyperliquid')
        self.epoch_duration_days = self.config.get('epoch_duration_days', 7)
        self.default_inflation_pool = self.config.get('default_inflation_pool', 1000)
        self.tracked_assets = list(self.config.get('assets', self.ASSETS.keys()))
        self._exchanges = {}
        self.module_dir = Path(__file__).parent.parent
        api_cfg = self.config.get('api', {})
        app_cfg = self.config.get('app', {})
        self.api_port = api_cfg.get('port', self.config.get('api_port', 50095))
        self.app_port = app_cfg.get('port', self.config.get('app_port', 3095))

    # ── Service management ───────────────────────────────────────────

    def serve(self, api_port=None, app_port=None, dev=True):
        """Start the FastAPI server and Next.js app"""
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port
        results = {}
        log_dir = Path('/tmp/goldfi')
        log_dir.mkdir(parents=True, exist_ok=True)

        # Kill existing processes on these ports first
        self.kill()

        # Start API server
        server_dir = self.module_dir / 'server'
        server_path = server_dir / 'server.py'
        if server_path.exists():
            env = os.environ.copy()
            env['PORT'] = str(api_port)
            env['PYTHONPATH'] = str(self.module_dir.parent.parent.parent)

            if dev:
                api_log = open(log_dir / 'api.log', 'w')
                subprocess.Popen(
                    ['python3', '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0',
                     '--port', str(api_port), '--reload'],
                    cwd=str(server_dir),
                    env=env,
                    stdout=api_log,
                    stderr=subprocess.STDOUT,
                )
            else:
                subprocess.Popen(
                    ['pm2', 'start', str(server_path), '--name', 'goldfi-api',
                     '--interpreter', 'python3', '--', '--port', str(api_port)],
                    cwd=str(server_dir),
                    env=env,
                )
            results['api'] = f'http://localhost:{api_port}'
            results['api_log'] = str(log_dir / 'api.log')

        # Start Next.js app
        app_dir = self.module_dir / 'app'
        if app_dir.exists():
            env = os.environ.copy()
            env['NEXT_PUBLIC_API_URL'] = f'http://localhost:{api_port}'
            env['PORT'] = str(app_port)

            app_log = open(log_dir / 'app.log', 'w')
            if dev:
                subprocess.Popen(
                    ['npx', 'next', 'dev', '-p', str(app_port)],
                    cwd=str(app_dir),
                    env=env,
                    stdout=app_log,
                    stderr=subprocess.STDOUT,
                )
            else:
                subprocess.Popen(
                    ['npx', 'next', 'start', '-p', str(app_port)],
                    cwd=str(app_dir),
                    env=env,
                    stdout=app_log,
                    stderr=subprocess.STDOUT,
                )
            results['app'] = f'http://localhost:{app_port}'
            results['app_log'] = str(log_dir / 'app.log')

        results['dev'] = dev
        results['logs'] = str(log_dir)
        return results

    def kill(self):
        """Stop all GoldFi services"""
        import signal
        killed = []
        patterns = [
            f'uvicorn.*server:app.*{self.api_port}',
            f'next.*dev.*{self.app_port}',
        ]
        for pattern in patterns:
            try:
                result = subprocess.run(
                    ['pgrep', '-f', pattern],
                    capture_output=True, text=True
                )
                for pid in result.stdout.strip().split('\n'):
                    if pid:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(f'{pattern.split(".*")[0]}:{pid}')
            except Exception:
                pass
        return {'killed': killed}

    def health(self):
        """Check if services are running"""
        import requests as req
        status = {}
        try:
            r = req.get(f'http://localhost:{self.api_port}/health', timeout=2)
            status['api'] = r.json()
        except Exception:
            status['api'] = {'status': 'down'}
        return status

    def _tracked_symbols(self, exchange):
        """Get the list of tracked symbols for a given exchange"""
        symbols = []
        for asset_name in self.tracked_assets:
            asset = self.ASSETS.get(asset_name, {})
            ex_info = asset.get(exchange, {})
            if ex_info.get('symbol'):
                symbols.append(ex_info['symbol'])
        return symbols

    # ── Exchange connectors ──────────────────────────────────────────

    def _get_exchange(self, name):
        if name not in self._exchanges:
            import mod as m
            self._exchanges[name] = m.mod(name)()
        return self._exchanges[name]

    def _get_equity(self, address, exchange='hyperliquid'):
        """Get equity across only tracked precious-metal positions"""
        ex = self._get_exchange(exchange)
        tracked = self._tracked_symbols(exchange)
        if exchange == 'hyperliquid':
            state = ex.fetch_user_state(address)
            # Sum unrealized PnL + margin only for tracked asset positions
            positions = state.get('assetPositions', [])
            equity = 0.0
            for pos in positions:
                p = pos.get('position', {})
                coin = p.get('coin', '')
                if coin in tracked:
                    equity += float(p.get('unrealizedPnl', 0))
                    equity += float(p.get('marginUsed', 0))
            # Also include account-level USDC as base
            margin = state.get('marginSummary', state.get('crossMarginSummary', {}))
            equity += float(margin.get('accountValue', 0))
            return equity
        elif exchange == 'uniswap':
            total = 0.0
            for asset_name in self.tracked_assets:
                asset = self.ASSETS.get(asset_name, {})
                uni_info = asset.get('uniswap', {})
                token_addr = uni_info.get('address')
                if not token_addr:
                    continue
                try:
                    price_data = ex.get_price(token_addr, uni_info['pair_token'])
                    price = float(price_data.get('price', 0)) if isinstance(price_data, dict) else 0
                    # For uniswap we track price exposure, not wallet balance
                    # Actual balance tracking would need on-chain RPC call
                    total += price
                except Exception:
                    pass
            return total
        return 0.0

    def _get_fills(self, address, exchange='hyperliquid'):
        """Get trade fills filtered to tracked assets only"""
        ex = self._get_exchange(exchange)
        tracked = self._tracked_symbols(exchange)
        if exchange == 'hyperliquid':
            fills = ex.get_user_fills(address)
            return [f for f in fills if f.get('coin', '') in tracked]
        return []

    def _get_pnl_history(self, address, exchange='hyperliquid', start_time=None, end_time=None):
        ex = self._get_exchange(exchange)
        if exchange == 'hyperliquid':
            return ex.get_user_pnl_history(address, start_time=start_time, end_time=end_time)
        return []

    def get_prices(self):
        """Get current prices for all tracked assets across exchanges"""
        prices = {}
        for asset_name in self.tracked_assets:
            asset = self.ASSETS.get(asset_name, {})
            prices[asset_name] = {}
            # Hyperliquid mid price
            hl_sym = asset.get('hyperliquid', {}).get('symbol')
            if hl_sym:
                try:
                    ex = self._get_exchange('hyperliquid')
                    mids = ex.fetch_all_mids()
                    prices[asset_name]['hyperliquid'] = float(mids.get(hl_sym, 0))
                except Exception as e:
                    prices[asset_name]['hyperliquid'] = {'error': str(e)}
            # Uniswap price
            uni_info = asset.get('uniswap', {})
            if uni_info.get('address'):
                try:
                    ex = self._get_exchange('uniswap')
                    p = ex.get_price(uni_info['address'], uni_info['pair_token'])
                    prices[asset_name]['uniswap'] = float(p.get('price', 0)) if isinstance(p, dict) else 0
                except Exception as e:
                    prices[asset_name]['uniswap'] = {'error': str(e)}
        return prices

    def price_history(self, days=7, asset='gold'):
        """Get gold price from multiple sources for the past N days.
        Sources: CoinGecko (PAXG on-chain), Yahoo Finance (spot GC=F/SI=F),
                 Frankfurter (XAU via ECB rates as cross-check)."""
        results = {'asset': asset, 'days': days, 'sources': {}}

        # ── CoinGecko: PAXG (on-chain gold token) ────────────────────
        try:
            cg_ids = {'gold': 'pax-gold', 'silver': 'silver-token'}
            cg_id = cg_ids.get(asset, asset)
            url = f'https://api.coingecko.com/api/v3/coins/{cg_id}/market_chart'
            resp = requests.get(url, params={'vs_currency': 'usd', 'days': days}, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            by_date = {}
            for ts_ms, price in data.get('prices', []):
                d = datetime.utcfromtimestamp(ts_ms / 1000).strftime('%Y-%m-%d')
                by_date[d] = round(price, 2)
            results['sources']['coingecko_paxg'] = [
                {'date': d, 'price': p} for d, p in sorted(by_date.items())
            ]
        except Exception as e:
            results['sources']['coingecko_paxg'] = {'error': str(e)}

        # ── Yahoo Finance: spot futures (GC=F for gold, SI=F for silver)
        try:
            tickers = {'gold': 'GC=F', 'silver': 'SI=F'}
            ticker = tickers.get(asset)
            if ticker:
                period1 = int((time.time() - days * 86400))
                period2 = int(time.time())
                url = (f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}'
                       f'?period1={period1}&period2={period2}&interval=1d')
                resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
                resp.raise_for_status()
                chart = resp.json()['chart']['result'][0]
                timestamps = chart['timestamp']
                closes = chart['indicators']['quote'][0]['close']
                results['sources']['yahoo_finance'] = [
                    {
                        'date': datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d'),
                        'price': round(c, 2),
                    }
                    for ts, c in zip(timestamps, closes) if c is not None
                ]
            else:
                results['sources']['yahoo_finance'] = {'error': f'No ticker for {asset}'}
        except Exception as e:
            results['sources']['yahoo_finance'] = {'error': str(e)}

        # ── CoinGecko OHLC (separate granularity view) ───────────────
        try:
            cg_ids = {'gold': 'pax-gold', 'silver': 'silver-token'}
            cg_id = cg_ids.get(asset, asset)
            ohlc_days = min(days, 30)  # OHLC supports 1,7,14,30,90,180,365
            url = f'https://api.coingecko.com/api/v3/coins/{cg_id}/ohlc'
            resp = requests.get(url, params={'vs_currency': 'usd', 'days': ohlc_days}, timeout=10)
            resp.raise_for_status()
            candles = resp.json()
            by_date = {}
            for ts_ms, o, h, l, c in candles:
                d = datetime.utcfromtimestamp(ts_ms / 1000).strftime('%Y-%m-%d')
                by_date[d] = {'open': round(o, 2), 'high': round(h, 2),
                              'low': round(l, 2), 'close': round(c, 2)}
            results['sources']['coingecko_ohlc'] = [
                {'date': d, **v} for d, v in sorted(by_date.items())
            ]
        except Exception as e:
            results['sources']['coingecko_ohlc'] = {'error': str(e)}

        return results

    # ── Storage helpers ──────────────────────────────────────────────

    def _load_json(self, path, default=None):
        if path.exists():
            with open(path, 'r') as f:
                return json.load(f)
        return default if default is not None else {}

    def _save_json(self, path, data):
        with open(path, 'w') as f:
            json.dump(data, f, indent=2, default=str)

    def _load_traders(self):
        return self._load_json(self.traders_path, [])

    def _save_traders(self, traders):
        self._save_json(self.traders_path, traders)

    def _load_current_epoch(self):
        return self._load_json(self.current_epoch_path, None)

    def _save_current_epoch(self, epoch):
        self._save_json(self.current_epoch_path, epoch)

    def _load_epoch(self, epoch_id):
        path = self.epochs_dir / f'{epoch_id}.json'
        return self._load_json(path, None)

    def _save_epoch(self, epoch_id, data):
        path = self.epochs_dir / f'{epoch_id}.json'
        self._save_json(path, data)

    def _check_epoch_expired(self):
        epoch = self._load_current_epoch()
        if not epoch:
            return False
        end_time = datetime.fromisoformat(epoch['end_time'])
        if datetime.now() >= end_time:
            return True
        return False

    # ── Quadratic reward curve ───────────────────────────────────────

    def reward_score(self, pnl_dollars):
        """Quadratic reward: x^2 for gains, -x^2 for losses.
        Parameterized over dollars profited/lost."""
        if pnl_dollars >= 0:
            return pnl_dollars ** 2
        else:
            return -(pnl_dollars ** 2)

    def compute_rewards(self, traders, inflation_pool):
        """Distribute inflation pool based on quadratic scores.
        Only positive-score traders receive rewards.
        Score is parameterized over dollars profited/lost."""
        scores = {}
        for t in traders:
            initial = t.get('initial_equity', 0)
            current = t.get('current_equity', 0)
            pnl_dollars = current - initial
            if initial > 0:
                pnl_pct = ((current - initial) / initial) * 100
            else:
                pnl_pct = 0.0
            scores[t['address']] = {
                'pnl_pct': pnl_pct,
                'pnl_dollars': pnl_dollars,
                'score': self.reward_score(pnl_dollars),
                'pnl_abs': pnl_dollars,
                'initial_equity': initial,
                'current_equity': current,
            }

        positive_total = sum(s['score'] for s in scores.values() if s['score'] > 0)

        rewards = {}
        for addr, s in scores.items():
            if positive_total > 0 and s['score'] > 0:
                share = s['score'] / positive_total
                reward = share * inflation_pool
            else:
                share = 0.0
                reward = 0.0
            rewards[addr] = {
                **s,
                'share': share,
                'reward': reward,
            }
        return rewards

    # ── Public API ───────────────────────────────────────────────────

    def start_epoch(self, inflation_pool=None):
        """Begin a new weekly epoch"""
        if self._load_current_epoch() and not self._check_epoch_expired():
            current = self._load_current_epoch()
            end = datetime.fromisoformat(current['end_time'])
            remaining = end - datetime.now()
            return {
                'error': 'Epoch already active',
                'epoch_id': current['epoch_id'],
                'time_remaining': str(remaining),
            }

        # Auto-finalize expired epoch
        if self._check_epoch_expired():
            self.end_epoch()

        pool = inflation_pool or self.default_inflation_pool
        epoch_id = f"epoch_{int(time.time())}"
        now = datetime.now()
        end = now + timedelta(days=self.epoch_duration_days)

        # Snapshot initial equity for all registered traders
        traders = self._load_traders()
        for t in traders:
            equity = self._get_equity(t['address'], t.get('exchange', self.default_exchange))
            t['initial_equity'] = equity
            t['current_equity'] = equity
            t['pnl'] = 0.0
            t['fills_at_start'] = len(self._get_fills(t['address'], t.get('exchange', self.default_exchange)))
        self._save_traders(traders)

        epoch = {
            'epoch_id': epoch_id,
            'start_time': now.isoformat(),
            'end_time': end.isoformat(),
            'inflation_pool': pool,
            'status': 'active',
            'trader_count': len(traders),
        }
        self._save_current_epoch(epoch)
        self._save_epoch(epoch_id, epoch)

        return {
            'epoch_id': epoch_id,
            'start_time': now.isoformat(),
            'end_time': end.isoformat(),
            'inflation_pool': pool,
            'traders': len(traders),
        }

    def register(self, address, exchange=None):
        """Register a trader for the competition"""
        exchange = exchange or self.default_exchange
        traders = self._load_traders()

        for t in traders:
            if t['address'].lower() == address.lower():
                return {'error': 'Trader already registered', 'address': address}

        equity = self._get_equity(address, exchange)
        trader = {
            'address': address,
            'exchange': exchange,
            'initial_equity': equity,
            'current_equity': equity,
            'pnl': 0.0,
            'registered_at': datetime.now().isoformat(),
        }
        traders.append(trader)
        self._save_traders(traders)
        return {'registered': address, 'exchange': exchange, 'equity': equity}

    def unregister(self, address):
        """Remove a trader from the competition"""
        traders = self._load_traders()
        before = len(traders)
        traders = [t for t in traders if t['address'].lower() != address.lower()]
        self._save_traders(traders)
        removed = before - len(traders)
        return {'unregistered': address, 'removed': removed > 0}

    def sync(self):
        """Update all traders' PnL from their exchange"""
        traders = self._load_traders()
        results = []
        for t in traders:
            try:
                equity = self._get_equity(t['address'], t.get('exchange', self.default_exchange))
                t['current_equity'] = equity
                initial = t.get('initial_equity', 0)
                t['pnl'] = equity - initial if initial > 0 else 0.0
                results.append({
                    'address': t['address'],
                    'equity': equity,
                    'pnl': t['pnl'],
                    'pnl_pct': (t['pnl'] / initial * 100) if initial > 0 else 0.0,
                })
            except Exception as e:
                results.append({'address': t['address'], 'error': str(e)})
        self._save_traders(traders)
        return results

    def leaderboard(self):
        """Get current standings with quadratic scores"""
        traders = self._load_traders()
        epoch = self._load_current_epoch()
        pool = epoch['inflation_pool'] if epoch else self.default_inflation_pool

        rewards = self.compute_rewards(traders, pool)

        # Sort by score descending
        board = sorted(rewards.items(), key=lambda x: x[1]['score'], reverse=True)
        return [
            {
                'rank': i + 1,
                'address': addr,
                'pnl_pct': round(data['pnl_pct'], 4),
                'pnl_abs': round(data['pnl_abs'], 2),
                'score': round(data['score'], 4),
                'reward': round(data['reward'], 4),
                'share': round(data['share'] * 100, 2),
            }
            for i, (addr, data) in enumerate(board)
        ]

    def status(self):
        """Get current epoch status"""
        epoch = self._load_current_epoch()
        traders = self._load_traders()
        if not epoch:
            return {
                'active': False,
                'traders': len(traders),
                'message': 'No active epoch. Call start_epoch() to begin.',
            }

        end = datetime.fromisoformat(epoch['end_time'])
        now = datetime.now()
        remaining = end - now if now < end else timedelta(0)
        expired = now >= end

        return {
            'active': not expired,
            'expired': expired,
            'epoch_id': epoch['epoch_id'],
            'start_time': epoch['start_time'],
            'end_time': epoch['end_time'],
            'time_remaining': str(remaining).split('.')[0],
            'inflation_pool': epoch['inflation_pool'],
            'traders': len(traders),
        }

    def end_epoch(self):
        """Finalize epoch, compute and archive rewards"""
        epoch = self._load_current_epoch()
        if not epoch:
            return {'error': 'No active epoch'}

        # Final sync
        self.sync()

        traders = self._load_traders()
        rewards = self.compute_rewards(traders, epoch['inflation_pool'])

        # Archive
        epoch['status'] = 'completed'
        epoch['completed_at'] = datetime.now().isoformat()
        epoch['rewards'] = rewards
        epoch['traders_final'] = traders
        self._save_epoch(epoch['epoch_id'], epoch)

        # Clear current epoch
        if self.current_epoch_path.exists():
            self.current_epoch_path.unlink()

        total_distributed = sum(r['reward'] for r in rewards.values())
        return {
            'epoch_id': epoch['epoch_id'],
            'status': 'completed',
            'total_distributed': round(total_distributed, 4),
            'inflation_pool': epoch['inflation_pool'],
            'traders': len(traders),
            'top_3': sorted(
                [{'address': a, 'reward': round(r['reward'], 4), 'pnl_pct': round(r['pnl_pct'], 4)}
                 for a, r in rewards.items()],
                key=lambda x: x['reward'], reverse=True
            )[:3],
        }

    def rewards(self, epoch_id=None):
        """View reward distribution for an epoch"""
        if epoch_id:
            epoch = self._load_epoch(epoch_id)
        else:
            epoch = self._load_current_epoch()
            if epoch:
                # Live compute
                traders = self._load_traders()
                return self.compute_rewards(traders, epoch['inflation_pool'])
            # Check most recent completed
            epochs = sorted(self.epochs_dir.glob('epoch_*.json'), reverse=True)
            if epochs:
                epoch = self._load_json(epochs[0])

        if not epoch:
            return {'error': 'No epoch found'}
        return epoch.get('rewards', {})

    def history(self):
        """Get past epoch summaries"""
        results = []
        for path in sorted(self.epochs_dir.glob('epoch_*.json'), reverse=True):
            epoch = self._load_json(path)
            if epoch and epoch.get('status') == 'completed':
                rewards = epoch.get('rewards', {})
                total = sum(r.get('reward', 0) for r in rewards.values())
                results.append({
                    'epoch_id': epoch['epoch_id'],
                    'start_time': epoch.get('start_time'),
                    'end_time': epoch.get('end_time'),
                    'inflation_pool': epoch.get('inflation_pool'),
                    'traders': len(rewards),
                    'total_distributed': round(total, 4),
                })
        return results

    def test(self):
        """Full integration test with mock data — no live API calls needed"""
        import tempfile
        import shutil

        print('=' * 60)
        print('GoldFi Test Suite')
        print('=' * 60)
        results = {'passed': 0, 'failed': 0, 'tests': []}

        def check(name, condition, detail=''):
            status = 'PASS' if condition else 'FAIL'
            results['passed' if condition else 'failed'] += 1
            results['tests'].append({'name': name, 'status': status, 'detail': detail})
            print(f'  [{status}] {name}' + (f' — {detail}' if detail else ''))

        # Use temp dir so we don't mess with real data
        tmp = tempfile.mkdtemp(prefix='goldfi_test_')
        original_store = self.store_dir
        original_epochs = self.epochs_dir
        original_traders = self.traders_path
        original_epoch_path = self.current_epoch_path
        try:
            self.store_dir = Path(tmp)
            self.epochs_dir = self.store_dir / 'epochs'
            self.epochs_dir.mkdir(parents=True, exist_ok=True)
            self.traders_path = self.store_dir / 'traders.json'
            self.current_epoch_path = self.store_dir / 'current_epoch.json'

            # ── 1. Quadratic reward curve (dollars) ────────────────────
            print('\n1. Quadratic Reward Curve (dollars)')
            check('profit $10 → 100', self.reward_score(10) == 100)
            check('profit $5 → 25', self.reward_score(5) == 25)
            check('zero → 0', self.reward_score(0) == 0)
            check('loss $10 → -100', self.reward_score(-10) == -100)
            check('loss $3 → -9', self.reward_score(-3) == -9)
            # Quadratic amplifies big winners
            check('$20 profit scores 4x more than $10',
                  self.reward_score(20) == 4 * self.reward_score(10),
                  f'{self.reward_score(20)} vs 4*{self.reward_score(10)}')

            # ── 2. Asset registry ────────────────────────────────────
            print('\n2. Asset Registry')
            check('gold in ASSETS', 'gold' in self.ASSETS)
            check('silver in ASSETS', 'silver' in self.ASSETS)
            check('gold has hyperliquid symbol',
                  self.ASSETS['gold']['hyperliquid']['symbol'] == 'GOLD')
            check('gold has uniswap PAXG',
                  self.ASSETS['gold']['uniswap']['symbol'] == 'PAXG')

            # Add a new asset dynamically
            self.add_asset('platinum', hyperliquid_symbol='PLAT',
                          uniswap_symbol='PLAT', uniswap_address='0xPLAT')
            check('add_asset platinum', 'platinum' in self.ASSETS)
            check('platinum HL symbol', self.ASSETS['platinum']['hyperliquid']['symbol'] == 'PLAT')
            # Clean up
            del self.ASSETS['platinum']

            tracked_hl = self._tracked_symbols('hyperliquid')
            check('tracked HL symbols include GOLD', 'GOLD' in tracked_hl)
            check('tracked HL symbols include SILVER', 'SILVER' in tracked_hl)

            # ── 3. Epoch lifecycle ───────────────────────────────────
            print('\n3. Epoch Lifecycle')
            status = self.status()
            check('no active epoch initially', status['active'] == False)

            # Mock _get_equity to avoid live API
            real_get_equity = self._get_equity
            real_get_fills = self._get_fills
            self._get_equity = lambda addr, ex='hyperliquid': 10000.0
            self._get_fills = lambda addr, ex='hyperliquid': []

            epoch = self.start_epoch(inflation_pool=500)
            check('epoch started', 'epoch_id' in epoch, epoch.get('epoch_id', ''))
            check('inflation pool = 500', epoch.get('inflation_pool') == 500)

            status = self.status()
            check('epoch active after start', status['active'] == True)
            check('pool in status', status['inflation_pool'] == 500)

            # Can't start another
            dup = self.start_epoch()
            check('duplicate epoch blocked', 'error' in dup)

            # ── 4. Trader registration ───────────────────────────────
            print('\n4. Trader Registration')
            r1 = self.register('0xAlice', 'hyperliquid')
            check('register Alice', r1.get('registered') == '0xAlice')
            check('Alice equity snapshotted', r1.get('equity') == 10000.0)

            r2 = self.register('0xBob', 'hyperliquid')
            check('register Bob', r2.get('registered') == '0xBob')

            r3 = self.register('0xCharlie', 'uniswap')
            check('register Charlie (uniswap)', r3.get('exchange') == 'uniswap')

            dup_r = self.register('0xAlice', 'hyperliquid')
            check('duplicate register blocked', 'error' in dup_r)

            traders = self._load_traders()
            check('3 traders registered', len(traders) == 3)

            # ── 5. Sync with simulated PnL ───────────────────────────
            print('\n5. Sync & PnL Tracking')
            # Simulate: Alice +20%, Bob -5%, Charlie +8%
            equity_map = {
                '0xalice': 12000.0,   # +20%
                '0xbob': 9500.0,      # -5%
                '0xcharlie': 10800.0,  # +8%
            }
            self._get_equity = lambda addr, ex='hyperliquid': equity_map.get(addr.lower(), 10000.0)

            sync_results = self.sync()
            check('sync returned 3 results', len(sync_results) == 3)

            alice_sync = [r for r in sync_results if r.get('address') == '0xAlice']
            check('Alice PnL = +2000', alice_sync and alice_sync[0].get('pnl') == 2000.0)

            bob_sync = [r for r in sync_results if r.get('address') == '0xBob']
            check('Bob PnL = -500', bob_sync and bob_sync[0].get('pnl') == -500.0)

            # ── 6. Reward computation ────────────────────────────────
            print('\n6. Quadratic Reward Distribution')
            board = self.leaderboard()
            check('leaderboard has 3 entries', len(board) == 3)
            check('Alice ranked #1 (highest PnL)', board[0]['address'] == '0xAlice')

            # Alice: +$2000 → score=4000000, Bob: -$500 → score=-250000, Charlie: +$800 → score=640000
            alice_entry = [b for b in board if b['address'] == '0xAlice'][0]
            bob_entry = [b for b in board if b['address'] == '0xBob'][0]
            charlie_entry = [b for b in board if b['address'] == '0xCharlie'][0]

            check('Alice score = 4000000', alice_entry['score'] == 4000000.0,
                  f'got {alice_entry["score"]}')
            check('Bob score = -250000 (negative)', bob_entry['score'] == -250000.0,
                  f'got {bob_entry["score"]}')
            check('Charlie score = 640000', charlie_entry['score'] == 640000.0,
                  f'got {charlie_entry["score"]}')
            check('Bob reward = 0 (negative score)', bob_entry['reward'] == 0.0)

            # Alice share = 4000000/(4000000+640000) = 86.21%, Charlie = 640000/4640000 = 13.79%
            total_positive = 4000000 + 640000
            expected_alice_reward = round(4000000 / total_positive * 500, 4)
            expected_charlie_reward = round(640000 / total_positive * 500, 4)
            check(f'Alice reward ≈ {expected_alice_reward}',
                  alice_entry['reward'] == expected_alice_reward,
                  f'got {alice_entry["reward"]}')
            check(f'Charlie reward ≈ {expected_charlie_reward}',
                  charlie_entry['reward'] == expected_charlie_reward,
                  f'got {charlie_entry["reward"]}')
            check('total rewards = pool',
                  round(alice_entry['reward'] + charlie_entry['reward'] + bob_entry['reward'], 2) == 500.0)

            # ── 7. End epoch ─────────────────────────────────────────
            print('\n7. Epoch Finalization')
            result = self.end_epoch()
            check('epoch completed', result.get('status') == 'completed')
            check('total distributed = 500', result.get('total_distributed') == 500.0)
            check('top_3 present', len(result.get('top_3', [])) == 3)

            status = self.status()
            check('no active epoch after end', status['active'] == False)

            # ── 8. History ───────────────────────────────────────────
            print('\n8. History')
            hist = self.history()
            check('1 completed epoch in history', len(hist) == 1)
            check('history has correct pool', hist[0]['inflation_pool'] == 500)

            # ── 9. Unregister ────────────────────────────────────────
            print('\n9. Unregister')
            ur = self.unregister('0xBob')
            check('Bob unregistered', ur.get('removed') == True)
            traders = self._load_traders()
            check('2 traders remaining', len(traders) == 2)

            # ── 10. New epoch after reset ────────────────────────────
            print('\n10. New Epoch After Reset')
            self._get_equity = lambda addr, ex='hyperliquid': 15000.0
            epoch2 = self.start_epoch(inflation_pool=2000)
            check('second epoch started', 'epoch_id' in epoch2)
            check('new pool = 2000', epoch2['inflation_pool'] == 2000)
            check('carries 2 traders', epoch2['traders'] == 2)
            self.end_epoch()

            # Restore
            self._get_equity = real_get_equity
            self._get_fills = real_get_fills

        finally:
            # Restore original paths
            self.store_dir = original_store
            self.epochs_dir = original_epochs
            self.traders_path = original_traders
            self.current_epoch_path = original_epoch_path
            shutil.rmtree(tmp, ignore_errors=True)

        # ── Summary ──────────────────────────────────────────────────
        print('\n' + '=' * 60)
        total = results['passed'] + results['failed']
        print(f'Results: {results["passed"]}/{total} passed, {results["failed"]} failed')
        print('=' * 60)
        return results

    def forward(self, action=None, **kwargs):
        """CLI entry point: goldfi <action> [args]

        Actions:
            start       - Start new epoch
            register    - Register trader (address=, exchange=)
            unregister  - Remove trader (address=)
            sync        - Update all PnL
            leaderboard - Current standings
            status      - Epoch info
            end         - Finalize epoch
            rewards     - View rewards (epoch_id=)
            history     - Past epochs
            prices      - Current prices for tracked assets
            price_history - Gold price from multiple sources (days=, asset=)
            assets      - List tracked assets
            add_asset   - Add new asset (name=, hl_symbol=, uni_address=)
            test        - Run test suite
        """
        actions = {
            'start': lambda: self.start_epoch(kwargs.get('inflation_pool')),
            'register': lambda: self.register(kwargs.get('address', ''), kwargs.get('exchange')),
            'unregister': lambda: self.unregister(kwargs.get('address', '')),
            'sync': lambda: self.sync(),
            'leaderboard': lambda: self.leaderboard(),
            'status': lambda: self.status(),
            'end': lambda: self.end_epoch(),
            'rewards': lambda: self.rewards(kwargs.get('epoch_id')),
            'history': lambda: self.history(),
            'prices': lambda: self.get_prices(),
            'price_history': lambda: self.price_history(
                days=int(kwargs.get('days', 7)),
                asset=kwargs.get('asset', 'gold'),
            ),
            'assets': lambda: {
                'tracked': self.tracked_assets,
                'registry': {k: {ex: info.get('symbol') for ex, info in v.items()} for k, v in self.ASSETS.items()},
            },
            'add_asset': lambda: self.add_asset(
                kwargs.get('name', ''),
                hyperliquid_symbol=kwargs.get('hl_symbol'),
                uniswap_address=kwargs.get('uni_address'),
                uniswap_symbol=kwargs.get('uni_symbol'),
            ),
            'test': lambda: self.test(),
        }

        if not action or action not in actions:
            return {
                'module': 'goldfi',
                'description': self.description,
                'actions': list(actions.keys()),
                'assets': self.tracked_assets,
                'status': self.status(),
            }

        return actions[action]()
