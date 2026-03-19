"""conftest.py — mock bittensor & mod before any test imports bt."""
import sys
import types
from unittest.mock import MagicMock


class FakeBalance:
    """Stand-in for bittensor.utils.balance.Balance."""
    def __init__(self, tao_val=0.0):
        self.tao = tao_val

    @classmethod
    def from_tao(cls, val):
        return cls(val)


# Build a plain module for 'mod' so pytest won't probe MagicMock attrs
_mod = types.ModuleType('mod')
_mod.print = lambda *a, **kw: None
_mod.get = MagicMock(return_value=None)
_mod.put = MagicMock()
_mod.future = MagicMock()
_mod.as_completed = MagicMock(return_value=[])
_mod.tree = MagicMock()
sys.modules['mod'] = _mod

# Mock bittensor
_bt = types.ModuleType('bittensor')
_bt.Subtensor = MagicMock
_bt.Wallet = MagicMock
sys.modules['bittensor'] = _bt

_bt_utils = types.ModuleType('bittensor.utils')
sys.modules['bittensor.utils'] = _bt_utils

_bt_bal = types.ModuleType('bittensor.utils.balance')
_bt_bal.Balance = FakeBalance
sys.modules['bittensor.utils.balance'] = _bt_bal

# Clear any cached bt import
for k in list(sys.modules.keys()):
    if k == 'bt' or (k.startswith('bt.') and 'test' not in k and 'conftest' not in k):
        del sys.modules[k]
