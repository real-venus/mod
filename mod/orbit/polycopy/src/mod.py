"""
polycopy - multi-chain copy trading engine

Rust-powered core (polycopy_rs) with PyO3 bindings for monitoring
swap events, scoring traders, and executing copy trades across
Base, Polygon, Arbitrum, and Ethereum.

Usage:
    import mod as m
    pc = m.mod('polycopy')()
    pc.forward('status')
    pc.forward('start')
    pc.forward('watch', address='0x...')
    pc.forward('scrape', min_trades_per_day=10)
"""
import json
import os

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SRC_DIR)


class Mod:
    description = """
    Multi-chain copy trading engine.
    Monitors profitable wallets across Base, Polygon, Arbitrum, Ethereum.
    Executes copy trades through on-chain CopyTradeProxy contracts.
    Rust-powered core with PyO3 bindings for speed.
    """

    def __init__(self, config_path=None, **kwargs):
        self.dir = ROOT_DIR
        self.config_path = config_path or os.path.join(ROOT_DIR, 'config.json')
        self.config = self._load_config()
        self.config.update({k: v for k, v in kwargs.items() if v is not None})
        self.engine = None

    def _load_config(self):
        if os.path.exists(self.config_path):
            with open(self.config_path) as f:
                return json.load(f)
        return {}

    def _save_config(self):
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
                    f"  cd {os.path.join(SRC_DIR, 'polycopy-rs')}\n"
                    "  maturin develop --release"
                )

    # ── dispatch ────────────────────────────────────────────────────

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

    # ── engine ops ──────────────────────────────────────────────────

    def start(self, **kwargs):
        self._ensure_engine()
        self.engine.start()
        self._save_config()
        chains = [c['name'] for c in self.config.get('chains', []) if c.get('enabled')]
        return {'status': 'running', 'chains': chains}

    def stop(self, **kwargs):
        if self.engine:
            self.engine.stop()
        return {'status': 'stopped'}

    def status(self, **kwargs):
        running = False
        if self.engine:
            try:
                running = self.engine.is_running()
            except Exception:
                pass
        return {
            'running': running,
            'chains': [
                {'name': c['name'], 'chain_id': c['chain_id'], 'enabled': c.get('enabled')}
                for c in self.config.get('chains', [])
            ],
            'wallets': len(self.config.get('wallets', [])),
        }

    def watch(self, address=None, label=None, **kwargs):
        if not address:
            return {'error': 'address required'}
        wallets = self.config.setdefault('wallets', [])
        if address not in wallets:
            wallets.append(address)
            self._save_config()
        if self.engine:
            self.engine.add_wallet(address, label)
        return {'watched': address, 'total': len(wallets)}

    def unwatch(self, address=None, **kwargs):
        if not address:
            return {'error': 'address required'}
        wallets = self.config.get('wallets', [])
        if address in wallets:
            wallets.remove(address)
            self._save_config()
        if self.engine:
            self.engine.remove_wallet(address)
        return {'unwatched': address, 'total': len(wallets)}

    def list_wallets(self, **kwargs):
        if self.engine:
            return json.loads(self.engine.get_wallets())
        return self.config.get('wallets', [])

    def scores(self, **kwargs):
        self._ensure_engine()
        return json.loads(self.engine.get_scores())

    def trades(self, limit=20, **kwargs):
        self._ensure_engine()
        return json.loads(self.engine.get_trades(int(limit)))

    def pause(self, chain_id=None, chain=None, **kwargs):
        cid = chain_id or self._chain_id(chain)
        if not cid:
            return {'error': 'chain_id or chain name required'}
        self._ensure_engine()
        tx = self.engine.pause(int(cid))
        return {'paused': cid, 'tx': tx}

    def unpause(self, chain_id=None, chain=None, **kwargs):
        cid = chain_id or self._chain_id(chain)
        if not cid:
            return {'error': 'chain_id or chain name required'}
        self._ensure_engine()
        tx = self.engine.unpause(int(cid))
        return {'unpaused': cid, 'tx': tx}

    def rpc_stats(self, **kwargs):
        self._ensure_engine()
        return json.loads(self.engine.get_rpc_stats())

    # ── config ──────────────────────────────────────────────────────

    def show_config(self, **kwargs):
        return {k: v for k, v in self.config.items() if k != 'private_key'}

    def set_config(self, key=None, value=None, **kwargs):
        if not key:
            return {'error': 'key required'}
        FLOAT_KEYS = ('max_trade_usd', 'daily_limit_usd', 'position_pct', 'min_score')
        INT_KEYS = ('slippage_bps', 'poll_interval_ms')
        BOOL_KEYS = ('auto_discover',)
        if key in FLOAT_KEYS:
            value = float(value)
        elif key in INT_KEYS:
            value = int(value)
        elif key in BOOL_KEYS:
            value = str(value).lower() in ('true', '1', 'yes')
        self.config[key] = value
        self._save_config()
        return {'set': key, 'value': value}

    # ── build ───────────────────────────────────────────────────────

    def build(self, **kwargs):
        rs_dir = os.path.join(SRC_DIR, 'polycopy-rs')
        if not os.path.exists(rs_dir):
            return {'error': f'Rust crate not found at {rs_dir}'}
        ret = os.system(f'cd {rs_dir} && maturin develop --release')
        return {'status': 'built' if ret == 0 else 'failed', 'exit_code': ret}

    # ── helpers ─────────────────────────────────────────────────────

    def _chain_id(self, name):
        if not name:
            return None
        for c in self.config.get('chains', []):
            if c['name'] == name.lower():
                return c['chain_id']
        return None

    def __repr__(self):
        running = False
        if self.engine:
            try:
                running = self.engine.is_running()
            except Exception:
                pass
        chains = [c['name'] for c in self.config.get('chains', []) if c.get('enabled')]
        return f"<Polycopy chains={chains} wallets={len(self.config.get('wallets', []))} running={running}>"
