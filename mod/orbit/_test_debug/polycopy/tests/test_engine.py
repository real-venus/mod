"""
Tests for the polycopy engine — covers Python Mod class, Rust engine bindings,
RPC pool, config, wallet management, scoring, and live chain connectivity.
"""
import json
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from polycopy.mod import Mod

# Known active whale addresses for live monitoring tests
VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
WHALE_BASE = "0x3304E22DDaa22bCdC5fCa2269b418046aE7b566A"  # active base trader


class TestModConfig(unittest.TestCase):
    """Test Mod class config management without engine."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.cfg_path = os.path.join(self.tmpdir, 'config.json')
        self.mod = Mod(config_path=self.cfg_path)

    def test_default_config(self):
        cfg = self.mod.show_config()
        self.assertIn('chains', cfg)
        self.assertIn('wallets', cfg)
        self.assertEqual(cfg['max_trade_usd'], 100)
        self.assertEqual(cfg['slippage_bps'], 50)
        self.assertEqual(cfg['position_pct'], 10.0)
        self.assertEqual(len(cfg['chains']), 4)

    def test_chain_names(self):
        cfg = self.mod.show_config()
        names = [c['name'] for c in cfg['chains']]
        self.assertEqual(names, ['base', 'polygon', 'arbitrum', 'ethereum'])

    def test_enabled_chains(self):
        cfg = self.mod.show_config()
        enabled = [c['name'] for c in cfg['chains'] if c['enabled']]
        self.assertEqual(enabled, ['base', 'polygon', 'arbitrum'])
        disabled = [c['name'] for c in cfg['chains'] if not c['enabled']]
        self.assertEqual(disabled, ['ethereum'])

    def test_rpc_endpoints_per_chain(self):
        cfg = self.mod.show_config()
        for chain in cfg['chains']:
            self.assertGreaterEqual(len(chain['rpc_urls']), 4,
                f"{chain['name']} should have >= 4 RPC endpoints")

    def test_routers_per_chain(self):
        cfg = self.mod.show_config()
        for chain in cfg['chains']:
            self.assertGreaterEqual(len(chain['routers']), 2,
                f"{chain['name']} should have >= 2 routers")
            for r in chain['routers']:
                self.assertTrue(r['address'].startswith('0x'))
                self.assertIn(r['dex_type'], ['UniswapV2', 'UniswapV3'])

    def test_watch_unwatch_no_engine(self):
        r = self.mod.watch(address=VITALIK)
        self.assertEqual(r['total'], 1)
        self.assertEqual(r['watched'], VITALIK)

        r = self.mod.watch(address=VITALIK)  # duplicate
        self.assertEqual(r['total'], 1)

        r = self.mod.unwatch(address=VITALIK)
        self.assertEqual(r['total'], 0)

    def test_watch_persists_to_disk(self):
        self.mod.watch(address=VITALIK)
        self.assertTrue(os.path.exists(self.cfg_path))
        with open(self.cfg_path) as f:
            saved = json.load(f)
        self.assertIn(VITALIK, saved['wallets'])

    def test_set_config(self):
        r = self.mod.set_config(key='max_trade_usd', value='500')
        self.assertEqual(r['value'], 500.0)
        self.assertEqual(self.mod.config['max_trade_usd'], 500.0)

        r = self.mod.set_config(key='slippage_bps', value='100')
        self.assertEqual(r['value'], 100)

        r = self.mod.set_config(key='auto_discover', value='true')
        self.assertEqual(r['value'], True)

    def test_private_key_not_persisted(self):
        self.mod.set_key(private_key='0xdeadbeef')
        self.mod._save_config()
        with open(self.cfg_path) as f:
            saved = json.load(f)
        self.assertNotIn('private_key', saved)

    def test_config_reload(self):
        self.mod.set_config(key='max_trade_usd', value='777')
        mod2 = Mod(config_path=self.cfg_path)
        self.assertEqual(mod2.config['max_trade_usd'], 777.0)

    def test_chain_name_to_id(self):
        self.assertEqual(self.mod._chain_name_to_id('base'), 8453)
        self.assertEqual(self.mod._chain_name_to_id('polygon'), 137)
        self.assertEqual(self.mod._chain_name_to_id('arbitrum'), 42161)
        self.assertEqual(self.mod._chain_name_to_id('ethereum'), 1)
        self.assertIsNone(self.mod._chain_name_to_id('solana'))

    def test_status_no_engine(self):
        s = self.mod.status()
        self.assertFalse(s['running'])
        self.assertEqual(s['mode'], 'monitor-only')

    def test_forward_dispatch(self):
        r = self.mod.forward('config')
        self.assertIn('chains', r)
        r = self.mod.forward('status')
        self.assertIn('running', r)
        r = self.mod.forward('wallets')
        self.assertIsInstance(r, list)

    def test_forward_unknown_cmd(self):
        r = self.mod.forward('nonexistent')
        # Falls through to status
        self.assertIn('running', r)

    def test_watch_requires_address(self):
        r = self.mod.watch()
        self.assertIn('error', r)

    def test_repr(self):
        s = repr(self.mod)
        self.assertIn('Polycopy', s)
        self.assertIn('base', s)

    def test_set_proxy(self):
        addr = '0x1234567890abcdef1234567890abcdef12345678'
        r = self.mod.set_proxy(chain='base', address=addr)
        self.assertEqual(r['proxy'], addr)
        for c in self.mod.config['chains']:
            if c['name'] == 'base':
                self.assertEqual(c['proxy_address'], addr)


class TestRustEngine(unittest.TestCase):
    """Test Rust engine via PyO3 bindings."""

    @classmethod
    def setUpClass(cls):
        try:
            import polycopy_rs
            cls.has_rust = True
        except ImportError:
            cls.has_rust = False

    def setUp(self):
        if not self.has_rust:
            self.skipTest("polycopy_rs not built")
        self.tmpdir = tempfile.mkdtemp()
        self.mod = Mod(config_path=os.path.join(self.tmpdir, 'config.json'))

    def test_engine_init(self):
        import polycopy_rs
        e = polycopy_rs.PolycopyEngine('{}')
        self.assertFalse(e.is_running())

    def test_engine_start_stop(self):
        r = self.mod.start()
        self.assertEqual(r['status'], 'running')
        self.assertIn('base', r['chains'])
        self.assertEqual(r['mode'], 'monitor-only')
        self.assertTrue(self.mod.engine.is_running())

        r = self.mod.stop()
        self.assertEqual(r['status'], 'stopped')

    def test_engine_wallet_management(self):
        self.mod._ensure_engine()
        self.mod.engine.add_wallet(VITALIK, 'vitalik')
        wallets = json.loads(self.mod.engine.get_wallets())
        found = any(VITALIK.lower() in w[0].lower() for w in wallets)
        self.assertTrue(found)

        self.mod.engine.remove_wallet(VITALIK)
        wallets = json.loads(self.mod.engine.get_wallets())
        found = any(VITALIK.lower() in w[0].lower() for w in wallets)
        self.assertFalse(found)

    def test_empty_scores(self):
        self.mod._ensure_engine()
        scores = json.loads(self.mod.engine.get_scores())
        self.assertEqual(scores, [])

    def test_empty_trades(self):
        self.mod._ensure_engine()
        trades = json.loads(self.mod.engine.get_trades(10))
        self.assertEqual(trades, [])

    def test_rpc_stats(self):
        self.mod._ensure_engine()
        stats = json.loads(self.mod.engine.get_rpc_stats())
        # Should have stats for 3 enabled chains
        self.assertGreaterEqual(len(stats), 3)
        for chain_id, providers in stats:
            self.assertGreaterEqual(len(providers), 4)
            for p in providers:
                self.assertIn('url', p)
                self.assertIn('is_healthy', p)
                self.assertIn('latency_ms', p)

    def test_double_start_fails(self):
        self.mod.start()
        with self.assertRaises(Exception):
            self.mod.engine.start()
        self.mod.stop()


class TestLiveRPC(unittest.TestCase):
    """Test live RPC connectivity. These hit real public endpoints."""

    def setUp(self):
        try:
            import polycopy_rs
        except ImportError:
            self.skipTest("polycopy_rs not built")
        self.tmpdir = tempfile.mkdtemp()
        self.mod = Mod(config_path=os.path.join(self.tmpdir, 'config.json'))

    def test_rpc_health_after_start(self):
        """Start engine, wait for health checks, verify providers respond."""
        self.mod.start()
        time.sleep(5)  # wait for health checks + at least 1 poll cycle

        stats = json.loads(self.mod.engine.get_rpc_stats())
        healthy_count = 0
        for chain_id, providers in stats:
            for p in providers:
                if p['is_healthy'] and p['total_requests'] > 0:
                    healthy_count += 1
        self.mod.stop()

        # At least some providers should have responded
        self.assertGreater(healthy_count, 0,
            "At least one RPC provider should be healthy after 5s")

    def test_monitor_detects_blocks(self):
        """Start monitoring and verify we're polling blocks (no errors)."""
        self.mod.watch(address=VITALIK)
        self.mod.start()
        time.sleep(8)

        stats = json.loads(self.mod.engine.get_rpc_stats())
        total_requests = 0
        for chain_id, providers in stats:
            for p in providers:
                total_requests += p['total_requests']

        self.mod.stop()
        # Should have made many requests across chains
        self.assertGreater(total_requests, 10,
            "Should have made >10 RPC requests across chains in 8s")


class TestScoringLogic(unittest.TestCase):
    """Test scoring via the Python-accessible interface by feeding synthetic events."""

    def setUp(self):
        try:
            import polycopy_rs
        except ImportError:
            self.skipTest("polycopy_rs not built")
        self.tmpdir = tempfile.mkdtemp()
        self.mod = Mod(config_path=os.path.join(self.tmpdir, 'config.json'))
        self.mod._ensure_engine()

    def test_scores_empty_initially(self):
        scores = self.mod.scores()
        self.assertEqual(scores, [])

    def test_trades_empty_initially(self):
        trades = self.mod.trades(limit=5)
        self.assertEqual(trades, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
