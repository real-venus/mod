"""
Tests for the Uniswap V3 connector module.

Unit tests (offline, mocked) + integration tests (live network).
Run: pytest test/ -v
Run unit only: pytest test/ -v -m 'not live'
Run live only: pytest test/ -v -m live
"""

import json
import time
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from uniswap.mod import Mod


# ── Fixtures ─────────────────────────────────────────────

@pytest.fixture
def mod():
    return Mod()


@pytest.fixture
def mod_with_tmpdir(tmp_path):
    """Mod with data_dir pointing to a temp directory."""
    m = Mod()
    m.data_dir = tmp_path
    m.cache_dir = tmp_path / 'cache'
    m.cache_dir.mkdir(exist_ok=True)
    return m


# ── Sample data ──────────────────────────────────────────

SAMPLE_SWAP_LOG = {
    'address': '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
    'topics': [
        '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
        '0x000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564',
        '0x000000000000000000000000eeaa2562f89bd75d920d785aacd0c401a0105597',
    ],
    'data': '0x'
           'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0bdc0'  # amount0 = -1000000 (negative)
           '000000000000000000000000000000000000000000000000002386f26fc10000'  # amount1 = 10000000000000000
           '0000000000000000000000000000000000000160e4dea477b67f07cf4be19a0a'  # sqrtPriceX96
           '00000000000000000000000000000000000000000000000004b1d0d4fa9d6c33'  # liquidity
           '00000000000000000000000000000000000000000000000000000000000309af',  # tick = 198063
    'blockNumber': '0x17b4d80',
    'transactionHash': '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    'logIndex': '0x5',
}

SAMPLE_RPC_RESPONSE = {
    'jsonrpc': '2.0',
    'id': 1,
    'result': '0x17b4d80',  # block 24894848
}


# ═══════════════════════════════════════════════════════════
# Unit Tests (offline, mocked)
# ═══════════════════════════════════════════════════════════

class TestModInit:
    def test_init_defaults(self, mod):
        assert mod.name == 'uniswap'
        assert mod.data_dir.exists()
        assert isinstance(mod.CHAINS, dict)
        assert len(mod.CHAINS) == 5

    def test_chains_method(self, mod):
        chains = mod.chains()
        assert 'ethereum' in chains
        assert 'arbitrum' in chains
        assert 'base' in chains
        assert 'polygon' in chains
        assert 'optimism' in chains
        for c in chains.values():
            assert 'name' in c
            assert 'chain_id' in c
            assert 'rpcs' in c
            assert c['rpcs'] == 4  # all chains have 4 RPCs

    def test_health(self, mod):
        h = mod.health()
        assert h['status'] == 'ok'
        assert h['module'] == 'uniswap'
        assert len(h['chains']) == 5
        assert len(h['sources']) == 3

    def test_init_with_api_key(self):
        m = Mod(api_key='test-key-123')
        assert m.api_key == 'test-key-123'

    def test_init_env_api_key(self):
        with patch.dict(os.environ, {'THEGRAPH_API_KEY': 'env-key'}):
            m = Mod()
            assert m.api_key == 'env-key'


