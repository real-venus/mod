import json
import os
import sys
import time

class Mod:
    description = """
    Multi-chain copy trading engine.
    Monitors profitable wallets across Base, Polygon, Arbitrum, Ethereum.
    Executes copy trades through on-chain CopyTradeProxy contracts.
    Rust-powered core with PyO3 bindings for speed.
    """

    DEFAULT_CONFIG = {
        'chains': [
            {
                'chain_id': 8453, 'name': 'base', 'enabled': True,
                'rpc_urls': [
                    'https://mainnet.base.org',
                    'https://base.llamarpc.com',
                    'https://base-rpc.publicnode.com',
                    'https://base.drpc.org',
                    'https://rpc.ankr.com/base',
                ],
                'routers': [
                    {'address': '0x2626664c2603336E57B271c5C0b26F421741e481', 'name': 'Uniswap V3', 'dex_type': 'UniswapV3'},
                    {'address': '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891', 'name': 'SushiSwap', 'dex_type': 'UniswapV2'},
                ],
                'proxy_address': None,
            },
            {
                'chain_id': 137, 'name': 'polygon', 'enabled': True,
                'rpc_urls': [
                    'https://polygon-rpc.com',
                    'https://polygon.llamarpc.com',
                    'https://polygon-bor-rpc.publicnode.com',
                    'https://polygon.drpc.org',
                    'https://rpc.ankr.com/polygon',
                ],
                'routers': [
                    {'address': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'name': 'Uniswap V3', 'dex_type': 'UniswapV3'},
                    {'address': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', 'name': 'SushiSwap', 'dex_type': 'UniswapV2'},
                    {'address': '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', 'name': 'QuickSwap', 'dex_type': 'UniswapV2'},
                ],
                'proxy_address': None,
            },
            {
                'chain_id': 42161, 'name': 'arbitrum', 'enabled': True,
                'rpc_urls': [
                    'https://arb1.arbitrum.io/rpc',
                    'https://arbitrum.llamarpc.com',
                    'https://arbitrum-one-rpc.publicnode.com',
                    'https://arbitrum.drpc.org',
                    'https://rpc.ankr.com/arbitrum',
                ],
                'routers': [
                    {'address': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'name': 'Uniswap V3', 'dex_type': 'UniswapV3'},
                    {'address': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', 'name': 'SushiSwap', 'dex_type': 'UniswapV2'},
                    {'address': '0xc873fEcbd354f5A56E00E710B90EF4201db2448d', 'name': 'Camelot', 'dex_type': 'UniswapV2'},
                ],
                'proxy_address': None,
            },
            {
                'chain_id': 1, 'name': 'ethereum', 'enabled': False,
                'rpc_urls': [
                    'https://eth.llamarpc.com',
                    'https://ethereum-rpc.publicnode.com',
                    'https://eth.drpc.org',
                    'https://rpc.ankr.com/eth',
                    'https://rpc.flashbots.net',
                ],
                'routers': [
                    {'address': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'name': 'Uniswap V3', 'dex_type': 'UniswapV3'},
                    {'address': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', 'name': 'SushiSwap', 'dex_type': 'UniswapV2'},
                ],
                'proxy_address': None,
            },
        ],
        'wallets': [],
        'max_trade_usd': 100,
        'slippage_bps': 50,
        'position_pct': 10.0,
        'daily_limit_usd': 1000,
        'auto_discover': False,
        'min_score': 70.0,
        'private_key': None,
        'poll_interval_ms': 4000,
    }

    def __init__(self, config_path=None, **kwargs):
        self.dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.config_path = config_path or os.path.join(self.dir, 'config.json')
        self.config = self._load_config()
        self.config.update({k: v for k, v in kwargs.items() if v is not None})
        self.engine = None

    def _load_config(self):
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                saved = json.load(f)
            # Merge with defaults
            cfg = dict(self.DEFAULT_CONFIG)
            cfg.update(saved)
            return cfg
        return dict(self.DEFAULT_CONFIG)

    def _save_config(self):
        # Don't persist private_key to disk
        save = {k: v for k, v in self.config.items() if k != 'private_key'}
        with open(self.config_path, 'w') as f:
            json.dump(save, f, indent=2)

    def _ensure_engine(self):
        if self.engine is None:
            try:
                import polycopy_rs
                self.engine = polycopy_rs.PolycopyEngine(json.dumps(self.config))
            except ImportError:
                raise RuntimeError(
                    "polycopy_rs not built. Run:\n"
                    f"  cd {os.path.join(self.dir, 'polycopy-rs')}\n"
                    "  maturin develop --release"
                )

    # === CLI dispatch ===

    def forward(self, cmd='status', **kwargs):
        commands = {
            'start': self.start,
            'stop': self.stop,
            'status': self.status,
            'watch': self.watch,
            'unwatch': self.unwatch,
            'scores': self.scores,
            'trades': self.trades,
            'pause': self.pause,
            'unpause': self.unpause,
            'config': self.show_config,
            'set': self.set_config,
            'rpc': self.rpc_stats,
            'wallets': self.list_wallets,
            'build': self.build,
        }
        fn = commands.get(cmd, self.status)
        return fn(**kwargs)

    # === Core operations ===

    def start(self, **kwargs):
        """Start the copy trading engine."""
        self._ensure_engine()
        self.engine.start()
        self._save_config()
        return {
            'status': 'running',
            'chains': [c['name'] for c in self.config['chains'] if c['enabled']],
            'wallets': len(self.config['wallets']),
            'mode': 'auto-execute' if self.config.get('private_key') else 'monitor-only',
        }

    def stop(self, **kwargs):
        """Stop the engine."""
        if self.engine:
            self.engine.stop()
        return {'status': 'stopped'}

    def status(self, **kwargs):
        """Get engine status."""
        running = False
        if self.engine:
            try:
                running = self.engine.is_running()
            except:
                pass
        return {
            'running': running,
            'chains': [
                {'name': c['name'], 'chain_id': c['chain_id'], 'enabled': c['enabled'],
                 'proxy': c.get('proxy_address')}
                for c in self.config['chains']
            ],
            'wallets': len(self.config['wallets']),
            'max_trade_usd': self.config['max_trade_usd'],
            'slippage_bps': self.config['slippage_bps'],
            'position_pct': self.config['position_pct'],
            'daily_limit_usd': self.config['daily_limit_usd'],
            'mode': 'auto-execute' if self.config.get('private_key') else 'monitor-only',
        }

    def watch(self, address=None, label=None, **kwargs):
        """Add a wallet to watch list."""
        if not address:
            return {'error': 'address required'}
        if address not in self.config['wallets']:
            self.config['wallets'].append(address)
            self._save_config()
        if self.engine:
            self.engine.add_wallet(address, label)
        return {'watched': address, 'total': len(self.config['wallets'])}

    def unwatch(self, address=None, **kwargs):
        """Remove a wallet from watch list."""
        if not address:
            return {'error': 'address required'}
        if address in self.config['wallets']:
            self.config['wallets'].remove(address)
            self._save_config()
        if self.engine:
            self.engine.remove_wallet(address)
        return {'unwatched': address, 'total': len(self.config['wallets'])}

    def list_wallets(self, **kwargs):
        """List watched wallets."""
        if self.engine:
            return json.loads(self.engine.get_wallets())
        return self.config['wallets']

    def scores(self, **kwargs):
        """Get trader scores."""
        self._ensure_engine()
        return json.loads(self.engine.get_scores())

    def trades(self, limit=20, **kwargs):
        """Get recent trades."""
        self._ensure_engine()
        return json.loads(self.engine.get_trades(int(limit)))

    def pause(self, chain_id=None, chain=None, **kwargs):
        """Pause trading on a chain."""
        cid = chain_id or self._chain_name_to_id(chain)
        if not cid:
            return {'error': 'chain_id or chain name required'}
        self._ensure_engine()
        tx = self.engine.pause(int(cid))
        return {'paused': cid, 'tx': tx}

    def unpause(self, chain_id=None, chain=None, **kwargs):
        """Unpause trading on a chain."""
        cid = chain_id or self._chain_name_to_id(chain)
        if not cid:
            return {'error': 'chain_id or chain name required'}
        self._ensure_engine()
        tx = self.engine.unpause(int(cid))
        return {'unpaused': cid, 'tx': tx}

    def rpc_stats(self, **kwargs):
        """Get RPC provider pool stats."""
        self._ensure_engine()
        return json.loads(self.engine.get_rpc_stats())

    # === Configuration ===

    def show_config(self, **kwargs):
        """Show current config (without private key)."""
        return {k: v for k, v in self.config.items() if k != 'private_key'}

    def set_config(self, key=None, value=None, **kwargs):
        """Set a config value."""
        if not key:
            return {'error': 'key required', 'keys': list(self.DEFAULT_CONFIG.keys())}

        if key in ('max_trade_usd', 'daily_limit_usd', 'position_pct', 'min_score'):
            value = float(value)
        elif key in ('slippage_bps', 'poll_interval_ms'):
            value = int(value)
        elif key in ('auto_discover',):
            value = str(value).lower() in ('true', '1', 'yes')

        self.config[key] = value
        self._save_config()
        return {'set': key, 'value': value}

    def set_proxy(self, chain_id=None, chain=None, address=None, **kwargs):
        """Set proxy contract address for a chain."""
        cid = chain_id or self._chain_name_to_id(chain)
        if not cid or not address:
            return {'error': 'chain_id/chain and address required'}
        for c in self.config['chains']:
            if c['chain_id'] == int(cid):
                c['proxy_address'] = address
                break
        self._save_config()
        if self.engine:
            self.engine.set_proxy_address(int(cid), address)
        return {'chain': cid, 'proxy': address}

    def set_key(self, private_key=None, **kwargs):
        """Set the private key for trade execution (not persisted to disk)."""
        if not private_key:
            return {'error': 'private_key required'}
        self.config['private_key'] = private_key
        return {'key_set': True, 'note': 'restart engine for changes to take effect'}

    # === Build ===

    def build(self, **kwargs):
        """Build the Rust bindings."""
        rs_dir = os.path.join(self.dir, 'polycopy-rs')
        if not os.path.exists(rs_dir):
            return {'error': f'Rust crate not found at {rs_dir}'}
        ret = os.system(f'cd {rs_dir} && maturin develop --release')
        if ret == 0:
            return {'status': 'built', 'path': rs_dir}
        return {'status': 'build_failed', 'exit_code': ret}

    # === Helpers ===

    def _chain_name_to_id(self, name):
        if not name:
            return None
        name = name.lower()
        for c in self.config['chains']:
            if c['name'] == name:
                return c['chain_id']
        return None

    def __repr__(self):
        running = False
        if self.engine:
            try:
                running = self.engine.is_running()
            except:
                pass
        chains = [c['name'] for c in self.config['chains'] if c['enabled']]
        return f"<Polycopy chains={chains} wallets={len(self.config['wallets'])} running={running}>"
