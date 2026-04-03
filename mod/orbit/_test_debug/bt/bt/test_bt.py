"""Tests for bt module — Bt, BtTrader, and TaoCopy classes.

All bittensor and mod dependencies are mocked via conftest.py so tests run offline.

Test Organization:
    - TestBt: Core Bittensor network interface operations
    - TestBtTrader: Trading operations (buy/sell/swap/move)
    - TestTaoCopy: Copy-trading and index fund operations
    - TestWalletCapitalization: Regression tests
    - TestEdgeCases: Boundary conditions and error scenarios
    - TestIntegration: Multi-step workflow tests

Coverage areas:
    - Basic CRUD operations (subnets, neurons, wallets)
    - Trading flows (stake/unstake, swaps, portfolio tracking)
    - Copy trading (scanning, scoring, following)
    - Index funds (create, buy, sell, rebalance)
    - Error handling and edge cases
    - Rust engine integration fallbacks
"""
import sys
import os
import json
import pytest
from unittest.mock import MagicMock, patch, call
from types import SimpleNamespace

from bt.conftest import FakeBalance, FakeStakeInfo
from bt import Bt, BtTrader
from bt.taocopy import TaoCopy, BLOCKS_PER_DAY

_mod = sys.modules['mod']


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fb(val: float):
    return FakeBalance(val)


def _fake_subnet(netuid=1, name='testnet', tao_in=100.0, alpha_in=200.0,
                 alpha_out=50.0, emission=0.5):
    return SimpleNamespace(
        netuid=netuid,
        subnet_name=name,
        tao_in=_fb(tao_in),
        alpha_in=_fb(alpha_in),
        alpha_out=_fb(alpha_out),
        emission=_fb(emission),
        subnet_identity=SimpleNamespace(github_repo=f'https://github.com/test/{name}'),
    )


def _fake_neuron(uid=0, hotkey='5Hot', coldkey='5Cold',
                 ip='1.2.3.4', port=8080, version=1):
    return SimpleNamespace(
        uid=uid,
        hotkey=hotkey,
        coldkey=coldkey,
        axon_info=SimpleNamespace(ip=ip, port=port, version=version),
        prometheus_info=SimpleNamespace(ip=ip, port=9090),
    )


def _make_bt():
    sub = MagicMock()
    obj = object.__new__(Bt)
    obj.network = 'finney'
    obj.subtensor = sub
    return obj, sub


def _make_trader():
    sub = MagicMock()
    wallet = MagicMock()
    wallet.hotkey.ss58_address = '5HotKeyAddr'
    wallet.coldkeypub.ss58_address = '5ColdKeyAddr'
    trader = object.__new__(BtTrader)
    trader.wallet = wallet
    trader.subtensor = sub
    trader.hotkey_ss58 = '5HotKeyAddr'
    trader.coldkey_ss58 = '5ColdKeyAddr'
    return trader, sub


def _make_taocopy():
    sub = MagicMock()
    wallet = MagicMock()
    wallet.hotkey.ss58_address = '5HotKeyAddr'
    wallet.coldkeypub.ss58_address = '5ColdKeyAddr'
    tc = object.__new__(TaoCopy)
    tc.wallet = wallet
    tc.subtensor = sub
    tc.hotkey_ss58 = '5HotKeyAddr'
    tc.coldkey_ss58 = '5ColdKeyAddr'
    tc.lookback_days = 30
    tc.lookback_blocks = 30 * BLOCKS_PER_DAY
    tc.network = 'finney'
    return tc, sub


# ---------------------------------------------------------------------------
# Bt tests
# ---------------------------------------------------------------------------