class TestParseSwapLog:
    def test_parse_valid_log(self, mod):
        result = mod._parse_swap_log(SAMPLE_SWAP_LOG)
        assert result is not None
        assert result['pool'] == '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'
        assert result['sender'] == '0xe592427a0aece92de3edee1f18e0157c05861564'
        assert result['recipient'] == '0xeeaa2562f89bd75d920d785aacd0c401a0105597'
        assert result['amount0'] < 0  # negative amount
        assert result['amount1'] > 0  # positive amount
        assert result['block'] == 0x17b4d80
        assert result['logIndex'] == 5

    def test_parse_short_data(self, mod):
        bad_log = {'data': '0xabcd', 'topics': []}
        assert mod._parse_swap_log(bad_log) is None

    def test_parse_empty_data(self, mod):
        bad_log = {'data': '0x', 'topics': []}
        assert mod._parse_swap_log(bad_log) is None

    def test_parse_missing_topics(self, mod):
        log = {**SAMPLE_SWAP_LOG, 'topics': [SAMPLE_SWAP_LOG['topics'][0]]}
        result = mod._parse_swap_log(log)
        assert result is not None
        assert result['sender'] == ''
        assert result['recipient'] == ''

    def test_parse_signed_amounts(self, mod):
        """Verify two's complement signed int decoding."""
        result = mod._parse_swap_log(SAMPLE_SWAP_LOG)
        assert result['amount0'] == -1000000  # 0xfff...f0bdc0 → -1000000
        assert result['amount1'] == 10000000000000000  # 0x2386f26fc10000


