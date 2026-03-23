"""Tests for off-chain registry backend."""

import pytest


class TestRegister:
    def test_register_returns_id(self, offchain):
        mod_id = offchain.register('testmod', 'ipfs://QmTest', owner='alice')
        assert mod_id == '1'

    def test_register_increments_id(self, offchain):
        id1 = offchain.register('mod1', 'data1', owner='alice')
        id2 = offchain.register('mod2', 'data2', owner='alice')
        assert id1 == '1'
        assert id2 == '2'

    def test_register_name_uniqueness_per_owner(self, offchain):
        offchain.register('testmod', 'data1', owner='alice')
        with pytest.raises(ValueError, match='already exists'):
            offchain.register('testmod', 'data2', owner='alice')

    def test_register_same_name_different_owners(self, offchain):
        id1 = offchain.register('testmod', 'data1', owner='alice')
        id2 = offchain.register('testmod', 'data2', owner='bob')
        assert id1 != id2

    def test_register_empty_name_fails(self, offchain):
        with pytest.raises(ValueError):
            offchain.register('', 'data', owner='alice')

    def test_register_empty_data_fails(self, offchain):
        with pytest.raises(ValueError):
            offchain.register('testmod', '', owner='alice')

    def test_register_default_owner(self, offchain):
        mod_id = offchain.register('testmod', 'data')
        mod = offchain.get(mod_id)
        assert mod['owner'] == 'local'


class TestGet:
    def test_get_existing(self, offchain):
        mod_id = offchain.register('testmod', 'ipfs://Qm123', owner='alice')
        mod = offchain.get(mod_id)
        assert mod['name'] == 'testmod'
        assert mod['data'] == 'ipfs://Qm123'
        assert mod['owner'] == 'alice'

    def test_get_nonexistent(self, offchain):
        assert offchain.get('999') is None

    def test_get_user_mods(self, offchain):
        offchain.register('mod1', 'data1', owner='alice')
        offchain.register('mod2', 'data2', owner='alice')
        offchain.register('mod3', 'data3', owner='bob')
        mods = offchain.get_user_mods('alice')
        assert len(mods) == 2
        names = [m['name'] for m in mods]
        assert 'mod1' in names
        assert 'mod2' in names

    def test_get_user_mods_empty(self, offchain):
        assert offchain.get_user_mods('nobody') == []


class TestUpdate:
    def test_update_data(self, offchain):
        mod_id = offchain.register('testmod', 'old_data', owner='alice')
        offchain.update(mod_id, 'new_data', owner='alice')
        mod = offchain.get(mod_id)
        assert mod['data'] == 'new_data'

    def test_update_nonexistent_fails(self, offchain):
        with pytest.raises(ValueError):
            offchain.update('999', 'data')

    def test_update_wrong_owner_fails(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        with pytest.raises(PermissionError):
            offchain.update(mod_id, 'new_data', owner='bob')

    def test_update_empty_data_fails(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        with pytest.raises(ValueError):
            offchain.update(mod_id, '', owner='alice')


class TestRemove:
    def test_remove(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        offchain.remove(mod_id, owner='alice')
        assert offchain.get(mod_id) is None

    def test_remove_frees_name(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        offchain.remove(mod_id, owner='alice')
        assert not offchain.is_name_taken('alice', 'testmod')
        # Can re-register
        new_id = offchain.register('testmod', 'data2', owner='alice')
        assert new_id is not None

    def test_remove_updates_user_mods(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        offchain.remove(mod_id, owner='alice')
        assert offchain.get_user_mods('alice') == []

    def test_remove_wrong_owner_fails(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        with pytest.raises(PermissionError):
            offchain.remove(mod_id, owner='bob')


class TestTransfer:
    def test_transfer_ownership(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        offchain.transfer(mod_id, 'bob', owner='alice')
        mod = offchain.get(mod_id)
        assert mod['owner'] == 'bob'

    def test_transfer_updates_user_lists(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        offchain.transfer(mod_id, 'bob', owner='alice')
        assert len(offchain.get_user_mods('alice')) == 0
        assert len(offchain.get_user_mods('bob')) == 1

    def test_transfer_updates_name_map(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        offchain.transfer(mod_id, 'bob', owner='alice')
        assert not offchain.is_name_taken('alice', 'testmod')
        assert offchain.is_name_taken('bob', 'testmod')

    def test_transfer_name_conflict_fails(self, offchain):
        offchain.register('testmod', 'data1', owner='alice')
        offchain.register('testmod', 'data2', owner='bob')
        with pytest.raises(ValueError, match='already exists'):
            offchain.transfer('1', 'bob', owner='alice')

    def test_transfer_wrong_owner_fails(self, offchain):
        mod_id = offchain.register('testmod', 'data', owner='alice')
        with pytest.raises(PermissionError):
            offchain.transfer(mod_id, 'charlie', owner='bob')


class TestListAll:
    def test_list_all(self, offchain):
        offchain.register('mod1', 'data1', owner='alice')
        offchain.register('mod2', 'data2', owner='bob')
        mods = offchain.list_all()
        assert len(mods) == 2

    def test_list_all_empty(self, offchain):
        assert offchain.list_all() == []


class TestIsNameTaken:
    def test_name_not_taken(self, offchain):
        assert not offchain.is_name_taken('alice', 'testmod')

    def test_name_taken(self, offchain):
        offchain.register('testmod', 'data', owner='alice')
        assert offchain.is_name_taken('alice', 'testmod')

    def test_name_taken_different_owner(self, offchain):
        offchain.register('testmod', 'data', owner='alice')
        assert not offchain.is_name_taken('bob', 'testmod')