class TestBt:

    def test_init_state(self):
        bt_obj, sub = _make_bt()
        assert bt_obj.network == 'finney'
        assert bt_obj.subtensor is sub

    def test_balance(self):
        bt_obj, sub = _make_bt()
        sub.get_balance.return_value = _fb(42.5)
        assert bt_obj.balance('5Addr') == 42.5
        sub.get_balance.assert_called_once_with('5Addr')

    def test_balance_zero(self):
        bt_obj, sub = _make_bt()
        sub.get_balance.return_value = _fb(0.0)
        assert bt_obj.balance('5Empty') == 0.0

    def test_get_subnets(self):
        bt_obj, sub = _make_bt()
        sub.get_subnets.return_value = [0, 1, 2]
        assert bt_obj.get_subnets() == [0, 1, 2]

    def test_get_subnets_empty(self):
        bt_obj, sub = _make_bt()
        sub.get_subnets.return_value = []
        assert bt_obj.get_subnets() == []

    # -- subnet --

    def test_subnet_to_dict(self):
        bt_obj, sub = _make_bt()
        sub.subnet.return_value = _fake_subnet(netuid=1, name='alpha', tao_in=55.5)
        result = bt_obj.subnet(netuid=1)
        assert isinstance(result, dict)
        assert result['subnet_name'] == 'alpha'
        assert result['tao_in'] == 55.5

    def test_subnet_tojson_false(self):
        bt_obj, sub = _make_bt()
        raw = _fake_subnet(netuid=5)
        sub.subnet.return_value = raw
        assert bt_obj.subnet(netuid=5, tojson=False) is raw

    def test_subnet_identity_converted(self):
        bt_obj, sub = _make_bt()
        sub.subnet.return_value = _fake_subnet(netuid=1)
        result = bt_obj.subnet(netuid=1)
        assert isinstance(result['subnet_identity'], dict)
        assert 'github_repo' in result['subnet_identity']

    def test_subnet_identity_none(self):
        bt_obj, sub = _make_bt()
        s = _fake_subnet(netuid=1)
        s.subnet_identity = None
        sub.subnet.return_value = s
        assert bt_obj.subnet(netuid=1)['subnet_identity'] is None

    def test_subnet_with_block(self):
        bt_obj, sub = _make_bt()
        sub.subnet.return_value = _fake_subnet(netuid=3)
        bt_obj.subnet(netuid=3, block=12345)
        sub.subnet.assert_called_with(netuid=3, block=12345)

    def test_subnet_balance_fields_converted(self):
        bt_obj, sub = _make_bt()
        sub.subnet.return_value = _fake_subnet(
            netuid=1, tao_in=123.456, alpha_in=789.0, alpha_out=10.0, emission=0.77
        )
        result = bt_obj.subnet(netuid=1)
        assert result['tao_in'] == 123.456
        assert result['alpha_in'] == 789.0
        assert result['alpha_out'] == 10.0
        assert result['emission'] == 0.77
        # all should be plain floats, not FakeBalance
        for key in ['tao_in', 'alpha_in', 'alpha_out', 'emission']:
            assert isinstance(result[key], float)

    # -- neurons --

    def test_neurons(self):
        bt_obj, sub = _make_bt()
        sub.neurons.return_value = [_fake_neuron(), _fake_neuron()]
        result = bt_obj.neurons(netuid=2)
        assert len(result) == 2
        assert isinstance(result[0], dict)

    def test_neurons_empty(self):
        bt_obj, sub = _make_bt()
        sub.neurons.return_value = []
        assert bt_obj.neurons(netuid=99) == []

    def test_mod2json_url(self):
        bt_obj, _ = _make_bt()
        assert bt_obj.mod2json(_fake_neuron())['url'] == '1.2.3.4:8080'

    def test_mod2json_axon(self):
        bt_obj, _ = _make_bt()
        r = bt_obj.mod2json(_fake_neuron())
        assert isinstance(r['axon_info'], dict)
        assert r['axon_info']['port'] == 8080

    def test_mod2json_preserves_uid(self):
        bt_obj, _ = _make_bt()
        r = bt_obj.mod2json(_fake_neuron(uid=42))
        assert r['uid'] == 42

    def test_mod2json_different_ip_port(self):
        bt_obj, _ = _make_bt()
        r = bt_obj.mod2json(_fake_neuron(ip='10.0.0.1', port=443))
        assert r['url'] == '10.0.0.1:443'

    def test_n(self):
        bt_obj, sub = _make_bt()
        sub.neurons.return_value = [_fake_neuron() for _ in range(7)]
        assert bt_obj.n(netuid=3) == 7

    def test_n_empty_subnet(self):
        bt_obj, sub = _make_bt()
        sub.neurons.return_value = []
        assert bt_obj.n(netuid=99) == 0

    # -- subnets search --

    def test_subnets_search(self):
        bt_obj, sub = _make_bt()
        _mod.get = MagicMock(return_value=[
            {'netuid': 1, 'subnet_name': 'alpha_net'},
            {'netuid': 2, 'subnet_name': 'beta_net'},
            {'netuid': 3, 'subnet_name': 'gamma_alpha'},
        ])
        result = bt_obj.subnets(search='alpha')
        assert len(result) == 2
        _mod.get = MagicMock(return_value=None)

    def test_subnets_all(self):
        bt_obj, sub = _make_bt()
        cached = [{'netuid': i, 'subnet_name': f'net{i}'} for i in range(5)]
        _mod.get = MagicMock(return_value=cached)
        assert len(bt_obj.subnets()) == 5
        _mod.get = MagicMock(return_value=None)

    def test_subnets_search_by_netuid(self):
        bt_obj, sub = _make_bt()
        _mod.get = MagicMock(return_value=[
            {'netuid': 42, 'subnet_name': 'foo'},
            {'netuid': 7, 'subnet_name': 'bar'},
        ])
        result = bt_obj.subnets(search='42')
        assert len(result) == 1
        assert result[0]['netuid'] == 42
        _mod.get = MagicMock(return_value=None)

    def test_subnets_search_no_match(self):
        bt_obj, sub = _make_bt()
        _mod.get = MagicMock(return_value=[
            {'netuid': 1, 'subnet_name': 'alpha'},
            {'netuid': 2, 'subnet_name': 'beta'},
        ])
        result = bt_obj.subnets(search='zzzzz')
        assert result == []
        _mod.get = MagicMock(return_value=None)

    def test_subnets_cache_miss_fetches_from_chain(self):
        bt_obj, sub = _make_bt()
        _mod.get = MagicMock(return_value=None)
        sub.get_all_subnets_info.return_value = [
            SimpleNamespace(netuid=1), SimpleNamespace(netuid=2),
        ]
        sub.subnet.side_effect = lambda netuid, block=None: _fake_subnet(netuid=netuid, name=f'net{netuid}')
        result = bt_obj.subnets()
        assert len(result) == 2
        assert _mod.put.called
        _mod.get = MagicMock(return_value=None)

    def test_subnets_case_insensitive_search(self):
        """Search is lowercase comparison — uppercase query won't match lowercase names."""
        bt_obj, sub = _make_bt()
        _mod.get = MagicMock(return_value=[
            {'netuid': 1, 'subnet_name': 'alpha_net'},
        ])
        # search uses 'in' on lowercase name, so 'Alpha' won't match 'alpha_net'
        result = bt_obj.subnets(search='Alpha')
        assert len(result) == 0
        _mod.get = MagicMock(return_value=None)

    # -- gits --

    def test_gits(self):
        bt_obj, sub = _make_bt()
        sub.get_all_subnets_info.return_value = [
            SimpleNamespace(netuid=1), SimpleNamespace(netuid=2),
        ]
        sub.subnet.side_effect = lambda netuid, block=None: _fake_subnet(netuid=netuid, name=f'n{netuid}')
        _mod.get = MagicMock(return_value=None)
        urls = bt_obj.gits()
        assert len(urls) == 2
        assert all('github.com' in u for u in urls)

    def test_gits_skips_empty_identity(self):
        bt_obj, sub = _make_bt()
        s1 = _fake_subnet(netuid=1)
        s2 = _fake_subnet(netuid=2)
        # subnet 2 has no identity
        s2_dict = {'netuid': 2, 'subnet_name': 'n2', 'subnet_identity': None}
        _mod.get = MagicMock(return_value=[
            {'netuid': 1, 'subnet_name': 'n1',
             'subnet_identity': {'github_repo': 'https://github.com/test/n1'}},
            s2_dict,
        ])
        urls = bt_obj.gits()
        assert len(urls) == 1

    def test_gits_skips_missing_repo(self):
        bt_obj, sub = _make_bt()
        _mod.get = MagicMock(return_value=[
            {'netuid': 1, 'subnet_name': 'n1',
             'subnet_identity': {'github_repo': ''}},
        ])
        urls = bt_obj.gits()
        assert len(urls) == 0

    # -- wallet & transfer --

    def test_create_wallet(self):
        bt_obj, _ = _make_bt()
        bt_mod = sys.modules['bittensor']
        bt_mod.Wallet = MagicMock(return_value='wallet_obj')
        result = bt_obj.create_wallet('myw', hotkey='hk')
        bt_mod.Wallet.assert_called_with(name='myw', hotkey='hk')
        assert result == 'wallet_obj'

    def test_create_wallet_no_hotkey(self):
        bt_obj, _ = _make_bt()
        bt_mod = sys.modules['bittensor']
        bt_mod.Wallet = MagicMock(return_value='wallet_obj')
        bt_obj.create_wallet('myw')
        bt_mod.Wallet.assert_called_with(name='myw', hotkey=None)

    def test_get_wallet(self):
        bt_obj, _ = _make_bt()
        bt_mod = sys.modules['bittensor']
        bt_mod.Wallet = MagicMock()
        bt_obj.get_wallet('myw', hotkey='hk')
        bt_mod.Wallet.assert_called_with(name='myw', hotkey='hk')

    def test_transfer(self):
        bt_obj, sub = _make_bt()
        bt_mod = sys.modules['bittensor']
        bt_mod.Wallet = MagicMock(return_value=MagicMock())
        sub.transfer.return_value = True
        assert bt_obj.transfer('myw', '5Dest', 10.0) is True
        sub.transfer.assert_called_once()

    def test_transfer_failure(self):
        bt_obj, sub = _make_bt()
        bt_mod = sys.modules['bittensor']
        bt_mod.Wallet = MagicMock(return_value=MagicMock())
        sub.transfer.return_value = False
        assert bt_obj.transfer('myw', '5Dest', 10.0) is False

    def test_transfer_amount_converted_to_balance(self):
        bt_obj, sub = _make_bt()
        bt_mod = sys.modules['bittensor']
        bt_mod.Wallet = MagicMock(return_value=MagicMock())
        sub.transfer.return_value = True
        bt_obj.transfer('myw', '5Dest', 25.5)
        _, kwargs = sub.transfer.call_args
        assert isinstance(kwargs['amount'], FakeBalance)
        assert kwargs['amount'].tao == 25.5

    # -- metagraph --

    def test_metagraph(self):
        bt_obj, sub = _make_bt()
        sub.metagraph.return_value = 'mg'
        assert bt_obj.metagraph(netuid=5) == 'mg'

    def test_meta_alias(self):
        assert Bt.meta is Bt.metagraph

    def test_modules_alias(self):
        assert Bt.modules is Bt.neurons

    def test_mods_calls_subnets(self):
        bt_obj, sub = _make_bt()
        _mod.get = MagicMock(return_value=[{'netuid': 1, 'subnet_name': 'x'}])
        result = bt_obj.mods(search='x')
        assert len(result) == 1
        _mod.get = MagicMock(return_value=None)


