import os
import sys
import json
import signal
import subprocess
import requests
from pathlib import Path
from typing import Any, Dict, List, Optional


class Mod:
    description = "Zcash explorer - query blocks, transactions, addresses, and network stats"
    fns = ['info', 'block', 'tx', 'address', 'mempool', 'price', 'network', 'search', 'status', 'serve', 'app', 'kill', 'test']
    api_base = "https://api.blockchair.com/zcash"
    api_port = 8930
    app_port = 3930

    def __init__(self, config=None, **kwargs):
        self._dir = Path(__file__).parent.parent
        self._log_dir = Path('/tmp/zcash')
        self._log_dir.mkdir(parents=True, exist_ok=True)
        self._config = config or self._load_config()
        self._load_env()

    def _load_config(self) -> dict:
        cfg_path = self._dir / 'config.json'
        if cfg_path.exists():
            with open(cfg_path) as f:
                return json.load(f)
        return {}

    def _load_env(self):
        env_path = self._dir / '.env'
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        os.environ.setdefault(k.strip(), v.strip())

    def _get(self, url: str, params: dict = None) -> dict:
        try:
            r = requests.get(url, params=params, timeout=15)
            r.raise_for_status()
            return r.json()
        except requests.exceptions.Timeout:
            return {'error': 'Request timed out'}
        except requests.exceptions.RequestException as e:
            return {'error': str(e)}

    # ── Core API ──

    def info(self) -> dict:
        """Get Zcash blockchain overview stats"""
        data = self._get(f"{self.api_base}/stats")
        if 'error' in data:
            return data
        s = data.get('data', {})
        return {
            'blocks': s.get('blocks'),
            'transactions': s.get('transactions'),
            'difficulty': s.get('difficulty'),
            'hashrate': s.get('hashrate_24h'),
            'market_price_usd': s.get('market_price_usd'),
            'market_cap_usd': s.get('market_cap_usd'),
            'circulation': s.get('circulation'),
            'mempool_transactions': s.get('mempool_transactions'),
            'mempool_size': s.get('mempool_size'),
            'best_block_height': s.get('best_block_height'),
            'best_block_hash': s.get('best_block_hash'),
        }

    def block(self, height: int = None, hash: str = None) -> dict:
        """Get block details by height or hash"""
        if hash:
            data = self._get(f"{self.api_base}/dashboards/block/{hash}")
        elif height is not None:
            data = self._get(f"{self.api_base}/dashboards/block/{height}")
        else:
            stats = self.info()
            if 'error' in stats:
                return stats
            height = stats.get('best_block_height')
            data = self._get(f"{self.api_base}/dashboards/block/{height}")
        if 'error' in data:
            return data
        blocks = data.get('data', {})
        if not blocks:
            return {'error': 'Block not found'}
        key = list(blocks.keys())[0]
        b = blocks[key].get('block', {})
        return {
            'height': b.get('id'),
            'hash': b.get('hash'),
            'time': b.get('time'),
            'size': b.get('size'),
            'transaction_count': b.get('transaction_count'),
            'input_total': b.get('input_total'),
            'output_total': b.get('output_total'),
            'difficulty': b.get('difficulty'),
        }

    def tx(self, txid: str) -> dict:
        """Get transaction details by txid"""
        data = self._get(f"{self.api_base}/dashboards/transaction/{txid}")
        if 'error' in data:
            return data
        txs = data.get('data', {})
        if not txs:
            return {'error': 'Transaction not found'}
        key = list(txs.keys())[0]
        t = txs[key].get('transaction', {})
        return {
            'hash': t.get('hash'),
            'block_id': t.get('block_id'),
            'time': t.get('time'),
            'size': t.get('size'),
            'fee': t.get('fee'),
            'input_total': t.get('input_total'),
            'output_total': t.get('output_total'),
            'input_count': t.get('input_count'),
            'output_count': t.get('output_count'),
            'is_coinbase': t.get('is_coinbase'),
            'has_shielded': t.get('has_shielded'),
        }

    def address(self, addr: str) -> dict:
        """Get address balance and transaction summary"""
        data = self._get(f"{self.api_base}/dashboards/address/{addr}")
        if 'error' in data:
            return data
        addrs = data.get('data', {})
        if not addrs:
            return {'error': 'Address not found'}
        key = list(addrs.keys())[0]
        a = addrs[key].get('address', {})
        return {
            'address': key,
            'balance': a.get('balance'),
            'received': a.get('received'),
            'spent': a.get('spent'),
            'transaction_count': a.get('transaction_count'),
            'first_seen': a.get('first_seen_receiving'),
            'last_seen': a.get('last_seen_receiving'),
        }

    def mempool(self) -> dict:
        """Get current mempool stats"""
        stats = self.info()
        if 'error' in stats:
            return stats
        return {
            'transactions': stats.get('mempool_transactions'),
            'size': stats.get('mempool_size'),
        }

    def price(self) -> dict:
        """Get current ZEC price data"""
        data = self._get(f"{self.api_base}/stats")
        if 'error' in data:
            return data
        s = data.get('data', {})
        return {
            'price_usd': s.get('market_price_usd'),
            'market_cap_usd': s.get('market_cap_usd'),
            'market_dominant': s.get('market_dominant'),
            'circulation': s.get('circulation'),
        }

    def network(self) -> dict:
        """Get network health and mining stats"""
        data = self._get(f"{self.api_base}/stats")
        if 'error' in data:
            return data
        s = data.get('data', {})
        return {
            'blocks': s.get('blocks'),
            'difficulty': s.get('difficulty'),
            'hashrate_24h': s.get('hashrate_24h'),
            'best_block_height': s.get('best_block_height'),
            'best_block_time': s.get('best_block_time'),
            'mempool_transactions': s.get('mempool_transactions'),
            'nodes': s.get('nodes'),
            'hodling_addresses': s.get('hodling_addresses'),
        }

    def search(self, query: str) -> dict:
        """Search for a block, tx, or address"""
        q = query.strip()
        if q.isdigit():
            return {'type': 'block', 'result': self.block(height=int(q))}
        if len(q) == 64:
            result = self.tx(txid=q)
            if 'error' not in result:
                return {'type': 'transaction', 'result': result}
            return {'type': 'block', 'result': self.block(hash=q)}
        if q.startswith(('t1', 't3', 'zs', 'zc')):
            return {'type': 'address', 'result': self.address(addr=q)}
        return {'error': f'Unknown query format: {q}'}

    # ── Status ──

    def status(self) -> dict:
        """Check status of running services"""
        result = {'api': None, 'app': None}
        try:
            r = requests.get(f'http://localhost:{self.api_port}/health', timeout=3)
            result['api'] = {'running': True, 'port': self.api_port, 'url': f'http://localhost:{self.api_port}'}
        except Exception:
            result['api'] = {'running': False, 'port': self.api_port}
        try:
            r = requests.get(f'http://localhost:{self.app_port}', timeout=3)
            result['app'] = {'running': r.status_code == 200, 'port': self.app_port, 'url': f'http://localhost:{self.app_port}'}
        except Exception:
            result['app'] = {'running': False, 'port': self.app_port}
        return result

    # ── Serve & App ──

    def serve(self, api_port=None, app_port=None, dev=True):
        """Start the Zcash API server and web app"""
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port
        cwd = str(self._dir)

        self.kill()

        # Start API
        api_log = open(self._log_dir / 'api.log', 'w')
        api_cmd = ['python3', '-m', 'uvicorn', 'api:app', '--host', '0.0.0.0', '--port', str(api_port)]
        if dev:
            api_cmd.append('--reload')

        env = os.environ.copy()
        env['PYTHONPATH'] = cwd
        subprocess.Popen(api_cmd, cwd=cwd, env=env, stdout=api_log, stderr=subprocess.STDOUT)

        # Start App
        app_dir = str(self._dir / 'app')
        if os.path.exists(app_dir):
            app_log = open(self._log_dir / 'app.log', 'w')
            app_env = os.environ.copy()
            app_env['NEXT_PUBLIC_API_URL'] = f'http://localhost:{api_port}'
            app_cmd = ['npx', 'next', 'dev', '-p', str(app_port)] if dev else ['npx', 'next', 'start', '-p', str(app_port)]
            subprocess.Popen(app_cmd, cwd=app_dir, env=app_env, stdout=app_log, stderr=subprocess.STDOUT)

        return {
            'api': f'http://localhost:{api_port}',
            'app': f'http://localhost:{app_port}',
            'dev': dev,
            'logs': str(self._log_dir),
        }

    def app(self, port=None, dev=True):
        """Start only the Zcash web explorer"""
        port = port or self.app_port
        app_dir = str(self._dir / 'app')
        if not os.path.exists(app_dir):
            return {"error": "App directory not found"}

        app_log = open(self._log_dir / 'app.log', 'w')
        app_env = os.environ.copy()
        app_env['NEXT_PUBLIC_API_URL'] = f'http://localhost:{self.api_port}'
        app_cmd = ['npx', 'next', 'dev', '-p', str(port)] if dev else ['npx', 'next', 'start', '-p', str(port)]
        subprocess.Popen(app_cmd, cwd=app_dir, env=app_env, stdout=app_log, stderr=subprocess.STDOUT)

        return {'status': 'running', 'port': port, 'url': f'http://localhost:{port}', 'logs': str(self._log_dir / 'app.log')}

    def kill(self, service=None):
        """Stop running services"""
        killed = []
        targets = ['api', 'app'] if not service else [service]

        for svc in targets:
            port = self.api_port if svc == 'api' else self.app_port
            try:
                result = subprocess.run(
                    ['lsof', '-ti', f':{port}'],
                    capture_output=True, text=True, timeout=5
                )
                for pid in result.stdout.strip().split('\n'):
                    if pid:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(f'{svc}:{pid}')
            except Exception:
                pass

        # Also try pm2
        try:
            import mod as m
            pm2 = m.mod('pm.pm2')()
            for name in [f'zcash-{t}' for t in targets]:
                if pm2.exists(name):
                    pm2.kill(name)
                    killed.append(f'pm2:{name}')
        except Exception:
            pass

        return {'killed': killed}

    def test(self):
        """Test Zcash API connectivity"""
        results = {}
        try:
            results['info'] = self.info()
            results['price'] = self.price()
            results['status'] = 'ok' if 'error' not in results['info'] else 'error'
        except Exception as e:
            results['status'] = 'error'
            results['error'] = str(e)
        return results
