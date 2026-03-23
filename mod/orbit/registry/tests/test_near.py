"""Tests for NEAR registry backend (local-only mode)."""

import pytest


class TestNearRegister:
    def test_register_returns_id(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/QmTest', owner='alice.testnet')
        assert mod_id == '1'

    def test_register_increments_id(self, near_backend):
        id1 = near_backend.register('mod1', 'ipfs/Qm1', owner='alice.testnet')
        id2 = near_backend.register('mod2', 'ipfs/Qm2', owner='alice.testnet')
        assert id1 == '1'
        assert id2 == '2'

    def test_register_name_uniqueness(self, near_backend):
        near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        with pytest.raises(ValueError, match='already exists'):
            near_backend.register('testmod', 'ipfs/Qm2', owner='alice.testnet')

    def test_register_same_name_different_owners(self, near_backend):
        id1 = near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        id2 = near_backend.register('testmod', 'ipfs/Qm2', owner='bob.testnet')
        assert id1 != id2

    def test_register_stores_mod(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/QmABC', owner='alice.testnet')
        mod = near_backend.get(mod_id)
        assert mod['name'] == 'testmod'
        assert mod['data'] == 'ipfs/QmABC'
        assert mod['owner'] == 'alice.testnet'


class TestNearGet:
    def test_get_existing(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        mod = near_backend.get(mod_id)
        assert mod is not None
        assert mod['name'] == 'testmod'

    def test_get_nonexistent(self, near_backend):
        assert near_backend.get('999') is None

    def test_get_user_mods(self, near_backend):
        near_backend.register('mod1', 'ipfs/Qm1', owner='alice.testnet')
        near_backend.register('mod2', 'ipfs/Qm2', owner='alice.testnet')
        near_backend.register('mod3', 'ipfs/Qm3', owner='bob.testnet')
        mods = near_backend.get_user_mods('alice.testnet')
        assert len(mods) == 2


class TestNearUpdate:
    def test_update(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        near_backend.update(mod_id, 'ipfs/Qm2', owner='alice.testnet')
        assert near_backend.get(mod_id)['data'] == 'ipfs/Qm2'

    def test_update_wrong_owner(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        with pytest.raises(PermissionError):
            near_backend.update(mod_id, 'ipfs/Qm2', owner='bob.testnet')


class TestNearRemove:
    def test_remove(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        near_backend.remove(mod_id, owner='alice.testnet')
        assert near_backend.get(mod_id) is None

    def test_remove_frees_name(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        near_backend.remove(mod_id, owner='alice.testnet')
        assert not near_backend.is_name_taken('alice.testnet', 'testmod')
        new_id = near_backend.register('testmod', 'ipfs/Qm2', owner='alice.testnet')
        assert new_id is not None


class TestNearTransfer:
    def test_transfer(self, near_backend):
        mod_id = near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        near_backend.transfer(mod_id, 'bob.testnet', owner='alice.testnet')
        assert near_backend.get(mod_id)['owner'] == 'bob.testnet'

    def test_transfer_name_conflict(self, near_backend):
        near_backend.register('testmod', 'ipfs/Qm1', owner='alice.testnet')
        near_backend.register('testmod', 'ipfs/Qm2', owner='bob.testnet')
        with pytest.raises(ValueError, match='already exists'):
            near_backend.transfer('1', 'bob.testnet', owner='alice.testnet')


class TestNearListAll:
    def test_list_all(self, near_backend):
        near_backend.register('mod1', 'ipfs/Qm1', owner='alice.testnet')
        near_backend.register('mod2', 'ipfs/Qm2', owner='bob.testnet')
        mods = near_backend.list_all()
        assert len(mods) == 2
