"""BlocTime — Time-weighted staking module

Stake native tokens for blocks, earn BLOC tokens via duration multiplier curve.

Contracts:
  BlocTime — ERC20 + staking (deployed on Base Sepolia)

Usage:
  m.fn('bloctime/overview')()
  m.fn('bloctime/serve')()
  m.fn('bloctime/kill')()
  m.fn('bloctime/status')()
"""

import json
import os
import signal
import subprocess
from pathlib import Path

import mod as m

Chain = m.mod('chain')

DIR = Path(__file__).parent
ROOT = DIR.parent
API_PORT = 8851
APP_PORT = 8852


class Mod(Chain):
    """BlocTime module — full chain interface with time-weighted staking.

    Inherits all chain functionality (Web3, contracts, tokens, registry,
    treasury, market, etc.) and adds BlocTime-specific helpers plus
    serve/kill for the API + app.
    """

    description = "BlocTime — time-weighted staking with full chain interface"

    def __init__(self, network='testnet', key='test', **kwargs):
        super().__init__(network=network, key=key)
        self.module_dir = ROOT
        self.api_port = API_PORT
        self.app_port = APP_PORT
        self.config = self._load_config()

    def _load_config(self):
        cfg_path = self.module_dir / 'config.json'
        if cfg_path.exists():
            with open(cfg_path) as f:
                return json.load(f)
        return {}

    # ── Default entry point ───────────────────────────────────────────

    def forward(self, **kwargs):
        return self.overview()

    # ── Overview ──────────────────────────────────────────────────────

    def overview(self, address=None):
        """Get BlocTime staking overview for an address."""
        addr = address or self.account.address
        stake_ids = self.get_user_stake_ids(addr)
        positions = []
        for sid in stake_ids:
            try:
                pos = self.get_stake_position(addr, sid)
                pos['stake_id'] = sid
                positions.append(pos)
            except Exception as e:
                m.print(f'Error getting stake {sid}: {e}', color='red')

        total_staked = sum(p.get('amount', 0) for p in positions)
        total_bloctime = sum(p.get('bloctime_balance', 0) for p in positions)

        return {
            'address': addr,
            'stake_count': len(positions),
            'total_staked': total_staked,
            'total_bloctime': total_bloctime,
            'positions': positions,
        }

    # ── Deploy / Test (via chain module) ──────────────────────────────

    def deploy(self, network='testnet'):
        """Deploy BlocTime contract via the chain module's deployment system."""
        return self.deploy_contract('bloctime', network=network)

    def test(self):
        """Run chain-level tests for BlocTime."""
        return self.test_contract('bloctime')

    # ── Status ────────────────────────────────────────────────────────

    def status(self):
        cfg_path = self.module_dir / 'config.json'
        if not cfg_path.exists():
            return {'deployed': False}
        with open(cfg_path) as f:
            data = json.load(f)
        network = os.environ.get('NETWORK', 'testnet')
        contracts = data.get('contracts', {}).get(network, {})
        return {
            'deployed': bool(contracts),
            'network': network,
            'urls': data.get('urls', {}),
            'contracts': contracts,
            'explorer': f"https://sepolia.basescan.org/address/{contracts.get('bloctime', '')}" if contracts.get('bloctime') else None,
        }

    # ── Serve ─────────────────────────────────────────────────────────

    def serve(self, api_port=None, app_port=None, dev=True):
        """Launch the BlocTime API (FastAPI) and app (Next.js)."""
        api_port = int(api_port or self.api_port)
        app_port = int(app_port or self.app_port)
        log_dir = Path('/tmp/bloctime')
        log_dir.mkdir(parents=True, exist_ok=True)
        results = {}

        self.kill()

        api_url = f'http://localhost:{api_port}'
        app_url = f'http://localhost:{app_port}'

        # Start API
        api_dir = self.module_dir / 'src' / 'api'
        mod_root = str(self.module_dir.parent.parent)
        env = os.environ.copy()
        env['PYTHONPATH'] = f"{mod_root}:{self.module_dir}:{env.get('PYTHONPATH', '')}"
        env['PORT'] = str(api_port)

        api_log = open(log_dir / 'api.log', 'w')
        api_cmd = [
            'python3', '-m', 'uvicorn', 'api:app',
            '--host', '0.0.0.0', '--port', str(api_port),
            '--app-dir', str(api_dir),
        ]
        if dev:
            api_cmd.append('--reload')

        subprocess.Popen(api_cmd, env=env, stdout=api_log, stderr=subprocess.STDOUT)
        results['api'] = api_url
        results['api_docs'] = f'{api_url}/docs'
        results['api_log'] = str(log_dir / 'api.log')

        # Start App
        app_dir = self.module_dir / 'src' / 'app'
        if (app_dir / 'package.json').exists():
            app_env = os.environ.copy()
            app_env['NEXT_PUBLIC_API_URL'] = api_url
            app_env['PORT'] = str(app_port)
            app_log = open(log_dir / 'app.log', 'w')
            app_cmd = ['npx', 'next', 'dev' if dev else 'start', '-p', str(app_port)]
            subprocess.Popen(
                app_cmd, cwd=str(app_dir), env=app_env,
                stdout=app_log, stderr=subprocess.STDOUT,
            )
            results['app'] = app_url
            results['app_log'] = str(log_dir / 'app.log')

        # Save urls to config
        self._save_urls(api_url, app_url)

        results['dev'] = dev
        results['logs'] = str(log_dir)
        return results

    def _save_urls(self, api_url, app_url):
        cfg_path = self.module_dir / 'config.json'
        cfg = {}
        if cfg_path.exists():
            with open(cfg_path) as f:
                cfg = json.load(f)
        cfg['urls'] = {'api': api_url, 'app': app_url}
        with open(cfg_path, 'w') as f:
            json.dump(cfg, f, indent=2)
        self.config = cfg

    # ── Kill ──────────────────────────────────────────────────────────

    def kill(self):
        """Kill the BlocTime API and app processes."""
        killed = []
        for pattern in [f'uvicorn.*api:app.*{self.api_port}', f'next.*{self.app_port}']:
            try:
                result = subprocess.run(
                    ['pgrep', '-f', pattern], capture_output=True, text=True,
                )
                for pid in result.stdout.strip().split('\n'):
                    if pid:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(pid)
            except Exception:
                pass
        return {'killed': killed}

    def kill_api(self):
        """Kill only the API process."""
        killed = []
        try:
            result = subprocess.run(
                ['pgrep', '-f', f'uvicorn.*api:app.*{self.api_port}'],
                capture_output=True, text=True,
            )
            for pid in result.stdout.strip().split('\n'):
                if pid:
                    os.kill(int(pid), signal.SIGTERM)
                    killed.append(pid)
        except Exception:
            pass
        return {'killed': killed}

    def kill_app(self):
        """Kill only the app process."""
        killed = []
        try:
            result = subprocess.run(
                ['pgrep', '-f', f'next.*{self.app_port}'],
                capture_output=True, text=True,
            )
            for pid in result.stdout.strip().split('\n'):
                if pid:
                    os.kill(int(pid), signal.SIGTERM)
                    killed.append(pid)
        except Exception:
            pass
        return {'killed': killed}
