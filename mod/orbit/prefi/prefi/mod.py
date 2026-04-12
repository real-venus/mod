"""PreFi - Prediction Market Module

On-chain prediction market on Base with L2 distance scoring.
Players predict asset prices, stake tokens, and earn rewards
proportional to accuracy: score = stake / (1 + distance^2).
"""

import json
import os
import time
import subprocess
import signal
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path


class Mod:
    description = """PreFi - Decentralized prediction market on Base.
    Players predict token prices, stake collateral, earn rewards via
    L2 distance scoring. Oracle-powered settlement with Uniswap V3."""

    def __init__(self, config=None):
        self.config = config or {}
        self.module_dir = Path(__file__).parent.parent
        self.store_dir = Path(os.path.expanduser('~/.prefi'))
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self.markets_path = self.store_dir / 'markets.json'
        self.predictions_path = self.store_dir / 'predictions.json'
        self.deployment_path = self.store_dir / 'deployment.json'

        # Network config
        self.network = self.config.get('network', 'baseSepolia')
        self.contracts = self.config.get('contracts', {})

        # Ports
        api_cfg = self.config.get('api', {})
        app_cfg = self.config.get('app', {})
        self.api_port = api_cfg.get('port', self.config.get('api_port', 8830))
        self.app_port = app_cfg.get('port', self.config.get('app_port', 8831))

        # Load deployment if available
        self._load_deployment()

    # ── Storage helpers ───────────────────────────────────────────────

    def _load_json(self, path, default=None):
        if path.exists():
            with open(path, 'r') as f:
                return json.load(f)
        return default if default is not None else {}

    def _save_json(self, path, data):
        with open(path, 'w') as f:
            json.dump(data, f, indent=2, default=str)

    def _load_markets(self):
        return self._load_json(self.markets_path, [])

    def _save_markets(self, markets):
        self._save_json(self.markets_path, markets)

    def _load_predictions(self):
        return self._load_json(self.predictions_path, [])

    def _save_predictions(self, predictions):
        self._save_json(self.predictions_path, predictions)

    def _load_deployment(self):
        """Load deployment info from deployments dir or store"""
        # Check deployments directory first
        deploy_dir = self.module_dir / 'deployments'
        deploy_file = deploy_dir / f'{self.network}-latest.json'
        if deploy_file.exists():
            data = self._load_json(deploy_file)
            if data and 'contracts' in data:
                self.contracts = data['contracts']
                return
        # Fall back to store
        data = self._load_json(self.deployment_path)
        if data and 'contracts' in data:
            self.contracts = data['contracts']

    # ── Service management ────────────────────────────────────────────

    def serve(self, api_port=None, app_port=None, dev=True):
        """Start the FastAPI server and Next.js app"""
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port
        results = {}
        log_dir = Path('/tmp/prefi')
        log_dir.mkdir(parents=True, exist_ok=True)

        self.kill()

        # Start API server
        server_dir = self.module_dir / 'server'
        server_path = server_dir / 'server.py'
        if server_path.exists():
            env = os.environ.copy()
            env['PORT'] = str(api_port)
            env['PYTHONPATH'] = str(self.module_dir.parent.parent.parent)

            api_log = open(log_dir / 'api.log', 'w')
            if dev:
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
                    ['python3', '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0',
                     '--port', str(api_port)],
                    cwd=str(server_dir),
                    env=env,
                    stdout=api_log,
                    stderr=subprocess.STDOUT,
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
        """Stop all PreFi services"""
        killed = []
        patterns = [
            f'uvicorn.*server:app.*{self.api_port}',
            f'next.*dev.*{self.app_port}',
            f'next.*start.*{self.app_port}',
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
        status = {
            'status': 'ok',
            'service': 'prefi',
            'network': self.network,
            'contracts': self.contracts,
            'timestamp': datetime.now().isoformat(),
        }
        # Check API
        try:
            r = requests.get(f'http://localhost:{self.api_port}/health', timeout=2)
            status['api'] = {'status': 'up', 'port': self.api_port}
        except Exception:
            status['api'] = {'status': 'down', 'port': self.api_port}
        return status

    # ── Market management (off-chain tracking) ────────────────────────

    def create_market(self, asset: str, token_address: str, duration: int = 86400) -> Dict:
        """Create a new prediction market (tracked off-chain)"""
        markets = self._load_markets()
        market_id = len(markets) + 1
        now = time.time()

        market = {
            'id': market_id,
            'asset': asset,
            'token_address': token_address,
            'start_time': now,
            'end_time': now + duration,
            'duration': duration,
            'settled': False,
            'actual_price': None,
            'total_staked': 0.0,
            'players': [],
            'created_at': datetime.now().isoformat(),
        }
        markets.append(market)
        self._save_markets(markets)

        return {
            'market_id': market_id,
            'asset': asset,
            'token_address': token_address,
            'start_time': now,
            'end_time': now + duration,
            'duration': duration,
        }

    def list_markets(self) -> List[Dict]:
        """Get all markets"""
        markets = self._load_markets()
        now = time.time()
        result = []
        for m in markets:
            time_left = max(0, m['end_time'] - now)
            is_active = not m['settled'] and time_left > 0
            result.append({
                'id': m['id'],
                'asset': m['asset'],
                'token_address': m['token_address'],
                'start_time': m['start_time'],
                'end_time': m['end_time'],
                'settled': m['settled'],
                'actual_price': m.get('actual_price'),
                'total_staked': m['total_staked'],
                'players_count': len(m.get('players', [])),
                'is_active': is_active,
                'time_remaining': int(time_left),
            })
        return result

    def get_market(self, market_id: int) -> Dict:
        """Get a single market by ID"""
        markets = self._load_markets()
        for m in markets:
            if m['id'] == market_id:
                now = time.time()
                time_left = max(0, m['end_time'] - now)
                return {
                    **m,
                    'is_active': not m['settled'] and time_left > 0,
                    'time_remaining': int(time_left),
                    'players_count': len(m.get('players', [])),
                }
        return {'error': f'Market {market_id} not found'}

    def resolve_market(self, market_id: int, actual_price: str) -> Dict:
        """Resolve a market with the actual price, compute rewards"""
        markets = self._load_markets()
        predictions = self._load_predictions()

        market = None
        market_idx = None
        for i, m in enumerate(markets):
            if m['id'] == market_id:
                market = m
                market_idx = i
                break

        if not market:
            return {'error': f'Market {market_id} not found'}
        if market['settled']:
            return {'error': 'Market already settled'}

        price = float(actual_price)
        market['actual_price'] = price
        market['settled'] = True
        market['settled_at'] = datetime.now().isoformat()

        # Calculate L2 distance scores for all predictions in this market
        market_preds = [p for p in predictions if p['market_id'] == market_id]

        total_score = 0.0
        scores = {}
        for p in market_preds:
            predicted = float(p['predicted_price'])
            stake = float(p['stake_amount'])
            diff = abs(predicted - price)
            distance_sq = (diff ** 2) / (price ** 2) if price > 0 else 0  # normalize
            score = stake / (1 + distance_sq)
            scores[p['address']] = score
            total_score += score

        # Distribute rewards proportionally
        total_staked = market['total_staked']
        fee_rate = 0.02  # 2% platform fee
        fee = total_staked * fee_rate
        reward_pool = total_staked - fee

        rewards = {}
        for addr, score in scores.items():
            if total_score > 0:
                reward = (reward_pool * score) / total_score
            else:
                reward = 0
            rewards[addr] = round(reward, 6)

        # Update predictions with rewards
        for p in predictions:
            if p['market_id'] == market_id:
                p['reward'] = rewards.get(p['address'], 0)
                p['status'] = 'settled'

        market['rewards'] = rewards
        market['fee'] = round(fee, 6)
        market['reward_pool'] = round(reward_pool, 6)
        markets[market_idx] = market

        self._save_markets(markets)
        self._save_predictions(predictions)

        return {
            'market_id': market_id,
            'actual_price': price,
            'total_staked': total_staked,
            'reward_pool': round(reward_pool, 6),
            'fee': round(fee, 6),
            'rewards': rewards,
            'predictions_count': len(market_preds),
        }

    # ── Predictions ───────────────────────────────────────────────────

    def record_prediction(self, market_id: int, address: str,
                          predicted_price: str, stake_amount: str) -> Dict:
        """Record a prediction (off-chain tracking of on-chain activity)"""
        markets = self._load_markets()
        predictions = self._load_predictions()

        # Validate market exists and is active
        market = None
        market_idx = None
        for i, m in enumerate(markets):
            if m['id'] == market_id:
                market = m
                market_idx = i
                break

        if not market:
            return {'error': f'Market {market_id} not found'}

        now = time.time()
        if market['settled'] or now >= market['end_time']:
            return {'error': 'Market is closed'}

        # Check duplicate
        for p in predictions:
            if p['market_id'] == market_id and p['address'].lower() == address.lower():
                return {'error': 'Already predicted in this market'}

        stake = float(stake_amount)
        prediction = {
            'market_id': market_id,
            'address': address,
            'predicted_price': predicted_price,
            'stake_amount': stake_amount,
            'timestamp': now,
            'status': 'active',
            'reward': 0,
            'claimed': False,
        }
        predictions.append(prediction)

        # Update market
        market['total_staked'] += stake
        if address not in market.get('players', []):
            market['players'].append(address)
        markets[market_idx] = market

        self._save_predictions(predictions)
        self._save_markets(markets)

        return {
            'market_id': market_id,
            'address': address,
            'predicted_price': predicted_price,
            'stake_amount': stake_amount,
            'status': 'active',
        }

    def get_user_predictions(self, address: str) -> List[Dict]:
        """Get all predictions for an address"""
        predictions = self._load_predictions()
        markets = self._load_markets()
        market_map = {m['id']: m for m in markets}

        result = []
        for p in predictions:
            if p['address'].lower() == address.lower():
                market = market_map.get(p['market_id'], {})
                result.append({
                    'market_id': p['market_id'],
                    'asset': market.get('asset', 'Unknown'),
                    'predicted_price': p['predicted_price'],
                    'stake_amount': p['stake_amount'],
                    'timestamp': p['timestamp'],
                    'status': p.get('status', 'active'),
                    'reward': p.get('reward', 0),
                    'claimed': p.get('claimed', False),
                    'market_settled': market.get('settled', False),
                    'actual_price': market.get('actual_price'),
                })
        return result

    def record_claim(self, market_id: int, address: str) -> Dict:
        """Record that a user claimed their reward"""
        predictions = self._load_predictions()
        for p in predictions:
            if p['market_id'] == market_id and p['address'].lower() == address.lower():
                if p.get('claimed'):
                    return {'error': 'Already claimed'}
                if p.get('status') != 'settled':
                    return {'error': 'Market not settled'}
                p['claimed'] = True
                self._save_predictions(predictions)
                return {
                    'market_id': market_id,
                    'address': address,
                    'reward': p.get('reward', 0),
                    'claimed': True,
                }
        return {'error': 'Prediction not found'}

    # ── Leaderboard & Rewards ─────────────────────────────────────────

    def leaderboard(self, market_id: Optional[int] = None) -> List[Dict]:
        """Get leaderboard sorted by total rewards"""
        predictions = self._load_predictions()

        if market_id:
            predictions = [p for p in predictions if p['market_id'] == market_id]

        # Aggregate by address
        scores = {}
        for p in predictions:
            addr = p['address']
            if addr not in scores:
                scores[addr] = {
                    'address': addr,
                    'total_staked': 0.0,
                    'total_reward': 0.0,
                    'predictions_count': 0,
                }
            scores[addr]['total_staked'] += float(p.get('stake_amount', 0))
            scores[addr]['total_reward'] += float(p.get('reward', 0))
            scores[addr]['predictions_count'] += 1

        board = sorted(scores.values(), key=lambda x: x['total_reward'], reverse=True)
        for i, entry in enumerate(board):
            entry['rank'] = i + 1
            entry['pnl'] = round(entry['total_reward'] - entry['total_staked'], 6)
        return board

    def get_rewards(self, address: str, market_id: Optional[int] = None) -> Dict:
        """Get reward details for a specific address"""
        predictions = self._load_predictions()
        rewards = []
        total = 0.0

        for p in predictions:
            if p['address'].lower() != address.lower():
                continue
            if market_id and p['market_id'] != market_id:
                continue
            reward = float(p.get('reward', 0))
            total += reward
            rewards.append({
                'market_id': p['market_id'],
                'predicted_price': p['predicted_price'],
                'stake_amount': p['stake_amount'],
                'reward': reward,
                'claimed': p.get('claimed', False),
                'status': p.get('status', 'active'),
            })

        return {
            'address': address,
            'total_reward': round(total, 6),
            'rewards': rewards,
        }

    # ── Prices ────────────────────────────────────────────────────────

    def get_prices(self) -> Dict:
        """Get current prices from CoinGecko"""
        try:
            url = 'https://api.coingecko.com/api/v3/simple/price'
            params = {
                'ids': 'ethereum,bitcoin,usd-coin',
                'vs_currencies': 'usd',
                'include_24hr_change': 'true',
            }
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return {
                'ETH/USD': {
                    'price': data.get('ethereum', {}).get('usd', 0),
                    'change_24h': data.get('ethereum', {}).get('usd_24h_change', 0),
                },
                'BTC/USD': {
                    'price': data.get('bitcoin', {}).get('usd', 0),
                    'change_24h': data.get('bitcoin', {}).get('usd_24h_change', 0),
                },
                'USDC/USD': {
                    'price': data.get('usd-coin', {}).get('usd', 0),
                    'change_24h': data.get('usd-coin', {}).get('usd_24h_change', 0),
                },
                'timestamp': datetime.now().isoformat(),
            }
        except Exception as e:
            return {'error': str(e)}

    def get_asset_price(self, asset: str) -> Dict:
        """Get price for a specific asset"""
        coingecko_ids = {
            'ETH': 'ethereum', 'BTC': 'bitcoin', 'USDC': 'usd-coin',
            'WETH': 'weth', 'USDT': 'tether', 'DAI': 'dai',
            'LINK': 'chainlink', 'UNI': 'uniswap', 'AAVE': 'aave',
        }
        asset_upper = asset.upper().split('/')[0]
        cg_id = coingecko_ids.get(asset_upper, asset_upper.lower())
        try:
            url = 'https://api.coingecko.com/api/v3/simple/price'
            resp = requests.get(url, params={
                'ids': cg_id,
                'vs_currencies': 'usd',
                'include_24hr_change': 'true',
            }, timeout=10)
            resp.raise_for_status()
            data = resp.json().get(cg_id, {})
            return {
                'asset': asset,
                'price': data.get('usd', 0),
                'change_24h': data.get('usd_24h_change', 0),
                'timestamp': datetime.now().isoformat(),
            }
        except Exception as e:
            return {'asset': asset, 'error': str(e)}

    # ── Deployment info ───────────────────────────────────────────────

    def get_deployment_info(self) -> Dict:
        """Get current deployment info"""
        return {
            'network': self.network,
            'contracts': self.contracts,
            'store_dir': str(self.store_dir),
            'api_port': self.api_port,
            'app_port': self.app_port,
        }

    # ── Status ────────────────────────────────────────────────────────

    def status(self) -> Dict:
        """Get overall status"""
        markets = self._load_markets()
        predictions = self._load_predictions()
        now = time.time()
        active = [m for m in markets if not m['settled'] and m['end_time'] > now]

        return {
            'service': 'prefi',
            'network': self.network,
            'contracts': self.contracts,
            'markets_total': len(markets),
            'markets_active': len(active),
            'predictions_total': len(predictions),
            'api_port': self.api_port,
            'app_port': self.app_port,
            'timestamp': datetime.now().isoformat(),
        }

    # ── Test ──────────────────────────────────────────────────────────

    def test(self) -> Dict:
        """Run integration tests with mock data"""
        import tempfile
        import shutil

        print('=' * 60)
        print('PreFi Test Suite')
        print('=' * 60)
        results = {'passed': 0, 'failed': 0, 'tests': []}

        def check(name, condition, detail=''):
            status = 'PASS' if condition else 'FAIL'
            results['passed' if condition else 'failed'] += 1
            results['tests'].append({'name': name, 'status': status, 'detail': detail})
            print(f'  [{status}] {name}' + (f' — {detail}' if detail else ''))

        tmp = tempfile.mkdtemp(prefix='prefi_test_')
        orig_store = self.store_dir
        orig_markets = self.markets_path
        orig_preds = self.predictions_path
        try:
            self.store_dir = Path(tmp)
            self.markets_path = self.store_dir / 'markets.json'
            self.predictions_path = self.store_dir / 'predictions.json'

            # 1. L2 distance scoring
            print('\n1. L2 Distance Scoring')
            # score = stake / (1 + (diff/actual)^2)
            diff = abs(3500 - 3500)
            score_perfect = 100 / (1 + (diff ** 2) / (3500 ** 2))
            check('perfect prediction score = stake', score_perfect == 100.0)

            diff = abs(3600 - 3500)
            score_close = 100 / (1 + (diff ** 2) / (3500 ** 2))
            check('close prediction > 0', score_close > 0)
            check('close < perfect', score_close < score_perfect)

            diff = abs(5000 - 3500)
            score_far = 100 / (1 + (diff ** 2) / (3500 ** 2))
            check('far prediction < close', score_far < score_close)

            # 2. Create market
            print('\n2. Market Creation')
            m = self.create_market('ETH/USD', '0xETH', 3600)
            check('market created', 'market_id' in m, f'id={m.get("market_id")}')
            check('asset is ETH/USD', m.get('asset') == 'ETH/USD')

            markets = self.list_markets()
            check('1 market listed', len(markets) == 1)
            check('market is active', markets[0]['is_active'])

            # 3. Predictions
            print('\n3. Predictions')
            p1 = self.record_prediction(1, '0xAlice', '3500', '10')
            check('Alice predicted', p1.get('status') == 'active')

            p2 = self.record_prediction(1, '0xBob', '3600', '20')
            check('Bob predicted', p2.get('status') == 'active')

            p3 = self.record_prediction(1, '0xCharlie', '4000', '5')
            check('Charlie predicted', p3.get('status') == 'active')

            dup = self.record_prediction(1, '0xAlice', '3700', '5')
            check('duplicate blocked', 'error' in dup)

            preds = self.get_user_predictions('0xAlice')
            check('Alice has 1 prediction', len(preds) == 1)

            # 4. Market resolution
            print('\n4. Market Resolution')
            res = self.resolve_market(1, '3500')
            check('market resolved', 'rewards' in res)
            check('3 rewards computed', len(res.get('rewards', {})) == 3)

            # L2 scoring: score = stake / (1 + distance²)
            # Alice: stake=10, perfect → score=10. Bob: stake=20, close → score≈20. Charlie: stake=5, far → score<5.
            # Bob has 2x stake with small distance, so Bob > Alice despite worse prediction
            alice_reward = res['rewards'].get('0xAlice', 0)
            bob_reward = res['rewards'].get('0xBob', 0)
            charlie_reward = res['rewards'].get('0xCharlie', 0)
            check('all rewards > 0', alice_reward > 0 and bob_reward > 0 and charlie_reward > 0,
                  f'Alice={alice_reward:.4f} Bob={bob_reward:.4f} Charlie={charlie_reward:.4f}')
            check('Bob > Charlie (higher stake)', bob_reward > charlie_reward,
                  f'Bob={bob_reward:.4f} Charlie={charlie_reward:.4f}')
            check('total rewards = pool',
                  round(alice_reward + bob_reward + charlie_reward, 2) == round(res['reward_pool'], 2))

            # 5. Claims
            print('\n5. Claims')
            claim = self.record_claim(1, '0xAlice')
            check('Alice claimed', claim.get('claimed'))

            dup_claim = self.record_claim(1, '0xAlice')
            check('double claim blocked', 'error' in dup_claim)

            # 6. Leaderboard
            print('\n6. Leaderboard')
            board = self.leaderboard()
            check('3 players on board', len(board) == 3)
            check('Bob ranked #1 (highest reward from 2x stake)', board[0]['address'] == '0xBob')

            # 7. Status
            print('\n7. Status')
            s = self.status()
            check('status has markets_total', s['markets_total'] == 1)
            check('status has predictions_total', s['predictions_total'] == 3)

        finally:
            self.store_dir = orig_store
            self.markets_path = orig_markets
            self.predictions_path = orig_preds
            shutil.rmtree(tmp, ignore_errors=True)

        print('\n' + '=' * 60)
        total = results['passed'] + results['failed']
        print(f'Results: {results["passed"]}/{total} passed, {results["failed"]} failed')
        print('=' * 60)
        return results

    # ── CLI entry point ───────────────────────────────────────────────

    def forward(self, action=None, **kwargs):
        """CLI entry point: prefi <action> [args]

        Actions:
            serve       - Start API + app servers
            kill        - Stop all services
            health      - Check service health
            status      - Get system status
            markets     - List all markets
            market      - Get market detail (id=)
            create      - Create market (asset=, token=, duration=)
            predict     - Place prediction (market_id=, address=, price=, stake=)
            resolve     - Resolve market (market_id=, price=)
            predictions - Get user predictions (address=)
            claim       - Claim reward (market_id=, address=)
            leaderboard - Rankings
            rewards     - Get rewards (address=, market_id=)
            prices      - Current asset prices
            price       - Single asset price (asset=)
            deployment  - Deployment info
            test        - Run test suite
        """
        actions = {
            'serve': lambda: self.serve(
                api_port=kwargs.get('api_port'),
                app_port=kwargs.get('app_port'),
                dev=kwargs.get('dev', True),
            ),
            'kill': lambda: self.kill(),
            'health': lambda: self.health(),
            'status': lambda: self.status(),
            'markets': lambda: self.list_markets(),
            'market': lambda: self.get_market(int(kwargs.get('id', 0))),
            'create': lambda: self.create_market(
                kwargs.get('asset', 'ETH/USD'),
                kwargs.get('token', '0x0000000000000000000000000000000000000000'),
                int(kwargs.get('duration', 86400)),
            ),
            'predict': lambda: self.record_prediction(
                int(kwargs.get('market_id', 0)),
                kwargs.get('address', ''),
                kwargs.get('price', '0'),
                kwargs.get('stake', '0'),
            ),
            'resolve': lambda: self.resolve_market(
                int(kwargs.get('market_id', 0)),
                kwargs.get('price', '0'),
            ),
            'predictions': lambda: self.get_user_predictions(kwargs.get('address', '')),
            'claim': lambda: self.record_claim(
                int(kwargs.get('market_id', 0)),
                kwargs.get('address', ''),
            ),
            'leaderboard': lambda: self.leaderboard(
                market_id=int(kwargs['market_id']) if kwargs.get('market_id') else None,
            ),
            'rewards': lambda: self.get_rewards(
                kwargs.get('address', ''),
                market_id=int(kwargs['market_id']) if kwargs.get('market_id') else None,
            ),
            'prices': lambda: self.get_prices(),
            'price': lambda: self.get_asset_price(kwargs.get('asset', 'ETH')),
            'deployment': lambda: self.get_deployment_info(),
            'test': lambda: self.test(),
        }

        if not action or action not in actions:
            return {
                'module': 'prefi',
                'description': self.description,
                'actions': list(actions.keys()),
                'status': self.status(),
            }

        return actions[action]()