class TestLocalFS:
    def test_save_and_load(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        data = [{'token': 'WETH', 'price': 3500}]
        result = m.save_data(data, 'test_pools', 'ethereum')

        assert 'filename' in result
        assert result['filename'].startswith('ethereum_test_pools_')
        assert result['filename'].endswith('.json')
        assert result['size'] > 0

        loaded = m.load_data(result['filename'])
        assert loaded['chain'] == 'ethereum'
        assert loaded['name'] == 'test_pools'
        assert loaded['count'] == 1
        assert loaded['data'] == data

    def test_save_large_data(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        data = [{'i': i, 'value': f'item_{i}'} for i in range(1000)]
        result = m.save_data(data, 'big_batch', 'base')
        loaded = m.load_data(result['filename'])
        assert loaded['count'] == 1000
        assert len(loaded['data']) == 1000

    def test_list_saved(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m.save_data([1], 'a', 'ethereum')
        time.sleep(0.01)
        m.save_data([2], 'b', 'base')
        time.sleep(0.01)
        m.save_data([3], 'c', 'ethereum')

        all_files = m.list_saved()
        assert len(all_files) == 3

        eth_files = m.list_saved('ethereum')
        assert len(eth_files) == 2

        base_files = m.list_saved('base')
        assert len(base_files) == 1

    def test_delete_data(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        result = m.save_data([1], 'delete_me', 'ethereum')
        assert len(m.list_saved()) == 1

        m.delete_data(result['filename'])
        assert len(m.list_saved()) == 0

    def test_load_missing_file(self, mod_with_tmpdir):
        with pytest.raises(FileNotFoundError):
            mod_with_tmpdir.load_data('nonexistent.json')

    def test_delete_missing_file(self, mod_with_tmpdir):
        with pytest.raises(FileNotFoundError):
            mod_with_tmpdir.delete_data('nonexistent.json')

    def test_save_metadata(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        result = m.save_data({'x': 1}, 'meta_test', 'polygon')
        loaded = m.load_data(result['filename'])
        assert 'saved_at' in loaded
        assert loaded['chain'] == 'polygon'

    def test_list_saved_sorted_by_time(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m.save_data([1], 'first', 'ethereum')
        time.sleep(0.05)
        m.save_data([2], 'second', 'ethereum')
        files = m.list_saved()
        # most recent first
        assert 'second' in files[0]['filename']
        assert 'first' in files[1]['filename']


class TestCache:
    def test_cache_set_and_get(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pools', [{'id': '0x1'}], chain='ethereum', limit=20)
        result = m._cache_get('pools', chain='ethereum', limit=20)
        assert result == [{'id': '0x1'}]

    def test_cache_miss_on_empty(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        assert m._cache_get('pools', chain='ethereum') is m._CACHE_MISS

    def test_cache_miss_different_params(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pools', [{'id': '0x1'}], chain='ethereum', limit=20)
        assert m._cache_get('pools', chain='base', limit=20) is m._CACHE_MISS
        assert m._cache_get('pools', chain='ethereum', limit=50) is m._CACHE_MISS

    def test_cache_ttl_expiry(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pools', [{'id': '0x1'}], chain='ethereum')
        # manually expire it
        key = m._cache_key('pools', chain='ethereum')
        path = m.cache_dir / f'{key}.json'
        cached = json.loads(path.read_text())
        cached['ts'] = time.time() - 9999
        path.write_text(json.dumps(cached))
        assert m._cache_get('pools', chain='ethereum') is m._CACHE_MISS

    def test_cache_fresh_within_ttl(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pools', ['fresh'], chain='base')
        assert m._cache_get('pools', chain='base') == ['fresh']

    def test_update_flag_bypasses_cache(self, mod_with_tmpdir):
        """get_pools(update=1) should call the API even if cache exists."""
        m = mod_with_tmpdir
        m._cache_set('pools', [{'id': 'cached'}], chain='ethereum', limit=20, orderBy='totalValueLockedUSD')
        fresh = [{'id': 'fresh'}]
        with patch.object(m, '_graph_query', return_value={'pools': fresh}):
            result = m.get_pools('ethereum', limit=20, update=True)
        assert result == fresh

    def test_cache_hit_avoids_network(self, mod_with_tmpdir):
        """When cache is fresh, _graph_query should NOT be called."""
        m = mod_with_tmpdir
        m._cache_set('pools', [{'id': 'cached'}], chain='ethereum', limit=20, orderBy='totalValueLockedUSD')
        with patch.object(m, '_graph_query') as mock_gq:
            result = m.get_pools('ethereum', limit=20)
        mock_gq.assert_not_called()
        assert result == [{'id': 'cached'}]

    def test_cache_hit_get_pool(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pool', {'id': '0xabc'}, chain='ethereum', pool_id='0xabc')
        with patch.object(m, '_graph_query') as mock_gq:
            result = m.get_pool('ethereum', pool_id='0xabc')
        mock_gq.assert_not_called()
        assert result == {'id': '0xabc'}

    def test_cache_hit_get_tokens(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('tokens', [{'symbol': 'WETH'}], chain='ethereum', limit=20, orderBy='totalValueLockedUSD')
        with patch.object(m, '_graph_query') as mock_gq:
            result = m.get_tokens('ethereum', limit=20)
        mock_gq.assert_not_called()
        assert result == [{'symbol': 'WETH'}]

    def test_cache_hit_get_pool_day_data(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pool_day_data', [{'date': 123}], chain='ethereum', pool_id='0xabc', days=30)
        with patch.object(m, '_graph_query') as mock_gq:
            result = m.get_pool_day_data('ethereum', pool_id='0xabc', days=30)
        mock_gq.assert_not_called()
        assert result == [{'date': 123}]

    def test_clear_cache_all(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pools', [1], chain='a')
        m._cache_set('tokens', [2], chain='b')
        assert len(list(m.cache_dir.glob('*.json'))) == 2
        result = m.clear_cache()
        assert result['cleared'] == 2
        assert len(list(m.cache_dir.glob('*.json'))) == 0

    def test_clear_cache_by_method(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('pools', [1], chain='a')
        m._cache_set('tokens', [2], chain='b')
        result = m.clear_cache('pools')
        assert result['cleared'] == 1
        # tokens cache still there
        assert m._cache_get('tokens', chain='b') == [2]

    def test_cache_corrupt_file(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        key = m._cache_key('pools', chain='ethereum')
        path = m.cache_dir / f'{key}.json'
        path.write_text('not valid json{{{')
        assert m._cache_get('pools', chain='ethereum') is m._CACHE_MISS

    def test_cache_stores_none_values(self, mod_with_tmpdir):
        """get_pool returns None for missing pools — cache should store it."""
        m = mod_with_tmpdir
        # manually cache a None value
        m._cache_set('pool', None, chain='ethereum', pool_id='0xdead')
        # should hit cache, not network
        with patch.object(m, '_graph_query') as mock_gq:
            result = m.get_pool('ethereum', pool_id='0xdead')
        mock_gq.assert_not_called()
        assert result is None

    def test_get_swaps_graph_cached(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        swaps = [{'id': 's1', 'amountUSD': '100'}]
        m._cache_set('swaps', swaps, chain='ethereum', days=30, limit=1000, source='graph')
        with patch.object(m, '_graph_query') as mock_gq:
            result = m.get_swaps('ethereum', days=30, limit=1000, source='graph')
        mock_gq.assert_not_called()
        assert result == swaps

    def test_get_swaps_update_refreshes(self, mod_with_tmpdir):
        m = mod_with_tmpdir
        m._cache_set('swaps', [{'old': True}], chain='ethereum', days=7, limit=100, source='graph')
        fresh = [{'new': True}]
        with patch.object(m, '_graph_query', return_value={'swaps': fresh}):
            result = m.get_swaps('ethereum', days=7, limit=100, source='graph', update=1)
        assert result == fresh


class TestRPCRoundRobin:
    def test_round_robin_cycles(self, mod):
        """Verify RPC iterator cycles through all endpoints."""
        seen = set()
        for _ in range(8):  # 2 full cycles of 4 RPCs
            url = next(mod._rpc_iters['ethereum'])
            seen.add(url)
        assert len(seen) == 4  # saw all 4 RPCs

    def test_rpc_call_retries(self, mod):
        """Verify RPC retries on failure and round-robins to next."""
        call_urls = []
        def mock_post(url, **kwargs):
            call_urls.append(url)
            raise ConnectionError("timeout")

        with patch('requests.post', side_effect=mock_post):
            with pytest.raises(Exception, match="RPC failed"):
                mod._rpc_call('ethereum', 'eth_blockNumber', [])
        # should have tried multiple different RPCs
        assert len(call_urls) == 4
        assert len(set(call_urls)) >= 2  # hit at least 2 different RPCs

    def test_rpc_call_success_after_failure(self, mod):
        """First RPC fails, second succeeds."""
        calls = [0]
        def mock_post(url, **kwargs):
            calls[0] += 1
            resp = MagicMock()
            if calls[0] == 1:
                resp.json.return_value = {'jsonrpc': '2.0', 'id': 1, 'error': {'message': 'rate limited'}}
            else:
                resp.json.return_value = {'jsonrpc': '2.0', 'id': 1, 'result': '0x100'}
            return resp

        with patch('requests.post', side_effect=mock_post):
            result = mod._rpc_call('ethereum', 'eth_blockNumber', [])
        assert result == '0x100'
        assert calls[0] == 2


class TestGraphEndpoint:
    def test_endpoint_with_key(self):
        m = Mod(api_key='mykey123')
        url = m._graph_endpoint('ethereum')
        assert 'mykey123' in url
        assert '{key}' not in url

    def test_endpoint_without_key(self):
        m = Mod(api_key='')
        url = m._graph_endpoint('ethereum')
        assert '/api/' not in url
        assert '{key}' not in url

    def test_invalid_chain_rpc(self, mod):
        with pytest.raises(Exception):
            mod._rpc_call('fakenet', 'eth_blockNumber', [])


class TestBlockEstimation:
    def test_estimate_block_at(self, mod):
        with patch.object(mod, '_get_block_number', return_value=1000000):
            # ethereum: 12s blocks. 1 day = 86400s → 7200 blocks
            block = mod._estimate_block_at('ethereum', 86400)
            assert block == 1000000 - 7200

    def test_estimate_block_at_clamps_to_zero(self, mod):
        with patch.object(mod, '_get_block_number', return_value=100):
            block = mod._estimate_block_at('ethereum', 86400 * 365)
            assert block == 0


class TestAutoSource:
    def test_auto_falls_through(self, mod_with_tmpdir):
        """Auto mode should try sources and fall through on errors."""
        m = mod_with_tmpdir
        call_order = []

        orig_hypersync = m._hypersync_get_swaps
        orig_graph = m._graph_query

        def mock_hypersync(*a, **kw):
            call_order.append('hypersync')
            raise Exception("401 auth required")

        def mock_graph(*a, **kw):
            call_order.append('graph')
            raise Exception("404")

        def mock_rpc(*a, **kw):
            call_order.append('rpc')
            return []

        def mock_swap_logs(*a, **kw):
            call_order.append('rpc')
            return [SAMPLE_SWAP_LOG]

        with patch.object(m, '_hypersync_get_swaps', side_effect=mock_hypersync), \
             patch.object(m, '_graph_query', side_effect=mock_graph), \
             patch.object(m, '_get_swap_logs', side_effect=mock_swap_logs), \
             patch.object(m, '_estimate_block_at', return_value=100):
            result = m.get_swaps('ethereum', 1, 5, 'auto', update=True)

        assert 'hypersync' in call_order
        assert 'rpc' in call_order
        assert isinstance(result, list)
        assert len(result) > 0


# ═══════════════════════════════════════════════════════════
# Integration Tests (live network)
# ═══════════════════════════════════════════════════════════

@pytest.mark.live
class TestLiveRPC:
    """Tests that hit real RPCs. Mark with -m live."""

    def test_get_block_number_all_chains(self, mod):
        for chain in mod.CHAINS:
            bn = mod._get_block_number(chain)
            assert isinstance(bn, int)
            assert bn > 0
            print(f"  {chain}: block {bn}")

    def test_rpc_swap_logs_small_range(self, mod):
        """Fetch swaps from last 100 blocks on base (fast chain)."""
        current = mod._get_block_number('base')
        logs = mod._get_swap_logs('base', from_block=current - 100)
        assert isinstance(logs, list)
        print(f"  Got {len(logs)} swap logs from last 100 blocks on Base")

    def test_get_swaps_rpc(self, mod):
        """Get parsed swaps via RPC, very small range."""
        current = mod._get_block_number('base')
        logs = mod._get_swap_logs('base', from_block=current - 50)
        parsed = [mod._parse_swap_log(l) for l in logs]
        valid = [s for s in parsed if s is not None]
        print(f"  Parsed {len(valid)}/{len(logs)} swap logs on Base")
        if valid:
            s = valid[0]
            assert 'pool' in s
            assert 'amount0' in s
            assert 'amount1' in s
            assert 'tx' in s
            assert s['pool'].startswith('0x')

    def test_get_swaps_auto_source(self, mod):
        """Auto source should return results from any available source."""
        swaps = mod.get_swaps('ethereum', days=1, limit=3, source='auto')
        assert isinstance(swaps, list)
        # should get at least some results from RPC fallback
        print(f"  Auto source returned {len(swaps)} swaps")


@pytest.mark.live
class TestLiveHyperSync:
    def test_hypersync_height(self, mod):
        """HyperSync height endpoint should be freely accessible."""
        import requests
        for chain, cfg in mod.CHAINS.items():
            url = cfg.get('hypersync')
            if not url:
                continue
            r = requests.get(f'{url}/height', timeout=10)
            assert r.status_code == 200
            data = r.json()
            assert 'height' in data
            assert data['height'] > 0
            print(f"  {chain}: height {data['height']}")


@pytest.mark.live
class TestLiveLocalFS:
    def test_full_save_load_cycle(self, mod_with_tmpdir):
        """Save real RPC data, load it back, verify integrity."""
        m = mod_with_tmpdir
        current = m._get_block_number('base')
        logs = m._get_swap_logs('base', from_block=current - 20)
        parsed = [m._parse_swap_log(l) for l in logs if m._parse_swap_log(l)]

        if not parsed:
            pytest.skip("No swaps in last 20 blocks")

        result = m.save_data(parsed, 'live_swaps', 'base')
        loaded = m.load_data(result['filename'])
        assert loaded['count'] == len(parsed)
        assert loaded['data'] == parsed
        print(f"  Saved and loaded {len(parsed)} swaps ({result['size']} bytes)")


# ═══════════════════════════════════════════════════════════
# Server Tests
# ═══════════════════════════════════════════════════════════

class TestServer:
    @pytest.fixture
    def client(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))
        from server import app
        from fastapi.testclient import TestClient
        return TestClient(app)

    def test_health(self, client):
        r = client.get('/health')
        assert r.status_code == 200
        data = r.json()
        assert data['status'] == 'ok'
        assert data['module'] == 'uniswap'

    def test_chains(self, client):
        r = client.get('/chains')
        assert r.status_code == 200
        data = r.json()
        assert 'ethereum' in data
        assert len(data) == 5

    def test_save_and_load(self, client, mod_with_tmpdir):
        # patch the server's mod instance to use tmpdir
        import server as srv
        srv._mod = mod_with_tmpdir

        # save
        r = client.post('/save', json={
            'data': [{'test': True}],
            'name': 'server_test',
            'chain': 'base',
        })
        assert r.status_code == 200
        filename = r.json()['filename']

        # list
        r = client.get('/saved?chain=base')
        assert r.status_code == 200
        files = r.json()
        assert len(files) == 1
        assert files[0]['filename'] == filename

        # load
        r = client.get(f'/saved/{filename}')
        assert r.status_code == 200
        data = r.json()
        assert data['data'] == [{'test': True}]

        # delete
        r = client.delete(f'/saved/{filename}')
        assert r.status_code == 200

        # verify deleted
        r = client.get(f'/saved/{filename}')
        assert r.status_code == 404

    def test_clear_cache(self, client, mod_with_tmpdir):
        import server as srv
        srv._mod = mod_with_tmpdir
        # seed some cache
        mod_with_tmpdir._cache_set('pools', [1], chain='a')
        mod_with_tmpdir._cache_set('tokens', [2], chain='b')
        assert len(list(mod_with_tmpdir.cache_dir.glob('*.json'))) == 2

        r = client.post('/clear-cache')
        assert r.status_code == 200
        assert r.json()['cleared'] == 2
        assert len(list(mod_with_tmpdir.cache_dir.glob('*.json'))) == 0

    def test_clear_cache_by_method(self, client, mod_with_tmpdir):
        import server as srv
        srv._mod = mod_with_tmpdir
        mod_with_tmpdir._cache_set('pools', [1], chain='a')
        mod_with_tmpdir._cache_set('tokens', [2], chain='b')

        r = client.post('/clear-cache?method=pools')
        assert r.status_code == 200
        assert r.json()['cleared'] == 1

    def test_pools_with_update(self, client, mod_with_tmpdir):
        import server as srv
        srv._mod = mod_with_tmpdir
        # pre-cache
        mod_with_tmpdir._cache_set('pools', [{'id': 'old'}], chain='ethereum', limit=20, orderBy='totalValueLockedUSD')
        # without update — returns cached
        with patch.object(mod_with_tmpdir, '_graph_query') as mock_gq:
            r = client.get('/pools?chain=ethereum&limit=20')
            assert r.status_code == 200
            assert r.json() == [{'id': 'old'}]
            mock_gq.assert_not_called()

        # with update — hits the API
        with patch.object(mod_with_tmpdir, '_graph_query', return_value={'pools': [{'id': 'fresh'}]}):
            r = client.get('/pools?chain=ethereum&limit=20&update=true')
            assert r.status_code == 200
            assert r.json() == [{'id': 'fresh'}]

    def test_load_missing(self, client):
        r = client.get('/saved/doesnotexist.json')
        assert r.status_code == 404

    def test_delete_missing(self, client):
        r = client.delete('/saved/doesnotexist.json')
        assert r.status_code == 404