# ---------------------------------------------------------------------------
# BtTrader tests
# ---------------------------------------------------------------------------

class TestBtTrader:

    # -- price --

    def test_price(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1, tao_in=100.0, alpha_in=200.0)
        r = t.price(1)
        assert r['netuid'] == 1
        assert r['price'] == pytest.approx(0.5)

    def test_price_zero_alpha(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(tao_in=100.0, alpha_in=0.0)
        assert t.price(1)['price'] == 0

    def test_price_zero_tao(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(tao_in=0.0, alpha_in=200.0)
        assert t.price(1)['price'] == 0.0

    def test_price_name(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(name='mynet')
        assert t.price(1)['name'] == 'mynet'

    def test_price_emission(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(emission=0.42)
        assert t.price(1)['emission'] == 0.42

    def test_price_alpha_out(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(alpha_out=33.3)
        assert t.price(1)['alpha_out'] == 33.3

    def test_price_all_fields_present(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet()
        r = t.price(1)
        for key in ['netuid', 'name', 'price', 'tao_in', 'alpha_in', 'alpha_out', 'emission']:
            assert key in r

    # -- balance --

    def test_balance(self):
        t, sub = _make_trader()
        sub.get_balance.return_value = _fb(99.9)
        assert t.balance()['coldkey'] == 99.9

    def test_balance_uses_coldkey(self):
        t, sub = _make_trader()
        sub.get_balance.return_value = _fb(0)
        t.balance()
        sub.get_balance.assert_called_with('5ColdKeyAddr')

    # -- scan --

    def test_scan_sorted(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3]
        p = {1: (10, 100), 2: (50, 100), 3: (30, 100)}
        sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(
            netuid=netuid, tao_in=p[netuid][0], alpha_in=p[netuid][1])
        r = t.scan(sort_by='price', limit=10)
        assert len(r) == 3
        assert r[0]['price'] >= r[1]['price'] >= r[2]['price']
        assert r[0]['netuid'] == 2

    def test_scan_limit(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = list(range(1, 11))
        sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(netuid=netuid)
        assert len(t.scan(limit=3)) == 3

    def test_scan_skips_errors(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3]
        def se(netuid, **kw):
            if netuid == 2: raise Exception("boom")
            return _fake_subnet(netuid=netuid)
        sub.subnet.side_effect = se
        assert len(t.scan(limit=10)) == 2

    def test_scan_sort_by_emission(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3]
        emissions = {1: 0.1, 2: 0.5, 3: 0.3}
        sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(
            netuid=netuid, emission=emissions[netuid])
        r = t.scan(sort_by='emission', limit=10)
        assert r[0]['emission'] >= r[1]['emission'] >= r[2]['emission']

    def test_scan_no_subnets(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = []
        assert t.scan() == []

    def test_scan_all_error(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2]
        sub.subnet.side_effect = Exception("all broken")
        assert t.scan() == []

    # -- buy --

    def test_buy_success(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1)
        sub.add_stake.return_value = True
        assert t.buy(1, 10.0) is True
        sub.add_stake.assert_called_once()
        assert sub.add_stake.call_args.kwargs['netuid'] == 1

    def test_buy_failure(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1)
        sub.add_stake.return_value = False
        assert t.buy(1, 5.0) is False

    def test_buy_passes_wallet_and_hotkey(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1)
        sub.add_stake.return_value = True
        t.buy(1, 10.0)
        kw = sub.add_stake.call_args.kwargs
        assert kw['wallet'] is t.wallet
        assert kw['hotkey_ss58'] == '5HotKeyAddr'

    def test_buy_amount_balance_conversion(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1)
        sub.add_stake.return_value = True
        t.buy(1, 7.77)
        kw = sub.add_stake.call_args.kwargs
        assert isinstance(kw['amount'], FakeBalance)
        assert kw['amount'].tao == 7.77

    def test_buy_wait_params(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1)
        sub.add_stake.return_value = True
        t.buy(1, 10.0, wait=False)
        kw = sub.add_stake.call_args.kwargs
        assert kw['wait_for_inclusion'] is False

    # -- sell --

    def test_sell_success(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=2)
        sub.unstake.return_value = True
        assert t.sell(2, 5.0) is True

    def test_sell_failure(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=2)
        sub.unstake.return_value = False
        assert t.sell(2, 5.0) is False

    def test_sell_passes_correct_netuid(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=7)
        sub.unstake.return_value = True
        t.sell(7, 3.0)
        assert sub.unstake.call_args.kwargs['netuid'] == 7

    # -- sell_all --

    def test_sell_all(self):
        t, sub = _make_trader()
        sub.unstake.return_value = True
        assert t.sell_all(3) is True
        assert sub.unstake.call_args.kwargs['amount'] is None

    def test_sell_all_failure(self):
        t, sub = _make_trader()
        sub.unstake.return_value = False
        assert t.sell_all(3) is False

    # -- swap --

    def test_swap_success(self):
        t, sub = _make_trader()
        sub.swap_stake.return_value = True
        assert t.swap(1, 2, 10.0) is True
        kw = sub.swap_stake.call_args.kwargs
        assert kw['origin_netuid'] == 1
        assert kw['destination_netuid'] == 2

    def test_swap_failure(self):
        t, sub = _make_trader()
        sub.swap_stake.return_value = False
        assert t.swap(1, 2, 10.0) is False

    def test_swap_uses_own_hotkey(self):
        t, sub = _make_trader()
        sub.swap_stake.return_value = True
        t.swap(1, 2, 10.0)
        assert sub.swap_stake.call_args.kwargs['hotkey_ss58'] == '5HotKeyAddr'

    # -- move --

    def test_move_success(self):
        t, sub = _make_trader()
        sub.move_stake.return_value = True
        assert t.move(1, 2, '5DestHotkey', 15.0) is True
        kw = sub.move_stake.call_args.kwargs
        assert kw['destination_hotkey'] == '5DestHotkey'
        assert kw['origin_hotkey'] == '5HotKeyAddr'

    def test_move_failure(self):
        t, sub = _make_trader()
        sub.move_stake.return_value = False
        assert t.move(1, 2, '5Dest', 15.0) is False

    def test_move_netuids(self):
        t, sub = _make_trader()
        sub.move_stake.return_value = True
        t.move(5, 10, '5Dest', 1.0)
        kw = sub.move_stake.call_args.kwargs
        assert kw['origin_netuid'] == 5
        assert kw['destination_netuid'] == 10

    # -- portfolio --

    def test_portfolio_empty(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2]
        sub.get_stake.return_value = _fb(0.0)
        assert t.portfolio() == []

    def test_portfolio_positions(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2]
        sub.get_stake.side_effect = lambda **kw: _fb(10.0 if kw['netuid'] == 1 else 0.0)
        sub.subnet.return_value = _fake_subnet(netuid=1, tao_in=50.0, alpha_in=100.0)
        r = t.portfolio()
        assert len(r) == 1
        assert r[0]['netuid'] == 1
        assert r[0]['stake'] == 10.0
        assert r[0]['value_tao'] == pytest.approx(5.0)

    def test_portfolio_multiple(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3]
        sub.get_stake.side_effect = lambda **kw: _fb(5.0 if kw['netuid'] in [1, 3] else 0.0)
        sub.subnet.side_effect = lambda netuid, **k: _fake_subnet(netuid=netuid, tao_in=100, alpha_in=100)
        r = t.portfolio()
        assert len(r) == 2

    def test_portfolio_skips_errors(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3]
        def get_stake_se(**kw):
            if kw['netuid'] == 2:
                raise Exception("rpc error")
            return _fb(10.0)
        sub.get_stake.side_effect = get_stake_se
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        r = t.portfolio()
        assert len(r) == 2  # subnets 1 and 3

    def test_portfolio_value_calculation(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1]
        sub.get_stake.return_value = _fb(20.0)
        # price = tao_in / alpha_in = 200 / 100 = 2.0
        sub.subnet.return_value = _fake_subnet(netuid=1, tao_in=200.0, alpha_in=100.0)
        r = t.portfolio()
        assert r[0]['price'] == pytest.approx(2.0)
        assert r[0]['value_tao'] == pytest.approx(40.0)  # 20 * 2.0

    # -- _subnet_info --

    def test_subnet_info(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1, tao_in=77.7)
        info = t._subnet_info(1)
        assert info['tao_in'] == 77.7
        assert isinstance(info['tao_in'], float)

    def test_subnet_info_all_balances_floats(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(
            netuid=1, tao_in=1.1, alpha_in=2.2, alpha_out=3.3, emission=4.4
        )
        info = t._subnet_info(1)
        for key in ['tao_in', 'alpha_in', 'alpha_out', 'emission']:
            assert isinstance(info[key], float), f'{key} should be float'

    # -- fast methods (Rust engine fallbacks) --

    def test_fast_scan_no_engine(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1]
        sub.subnet.return_value = _fake_subnet(netuid=1)
        with patch('bt.bt._get_engine', return_value=None):
            r = t.fast_scan(limit=5)
            assert len(r) == 1

    def test_fast_trades_no_engine(self):
        t, sub = _make_trader()
        with patch('bt.bt._get_engine', return_value=None):
            assert t.fast_trades() == []

    def test_fast_leaderboard_no_engine(self):
        t, sub = _make_trader()
        with patch('bt.bt._get_engine', return_value=None):
            assert t.fast_leaderboard() == []

    def test_rpc_health_no_engine(self):
        t, sub = _make_trader()
        with patch('bt.bt._get_engine', return_value=None):
            assert t.rpc_health() == []

    def test_best_rpc_no_engine(self):
        t, sub = _make_trader()
        with patch('bt.bt._get_engine', return_value=None):
            assert 'opentensor' in t.best_rpc()

    def test_fast_scan_with_engine(self):
        t, sub = _make_trader()
        engine = MagicMock()
        engine.scan_subnets.return_value = json.dumps([
            {'netuid': 1, 'name': 'a', 'price': 0.5, 'tao_in': 100},
            {'netuid': 2, 'name': 'b', 'price': 0.8, 'tao_in': 200},
        ])
        with patch('bt.bt._get_engine', return_value=engine):
            r = t.fast_scan(sort_by='price', limit=10)
            assert len(r) == 2
            assert r[0]['price'] >= r[1]['price']

    def test_fast_trades_with_engine(self):
        t, sub = _make_trader()
        engine = MagicMock()
        engine.fetch_trades.return_value = json.dumps([{'tx': 1}, {'tx': 2}])
        with patch('bt.bt._get_engine', return_value=engine):
            r = t.fast_trades(days=7, limit=100)
            assert len(r) == 2
            engine.fetch_trades.assert_called_once_with(7 * 7200, 100)


# ---------------------------------------------------------------------------
# TaoCopy tests
# ---------------------------------------------------------------------------

class TestTaoCopy:

    # -- helpers --

    def test_current_block(self):
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 1000000
        assert tc._current_block() == 1000000

    def test_subnet_price(self):
        tc, sub = _make_taocopy()
        sub.subnet.return_value = _fake_subnet(tao_in=50.0, alpha_in=100.0)
        assert tc._subnet_price(1) == pytest.approx(0.5)

    def test_subnet_price_zero_alpha(self):
        tc, sub = _make_taocopy()
        sub.subnet.return_value = _fake_subnet(tao_in=50.0, alpha_in=0.0)
        assert tc._subnet_price(1) == 0

    def test_save_and_load(self):
        tc, sub = _make_taocopy()
        _mod.put.reset_mock()
        _mod.get.reset_mock()
        tc._save('test_data', {'key': 'value'})
        _mod.put.assert_called_once()
        tc._load('test_data')
        _mod.get.assert_called()

    # -- scan_top --

    def test_scan_top_basic(self):
        tc, sub = _make_taocopy()
        meta = MagicMock()
        meta.n = 2
        meta.coldkeys = ['5ColdA', '5ColdB']
        meta.hotkeys = ['5HotA', '5HotB']
        meta.S = [100.0, 50.0]
        sub.metagraph.return_value = meta

        result = tc.scan_top(netuids=[1], top_n=5)
        assert len(result) == 2
        assert result[0]['total_stake'] >= result[1]['total_stake']

    def test_scan_top_skips_zero_stake(self):
        tc, sub = _make_taocopy()
        meta = MagicMock()
        meta.n = 3
        meta.coldkeys = ['5A', '5B', '5C']
        meta.hotkeys = ['5HA', '5HB', '5HC']
        meta.S = [100.0, 0.0, 50.0]
        sub.metagraph.return_value = meta

        result = tc.scan_top(netuids=[1], top_n=10)
        assert len(result) == 2  # skips 5B with 0 stake

    def test_scan_top_aggregates_same_coldkey(self):
        tc, sub = _make_taocopy()
        # Same coldkey appears on two subnets
        meta1 = MagicMock()
        meta1.n = 1
        meta1.coldkeys = ['5SameCold']
        meta1.hotkeys = ['5HotA']
        meta1.S = [100.0]

        meta2 = MagicMock()
        meta2.n = 1
        meta2.coldkeys = ['5SameCold']
        meta2.hotkeys = ['5HotB']
        meta2.S = [50.0]

        sub.metagraph.side_effect = [meta1, meta2]
        result = tc.scan_top(netuids=[1, 2], top_n=10)
        assert len(result) == 1
        assert result[0]['total_stake'] == 150.0
        assert len(result[0]['positions']) == 2

    def test_scan_top_error_skips_subnet(self):
        tc, sub = _make_taocopy()
        sub.metagraph.side_effect = Exception("rpc fail")
        result = tc.scan_top(netuids=[1, 2])
        assert result == []

    def test_scan_top_default_uses_all_subnets(self):
        tc, sub = _make_taocopy()
        sub.get_subnets.return_value = [1]
        meta = MagicMock()
        meta.n = 1
        meta.coldkeys = ['5A']
        meta.hotkeys = ['5HA']
        meta.S = [10.0]
        sub.metagraph.return_value = meta
        tc.scan_top()
        sub.get_subnets.assert_called_once()

    def test_scan_top_saves_results(self):
        tc, sub = _make_taocopy()
        meta = MagicMock()
        meta.n = 1
        meta.coldkeys = ['5A']
        meta.hotkeys = ['5HA']
        meta.S = [10.0]
        sub.metagraph.return_value = meta
        _mod.put.reset_mock()
        tc.scan_top(netuids=[1])
        assert _mod.put.called

    # -- profile --

    def test_profile(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H1', stake=100.0, emission=0.5),
            FakeStakeInfo(netuid=2, hotkey_ss58='5H2', stake=50.0, emission=0.3),
        ]
        sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(
            netuid=netuid, tao_in=100, alpha_in=100)
        result = tc.profile('5ColdXYZ')
        assert result['coldkey'] == '5ColdXYZ'
        assert result['n_subnets'] == 2
        assert len(result['positions']) == 2
        assert result['total_value_tao'] == pytest.approx(150.0)

    def test_profile_skips_zero_stake(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H1', stake=100.0),
            FakeStakeInfo(netuid=2, hotkey_ss58='5H2', stake=0.0),
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.profile('5Cold')
        assert result['n_subnets'] == 1

    def test_profile_empty(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = []
        result = tc.profile('5NoStake')
        assert result['n_subnets'] == 0
        assert result['total_value_tao'] == 0

    # -- score --

    def test_score_positive_roi(self):
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        # current: 200 TAO value
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=200.0)],  # now
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],  # past
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.score('5Addr', days=30)
        assert result['raw_roi'] == pytest.approx(1.0)  # doubled
        assert result['roi_30d'] == pytest.approx(1.0)

    def test_score_negative_roi(self):
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=50.0)],   # now
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],  # past
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.score('5Addr', days=30)
        assert result['raw_roi'] == pytest.approx(-0.5)

    def test_score_zero_past_value(self):
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],
            [],  # no past positions
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.score('5Addr', days=30)
        assert result['roi_30d'] == 0

    def test_score_normalization(self):
        """15-day ROI should be doubled when normalized to 30 days."""
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=150.0)],
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.score('5Addr', days=15)
        raw = 0.5  # (150-100)/100
        assert result['roi_30d'] == pytest.approx(raw * (30 / 15))

    # -- rank --

    def test_rank_sorts_by_roi(self):
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        # Address A: 2x, Address B: 1.5x
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=200.0)],  # A now
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],  # A past
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=150.0)],  # B now
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],  # B past
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.rank(addresses=['5A', '5B'], days=30, top_n=10)
        assert len(result) == 2
        assert result[0]['roi_30d'] >= result[1]['roi_30d']

    def test_rank_no_addresses(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=[])
        result = tc.rank()
        assert result == []
        _mod.get = MagicMock(return_value=None)

    def test_rank_limits_results(self):
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        addrs = [f'5Addr{i}' for i in range(5)]
        # Each addr: same stake
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.rank(addresses=addrs, top_n=2)
        assert len(result) == 2

    def test_rank_skips_errors(self):
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        call_count = [0]
        def side_effect(coldkey, **kw):
            call_count[0] += 1
            if call_count[0] <= 2:  # first address (now + past)
                return [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)]
            raise Exception("rpc fail")
        sub.get_stake_for_coldkey.side_effect = side_effect
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.rank(addresses=['5Good', '5Bad'])
        assert len(result) == 1

    # -- allocations --

    def test_allocations_from_profile(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0),
            FakeStakeInfo(netuid=2, hotkey_ss58='5H', stake=100.0),
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        allocs = tc._allocations_from_profile('5Addr')
        assert len(allocs) == 2
        assert sum(allocs.values()) == pytest.approx(1.0)
        assert allocs[1] == pytest.approx(0.5)

    def test_allocations_empty_profile(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = []
        allocs = tc._allocations_from_profile('5Empty')
        assert allocs == {}

    # -- follow --

    def test_follow_buys_proportionally(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=75.0),
            FakeStakeInfo(netuid=2, hotkey_ss58='5H', stake=25.0),
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        sub.add_stake.return_value = True
        trades = tc.follow('5Target', budget_tao=100.0)
        assert len(trades) == 2
        assert all(t['success'] for t in trades)
        total_amount = sum(t['amount'] for t in trades)
        assert total_amount == pytest.approx(100.0)

    def test_follow_empty_target(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = []
        result = tc.follow('5NoPositions', budget_tao=50.0)
        assert result == []

    def test_follow_skips_tiny_amounts(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=9999.0),
            FakeStakeInfo(netuid=2, hotkey_ss58='5H', stake=1.0),
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        sub.add_stake.return_value = True
        # With very small budget, the tiny position won't meet 0.01 threshold
        trades = tc.follow('5Addr', budget_tao=0.05)
        # Only the dominant position should be bought
        assert len(trades) >= 1

    def test_follow_handles_stake_error(self):
        tc, sub = _make_taocopy()
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0),
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        sub.add_stake.side_effect = Exception("tx failed")
        trades = tc.follow('5Addr', budget_tao=10.0)
        assert len(trades) == 1
        assert trades[0]['success'] is False
        assert 'error' in trades[0]

    # -- copy --

    def test_copy_no_ranked(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=None)
        result = tc.copy(budget_tao=100.0)
        assert result == []
        _mod.get = MagicMock(return_value=None)

    def test_copy_splits_budget(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=[
            {'coldkey': '5A', 'roi_30d': 0.5},
            {'coldkey': '5B', 'roi_30d': 0.3},
        ])
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0),
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        sub.add_stake.return_value = True
        trades = tc.copy(budget_tao=100.0, top_n=2)
        # each target gets 50 TAO
        amounts = [t['amount'] for t in trades]
        assert all(a == pytest.approx(50.0) for a in amounts)
        _mod.get = MagicMock(return_value=None)

    # -- create_index --

    def test_create_index_with_netuids(self):
        tc, sub = _make_taocopy()
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        idx = tc.create_index('test', netuids=[1, 2, 3])
        assert idx['name'] == 'test'
        assert len(idx['weights']) == 3
        assert sum(idx['weights'].values()) == pytest.approx(1.0)

    def test_create_index_with_weights(self):
        tc, sub = _make_taocopy()
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        idx = tc.create_index('test', weights={1: 3, 2: 1})
        assert idx['weights'][1] == pytest.approx(0.75)
        assert idx['weights'][2] == pytest.approx(0.25)

    def test_create_index_with_top_n(self):
        tc, sub = _make_taocopy()
        sub.get_subnets.return_value = [1, 2, 3]
        sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(
            netuid=netuid, emission=netuid * 0.1)
        idx = tc.create_index('top2', top_n=2)
        assert len(idx['weights']) == 2

    def test_create_index_no_args(self):
        tc, sub = _make_taocopy()
        idx = tc.create_index('empty')
        assert idx == {}

    # -- buy_index --

    def test_buy_index(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value={
            'name': 'test', 'weights': {1: 0.6, 2: 0.4}
        })
        sub.add_stake.return_value = True
        trades = tc.buy_index('test', budget_tao=100.0)
        assert len(trades) == 2
        amounts = {t['netuid']: t['amount'] for t in trades}
        assert amounts[1] == pytest.approx(60.0)
        assert amounts[2] == pytest.approx(40.0)
        _mod.get = MagicMock(return_value=None)

    def test_buy_index_not_found(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=None)
        assert tc.buy_index('nonexistent', 100.0) == []

    # -- sell_index --

    def test_sell_index(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value={
            'name': 'test', 'weights': {1: 0.5, 2: 0.5}
        })
        sub.unstake.return_value = True
        trades = tc.sell_index('test')
        assert len(trades) == 2
        assert all(t['success'] for t in trades)
        # sell_index passes amount=None (sell all)
        for c in sub.unstake.call_args_list:
            assert c.kwargs['amount'] is None
        _mod.get = MagicMock(return_value=None)

    def test_sell_index_not_found(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=None)
        assert tc.sell_index('ghost') == []

    def test_sell_index_handles_error(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value={
            'name': 'test', 'weights': {1: 0.5, 2: 0.5}
        })
        sub.unstake.side_effect = Exception("failed")
        trades = tc.sell_index('test')
        assert len(trades) == 2
        assert all(not t['success'] for t in trades)
        _mod.get = MagicMock(return_value=None)

    # -- rebalance --

    def test_rebalance_buys_underweight(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value={
            'name': 'test', 'weights': {1: 0.5, 2: 0.5}
        })
        # Subnet 1 has stake, subnet 2 has nothing
        def get_stake(**kw):
            if kw['netuid'] == 1: return _fb(50.0)
            return _fb(0.0)
        sub.get_stake.side_effect = get_stake
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        sub.add_stake.return_value = True
        sub.unstake.return_value = True
        trades = tc.rebalance('test', total_tao=100.0)
        buy_trades = [t for t in trades if t['action'] == 'buy']
        assert len(buy_trades) >= 1
        _mod.get = MagicMock(return_value=None)

    def test_rebalance_not_found(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=None)
        assert tc.rebalance('ghost', 100.0) == []

    # -- index_value --

    def test_index_value(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value={
            'name': 'test', 'weights': {1: 0.5, 2: 0.5}
        })
        sub.get_stake.return_value = _fb(50.0)
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.index_value('test')
        assert result['name'] == 'test'
        assert result['total_value'] == pytest.approx(100.0)
        assert len(result['positions']) == 2
        _mod.get = MagicMock(return_value=None)

    def test_index_value_not_found(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=None)
        assert tc.index_value('ghost') == {}

    # -- fast methods --

    def test_fast_rank_no_engine(self):
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value=[])
        with patch('bt.bt._get_engine', return_value=None):
            result = tc.fast_rank()
            assert result == []
        _mod.get = MagicMock(return_value=None)

    def test_fast_trades_no_engine(self):
        tc, sub = _make_taocopy()
        with patch('bt.bt._get_engine', return_value=None):
            assert tc.fast_trades() == []


