"""Tests for bt module — Bt and BtTrader classes.

All bittensor and mod dependencies are mocked via conftest.py so tests run offline.
"""
import sys
import pytest
from unittest.mock import MagicMock
from types import SimpleNamespace

from conftest import FakeBalance
from bt import Bt, BtTrader

# Grab the mocked mod module for controlling m.get / m.put in tests
_mod = sys.modules['mod']


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fb(val: float):
    return FakeBalance(val)


def _fake_subnet(netuid=1, name='testnet', tao_in=100.0, alpha_in=200.0, alpha_out=50.0, emission=0.5):
    return SimpleNamespace(
        netuid=netuid,
        subnet_name=name,
        tao_in=_fb(tao_in),
        alpha_in=_fb(alpha_in),
        alpha_out=_fb(alpha_out),
        emission=_fb(emission),
        subnet_identity=SimpleNamespace(github_repo=f'https://github.com/test/{name}'),
    )


def _fake_neuron():
    return SimpleNamespace(
        uid=0,
        hotkey='5Hot',
        coldkey='5Cold',
        axon_info=SimpleNamespace(ip='1.2.3.4', port=8080, version=1),
        prometheus_info=SimpleNamespace(ip='1.2.3.4', port=9090),
        promzetheus_info=SimpleNamespace(ip='1.2.3.4', port=9090),
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

    def test_get_subnets(self):
        bt_obj, sub = _make_bt()
        sub.get_subnets.return_value = [0, 1, 2]
        assert bt_obj.get_subnets() == [0, 1, 2]

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

    def test_neurons(self):
        bt_obj, sub = _make_bt()
        sub.neurons.return_value = [_fake_neuron(), _fake_neuron()]
        result = bt_obj.neurons(netuid=2)
        assert len(result) == 2
        assert isinstance(result[0], dict)

    def test_mod2json_url(self):
        bt_obj, _ = _make_bt()
        assert bt_obj.mod2json(_fake_neuron())['url'] == '1.2.3.4:8080'

    def test_mod2json_axon(self):
        bt_obj, _ = _make_bt()
        r = bt_obj.mod2json(_fake_neuron())
        assert isinstance(r['axon_info'], dict)
        assert r['axon_info']['port'] == 8080

    def test_n(self):
        bt_obj, sub = _make_bt()
        sub.neurons.return_value = [_fake_neuron() for _ in range(7)]
        assert bt_obj.n(netuid=3) == 7

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

    def test_create_wallet(self):
        bt_obj, _ = _make_bt()
        bt_mod = sys.modules['bittensor']
        bt_mod.Wallet = MagicMock(return_value='wallet_obj')
        result = bt_obj.create_wallet('myw', hotkey='hk')
        bt_mod.Wallet.assert_called_with(name='myw', hotkey='hk')
        assert result == 'wallet_obj'

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

    def test_metagraph(self):
        bt_obj, sub = _make_bt()
        sub.metagraph.return_value = 'mg'
        assert bt_obj.metagraph(netuid=5) == 'mg'

    def test_meta_alias(self):
        assert Bt.meta is Bt.metagraph

    def test_modules_alias(self):
        assert Bt.modules is Bt.neurons


# ---------------------------------------------------------------------------
# BtTrader tests
# ---------------------------------------------------------------------------

class TestBtTrader:

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

    def test_price_name(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(name='mynet')
        assert t.price(1)['name'] == 'mynet'

    def test_price_emission(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(emission=0.42)
        assert t.price(1)['emission'] == 0.42

    def test_balance(self):
        t, sub = _make_trader()
        sub.get_balance.return_value = _fb(99.9)
        assert t.balance()['coldkey'] == 99.9

    def test_scan_sorted(self):
        t, sub = _make_trader()
        sub.get_subnets.return_value = [1, 2, 3]
        p = {1: (10, 100), 2: (50, 100), 3: (30, 100)}
        sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(netuid=netuid, tao_in=p[netuid][0], alpha_in=p[netuid][1])
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

    def test_sell_all(self):
        t, sub = _make_trader()
        sub.unstake.return_value = True
        assert t.sell_all(3) is True
        assert sub.unstake.call_args.kwargs['amount'] is None

    def test_sell_all_failure(self):
        t, sub = _make_trader()
        sub.unstake.return_value = False
        assert t.sell_all(3) is False

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

    def test_subnet_info(self):
        t, sub = _make_trader()
        sub.subnet.return_value = _fake_subnet(netuid=1, tao_in=77.7)
        info = t._subnet_info(1)
        assert info['tao_in'] == 77.7
        assert isinstance(info['tao_in'], float)


# ---------------------------------------------------------------------------
# Regression: bt.Wallet capitalization
# ---------------------------------------------------------------------------

class TestWalletCapitalization:

    def test_no_lowercase_bt_wallet(self):
        import pathlib
        content = (pathlib.Path(__file__).parent / 'bt.py').read_text()
        bad = [(i+1, l) for i, l in enumerate(content.splitlines())
               if 'bt.wallet(' in l and not l.strip().startswith('#')]
        assert bad == [], f"Found deprecated bt.wallet(): {bad}"

    def test_has_capital_bt_wallet(self):
        import pathlib
        content = (pathlib.Path(__file__).parent / 'bt.py').read_text()
        assert 'bt.Wallet(' in content
