"""Tests for Solana registry backend."""

import pytest


class TestSolanaRegister:
    def test_register_returns_id(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'data', owner='SoLAddr123')
        assert mod_id == '1'

    def test_register_increments_id(self, solana_backend):
        id1 = solana_backend.register('mod1', 'data1', owner='SoLAddr123')
        id2 = solana_backend.register('mod2', 'data2', owner='SoLAddr123')
        assert id1 == '1'
        assert id2 == '2'

    def test_register_name_uniqueness(self, solana_backend):
        solana_backend.register('testmod', 'data1', owner='SoLAddr123')
        with pytest.raises(ValueError, match='already exists'):
            solana_backend.register('testmod', 'data2', owner='SoLAddr123')

    def test_register_tracks_tx(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'data', owner='SoLAddr123')
        tx = solana_backend.get_tx(mod_id)
        assert tx is not None
        assert tx.startswith('local:') or tx.startswith('memo:')

    def test_register_stores_mod(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'ipfs://Qm123', owner='SoLAddr123')
        mod = solana_backend.get(mod_id)
        assert mod['name'] == 'testmod'
        assert mod['data'] == 'ipfs://Qm123'
        assert mod['owner'] == 'SoLAddr123'


class TestSolanaGet:
    def test_get_existing(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'data', owner='SoLAddr123')
        mod = solana_backend.get(mod_id)
        assert mod is not None

    def test_get_nonexistent(self, solana_backend):
        assert solana_backend.get('999') is None

    def test_get_user_mods(self, solana_backend):
        solana_backend.register('mod1', 'data1', owner='SoLAddr123')
        solana_backend.register('mod2', 'data2', owner='SoLAddr123')
        mods = solana_backend.get_user_mods('SoLAddr123')
        assert len(mods) == 2


class TestSolanaUpdate:
    def test_update(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'old', owner='SoLAddr123')
        solana_backend.update(mod_id, 'new', owner='SoLAddr123')
        assert solana_backend.get(mod_id)['data'] == 'new'

    def test_update_wrong_owner(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'data', owner='SoLAddr123')
        with pytest.raises(PermissionError):
            solana_backend.update(mod_id, 'new', owner='SoLAddr456')


class TestSolanaRemove:
    def test_remove(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'data', owner='SoLAddr123')
        solana_backend.remove(mod_id, owner='SoLAddr123')
        assert solana_backend.get(mod_id) is None

    def test_remove_frees_name(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'data', owner='SoLAddr123')
        solana_backend.remove(mod_id, owner='SoLAddr123')
        assert not solana_backend.is_name_taken('SoLAddr123', 'testmod')


class TestSolanaTransfer:
    def test_transfer(self, solana_backend):
        mod_id = solana_backend.register('testmod', 'data', owner='SoLAddr123')
        solana_backend.transfer(mod_id, 'SoLAddr456', owner='SoLAddr123')
        assert solana_backend.get(mod_id)['owner'] == 'SoLAddr456'

    def test_transfer_name_conflict(self, solana_backend):
        solana_backend.register('testmod', 'data1', owner='SoLAddr123')
        solana_backend.register('testmod', 'data2', owner='SoLAddr456')
        with pytest.raises(ValueError, match='already exists'):
            solana_backend.transfer('1', 'SoLAddr456', owner='SoLAddr123')


class TestSolanaListAll:
    def test_list_all(self, solana_backend):
        solana_backend.register('mod1', 'data1', owner='SoLAddr123')
        solana_backend.register('mod2', 'data2', owner='SoLAddr456')
        assert len(solana_backend.list_all()) == 2