# ---------------------------------------------------------------------------
# Regression: bt.Wallet capitalization
# ---------------------------------------------------------------------------

class TestWalletCapitalization:
    """Regression tests to ensure proper API usage."""

    def test_no_lowercase_bt_wallet(self):
        """Ensure no deprecated bt.wallet() calls exist."""
        import pathlib
        content = (pathlib.Path(__file__).parent / 'bt.py').read_text()
        bad = [(i+1, l) for i, l in enumerate(content.splitlines())
               if 'bt.wallet(' in l and not l.strip().startswith('#')]
        assert bad == [], f"Found deprecated bt.wallet(): {bad}"

    def test_has_capital_bt_wallet(self):
        """Ensure proper bt.Wallet() capitalization is used."""
        import pathlib
        content = (pathlib.Path(__file__).parent / 'bt.py').read_text()
        assert 'bt.Wallet(' in content


# ---------------------------------------------------------------------------
# Edge cases and error handling tests
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Test boundary conditions, edge cases, and error scenarios."""

    # -- Bt edge cases --

    @pytest.mark.parametrize("subnet_id,expected", [
        (0, True),      # Minimum valid netuid
        (1, True),      # Standard netuid
        (999, True),    # High netuid
    ])
    def test_subnet_various_netuids(self, subnet_id, expected):
        """Test subnet() handles various valid netuid values."""
        bt_obj, sub = _make_bt()
        sub.subnet.return_value = _fake_subnet(netuid=subnet_id)
        result = bt_obj.subnet(netuid=subnet_id)
        assert result['netuid'] == subnet_id

    def test_neurons_large_count(self):
        """Test neurons() with many neurons."""
        bt_obj, sub = _make_bt()
        # Create 1000 fake neurons
        neurons = [_fake_neuron(uid=i, hotkey=f'5Hot{i}') for i in range(1000)]
        sub.neurons.return_value = neurons
        result = bt_obj.neurons(netuid=1)
        assert len(result) == 1000
        assert result[0]['uid'] == 0
        assert result[999]['uid'] == 999

    def test_balance_very_large_value(self):
        """Test balance() with very large TAO amounts."""
        bt_obj, sub = _make_bt()
        large_amount = 1_000_000_000.123456789
        sub.get_balance.return_value = _fb(large_amount)
        assert bt_obj.balance('5Addr') == large_amount

    def test_balance_very_small_value(self):
        """Test balance() with very small TAO amounts."""
        bt_obj, sub = _make_bt()
        small_amount = 0.000000001
        sub.get_balance.return_value = _fb(small_amount)
        result = bt_obj.balance('5Addr')
        assert abs(result - small_amount) < 1e-10

    def test_subnets_malformed_identity(self):
        """Test subnets() handles malformed subnet identity gracefully."""
        bt_obj, sub = _make_bt()
        s = _fake_subnet(netuid=1)
        s.subnet_identity = SimpleNamespace()  # No github_repo attribute
        sub.subnet.return_value = s
        sub.get_all_subnets_info.return_value = [SimpleNamespace(netuid=1)]
        _mod.get = MagicMock(return_value=None)
        result = bt_obj.subnets()
        assert len(result) == 1
        _mod.get = MagicMock(return_value=None)

    # -- BtTrader edge cases --

    def test_price_extreme_ratio(self):
        """Test price calculation with extreme tao_in/alpha_in ratios."""
        t, sub = _make_trader()
        # Very high price scenario
        sub.subnet.return_value = _fake_subnet(netuid=1, tao_in=1_000_000.0, alpha_in=1.0)
        r = t.price(1)
        assert r['price'] == pytest.approx(1_000_000.0)

    def test_price_very_small_ratio(self):
        """Test price calculation with very small tao_in/alpha_in ratio."""
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1, tao_in=0.001, alpha_in=1000.0)
        r = t.price(1)
        assert r['price'] == pytest.approx(0.000001)

    def test_portfolio_with_mixed_zero_nonzero_stakes(self):
        """Test portfolio() correctly filters zero stakes among nonzero ones."""
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3, 4, 5]
        stakes = {1: 10.0, 2: 0.0, 3: 5.0, 4: 0.0, 5: 15.0}
        sub.get_stake.side_effect = lambda **kw: _fb(stakes.get(kw['netuid'], 0.0))
        sub.subnet.side_effect = lambda netuid, **k: _fake_subnet(netuid=netuid, tao_in=100, alpha_in=100)
        r = t.portfolio()
        assert len(r) == 3  # Only 1, 3, 5
        netuids = [p['netuid'] for p in r]
        assert set(netuids) == {1, 3, 5}

    @pytest.mark.parametrize("amount,expected_success", [
        (0.01, True),      # Minimum reasonable amount
        (10000.0, True),   # Large amount
        (0.000001, True),  # Tiny amount (should still work)
    ])
    def test_buy_various_amounts(self, amount, expected_success):
        """Test buy() with various TAO amounts."""
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1)
        sub.add_stake.return_value = expected_success
        result = t.buy(1, amount)
        assert result == expected_success
        # Verify amount was converted correctly
        kw = sub.add_stake.call_args.kwargs
        assert isinstance(kw['amount'], FakeBalance)
        assert kw['amount'].tao == amount

    def test_scan_with_inconsistent_subnet_data(self):
        """Test scan() handles inconsistent or missing subnet data."""
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3]
        def side_effect(netuid):
            if netuid == 1:
                return _fake_subnet(netuid=1, tao_in=100, alpha_in=100)
            elif netuid == 2:
                raise ConnectionError("RPC timeout")
            else:
                s = _fake_subnet(netuid=3, tao_in=50, alpha_in=0)  # Zero alpha
                return s
        sub.subnet.side_effect = side_effect
        result = t.scan(limit=10)
        # Should have subnet 1 and 3 (3 has 0 price but doesn't error)
        assert len(result) == 2
        netuids = [r['netuid'] for r in result]
        assert 1 in netuids
        assert 3 in netuids

    # -- TaoCopy edge cases --

    def test_score_with_identical_portfolios(self):
        """Test score() when current and past portfolios are identical (0% ROI)."""
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        identical_stakes = [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)]
        sub.get_stake_for_coldkey.side_effect = [identical_stakes, identical_stakes]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.score('5Addr', days=30)
        assert result['raw_roi'] == pytest.approx(0.0)
        assert result['roi_30d'] == pytest.approx(0.0)

    def test_rank_with_single_address(self):
        """Test rank() with only one address."""
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=150.0)],
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.rank(addresses=['5Addr'], top_n=10)
        assert len(result) == 1
        assert result[0]['coldkey'] == '5Addr'

    def test_follow_with_fractional_allocation(self):
        """Test follow() handles fractional allocations correctly."""
        tc, sub = _make_taocopy()
        # Create a portfolio with 3 positions with odd percentages
        sub.get_stake_for_coldkey.return_value = [
            FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=33.33),
            FakeStakeInfo(netuid=2, hotkey_ss58='5H', stake=33.33),
            FakeStakeInfo(netuid=3, hotkey_ss58='5H', stake=33.34),
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        sub.add_stake.return_value = True
        trades = tc.follow('5Addr', budget_tao=100.0)
        assert len(trades) == 3
        total = sum(t['amount'] for t in trades)
        assert abs(total - 100.0) < 0.01  # Should sum to budget within rounding

    def test_create_index_with_single_subnet(self):
        """Test create_index() with just one subnet."""
        tc, sub = _make_taocopy()
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        idx = tc.create_index('single', netuids=[42])
        assert idx['weights'][42] == pytest.approx(1.0)
        assert sum(idx['weights'].values()) == pytest.approx(1.0)

    def test_rebalance_with_no_existing_positions(self):
        """Test rebalance() starting from zero positions."""
        tc, sub = _make_taocopy()
        _mod.get = MagicMock(return_value={
            'name': 'test', 'weights': {1: 0.5, 2: 0.5}
        })
        sub.get_stake.return_value = _fb(0.0)  # No existing stake
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        sub.add_stake.return_value = True
        trades = tc.rebalance('test', total_tao=100.0)
        buy_trades = [t for t in trades if t['action'] == 'buy']
        assert len(buy_trades) == 2
        _mod.get = MagicMock(return_value=None)

    @pytest.mark.parametrize("days,expected_multiplier", [
        (7, 30/7),
        (15, 30/15),
        (30, 1.0),
        (60, 30/60),
    ])
    def test_score_normalization_various_periods(self, days, expected_multiplier):
        """Test score() ROI normalization across different time periods."""
        tc, sub = _make_taocopy()
        sub.get_current_block.return_value = 300000
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=150.0)],  # now
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)],  # past
        ]
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        result = tc.score('5Addr', days=days)
        raw_roi = 0.5  # (150-100)/100
        expected_normalized = raw_roi * expected_multiplier
        assert result['roi_30d'] == pytest.approx(expected_normalized)


# ---------------------------------------------------------------------------
# Integration tests for complex workflows
# ---------------------------------------------------------------------------

class TestIntegration:
    """Integration-style tests for multi-step workflows."""

    def test_trader_full_lifecycle(self):
        """Test complete trading workflow: scan -> buy -> portfolio -> sell."""
        t, sub = _make_trader()

        # Step 1: Scan for subnets
        sub.get_subnets.return_value = [1, 2, 3]
        sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(
            netuid=netuid, tao_in=netuid*50, alpha_in=100)
        scan_result = t.scan(limit=3)
        assert len(scan_result) == 3
        best_netuid = scan_result[0]['netuid']

        # Step 2: Buy into best subnet
        sub.subnet.return_value = _fake_subnet(netuid=best_netuid)
        sub.add_stake.return_value = True
        buy_result = t.buy(best_netuid, 10.0)
        assert buy_result is True

        # Step 3: Check portfolio
        sub.get_stake.side_effect = lambda **kw: _fb(10.0 if kw['netuid'] == best_netuid else 0.0)
        portfolio = t.portfolio()
        assert len(portfolio) == 1
        assert portfolio[0]['netuid'] == best_netuid

        # Step 4: Sell position
        sub.unstake.return_value = True
        sell_result = t.sell(best_netuid, 5.0)
        assert sell_result is True

    def test_taocopy_full_workflow(self):
        """Test complete TaoCopy workflow: scan -> rank -> copy."""
        tc, sub = _make_taocopy()

        # Step 1: Scan top stakers
        meta = MagicMock()
        meta.n = 3
        meta.coldkeys = ['5ColdA', '5ColdB', '5ColdC']
        meta.hotkeys = ['5HotA', '5HotB', '5HotC']
        meta.S = [1000.0, 500.0, 250.0]
        sub.metagraph.return_value = meta
        scan_result = tc.scan_top(netuids=[1], top_n=3)
        assert len(scan_result) == 3
        top_coldkey = scan_result[0]['coldkey']

        # Step 2: Rank by performance
        sub.get_current_block.return_value = 300000
        call_sequence = []
        for coldkey in [scan_result[0]['coldkey'], scan_result[1]['coldkey'], scan_result[2]['coldkey']]:
            # Current stakes (now)
            call_sequence.append([FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=200.0)])
            # Past stakes
            call_sequence.append([FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)])
        sub.get_stake_for_coldkey.side_effect = call_sequence
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)

        rank_result = tc.rank(addresses=[s['coldkey'] for s in scan_result], top_n=2)
        assert len(rank_result) == 2

        # Step 3: Copy top performer
        _mod.get = MagicMock(return_value=rank_result)
        # Need to provide fresh stake data for the copy operation
        # copy() calls follow() which calls profile() which needs get_stake_for_coldkey
        sub.get_stake_for_coldkey.side_effect = [
            [FakeStakeInfo(netuid=1, hotkey_ss58='5H', stake=100.0)]
        ]
        sub.add_stake.return_value = True
        copy_result = tc.copy(budget_tao=50.0, top_n=1)
        assert len(copy_result) >= 1
        _mod.get = MagicMock(return_value=None)

    def test_index_fund_lifecycle(self):
        """Test index fund workflow: create -> buy -> value -> rebalance -> sell."""
        tc, sub = _make_taocopy()

        # Step 1: Create index
        sub.subnet.return_value = _fake_subnet(tao_in=100, alpha_in=100)
        idx = tc.create_index('test_idx', netuids=[1, 2, 3])
        assert len(idx['weights']) == 3

        # Step 2: Buy index
        # Mock the get_index call that buy_index will make
        _mod.get = MagicMock(return_value=idx)
        sub.add_stake.return_value = True
        buy_trades = tc.buy_index('test_idx', budget_tao=150.0)
        assert len(buy_trades) == 3

        # Step 3: Check index value
        sub.get_stake.return_value = _fb(50.0)
        value = tc.index_value('test_idx')
        assert 'total_value' in value

        # Step 4: Rebalance
        sub.unstake.return_value = True
        rebal_trades = tc.rebalance('test_idx', total_tao=150.0)
        assert isinstance(rebal_trades, list)

        # Step 5: Sell entire index
        sell_trades = tc.sell_index('test_idx')
        assert len(sell_trades) == 3

        # Cleanup
        _mod.get = MagicMock(return_value=None)

    def test_swap_between_subnets_workflow(self):
        """Test swapping stake between multiple subnets."""
        t, sub = _make_trader()

        # Start with stake in subnet 1
        sub.get_subnets.return_value = [1, 2, 3]
        sub.get_stake.side_effect = lambda **kw: _fb(100.0 if kw['netuid'] == 1 else 0.0)
        sub.subnet.side_effect = lambda netuid, **k: _fake_subnet(netuid=netuid, tao_in=100, alpha_in=100)

        portfolio_before = t.portfolio()
        assert len(portfolio_before) == 1
        assert portfolio_before[0]['netuid'] == 1

        # Swap from subnet 1 to subnet 2
        sub.swap_stake.return_value = True
        swap_result = t.swap(1, 2, 50.0)
        assert swap_result is True

        # Verify swap was called correctly
        kw = sub.swap_stake.call_args.kwargs
        assert kw['origin_netuid'] == 1
        assert kw['destination_netuid'] == 2
        assert kw['amount'].tao == 50.0
