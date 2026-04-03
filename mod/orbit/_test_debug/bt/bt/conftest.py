"""conftest.py — mock bittensor & mod before any test imports bt.

Installs mocks for mod and bittensor so that importing bt.bt and bt.taocopy
works without real dependencies.
"""
import sys
import types
from unittest.mock import MagicMock


class FakeBalance:
    """Stand-in for bittensor.utils.balance.Balance."""
    def __init__(self, tao_val=0.0):
        self.tao = tao_val

    def __float__(self):
        return float(self.tao)

    def __eq__(self, other):
        if isinstance(other, FakeBalance):
            return self.tao == other.tao
        return self.tao == other

    def __repr__(self):
        return f'FakeBalance({self.tao})'

    @classmethod
    def from_tao(cls, val):
        return cls(val)


class FakeStakeInfo:
    """Stand-in for bittensor.core.chain_data.StakeInfo."""
    def __init__(self, netuid, hotkey_ss58, stake, emission=0.0):
        self.netuid = netuid
        self.hotkey_ss58 = hotkey_ss58
        self.stake = FakeBalance(stake)
        self.emission = FakeBalance(emission)


# Build a plain module for 'mod' so pytest won't probe MagicMock attrs
_mod = types.ModuleType('mod')
_mod.print = lambda *a, **kw: None
_mod.get = MagicMock(return_value=None)
_mod.put = MagicMock()
_mod.future = MagicMock()
_mod.as_completed = MagicMock(return_value=[])
_mod.tree = MagicMock()
_mod.mod = MagicMock()
sys.modules['mod'] = _mod

# Mock bittensor (full hierarchy so subpackage imports work)
_bt = types.ModuleType('bittensor')
_bt.Subtensor = MagicMock
_bt.Wallet = MagicMock
sys.modules['bittensor'] = _bt

_bt_core = types.ModuleType('bittensor.core')
sys.modules['bittensor.core'] = _bt_core

_bt_chain_data = types.ModuleType('bittensor.core.chain_data')
_bt_chain_data.StakeInfo = FakeStakeInfo
sys.modules['bittensor.core.chain_data'] = _bt_chain_data

_bt_utils = types.ModuleType('bittensor.utils')
sys.modules['bittensor.utils'] = _bt_utils

_bt_bal = types.ModuleType('bittensor.utils.balance')
_bt_bal.Balance = FakeBalance
sys.modules['bittensor.utils.balance'] = _bt_bal

# Clear cached bt package so re-import uses our mocks
for k in list(sys.modules.keys()):
    if k.startswith('bt.') and 'test' not in k and 'conftest' not in k:
        sys.modules.pop(k, None)
sys.modules.pop('bt', None)

# Now force-import the bt package so taocopy's relative import works
import bt as _bt_pkg  # noqa: E402
