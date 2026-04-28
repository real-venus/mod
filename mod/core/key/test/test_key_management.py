import pytest
from core.key import Key


class TestKeyManagement:

    def test_add_and_get_key(self, cleanup_keys):
        key = Key()
        name = cleanup_keys('pytest_add_test')
        added = key.add_key(name, refresh=True)
        assert added.address is not None
        retrieved = key.get_key(name)
        assert retrieved.address == added.address

    def test_key_exists(self, cleanup_keys):
        key = Key()
        name = cleanup_keys('pytest_exists_test')
        assert not key.key_exists(name)
        key.add_key(name)
        assert key.key_exists(name)

    def test_remove_key(self, cleanup_keys):
        key = Key()
        name = 'pytest_rm_test'
        key.add_key(name, refresh=True)
        assert key.key_exists(name)
        key.rm_key(name)
        assert not key.key_exists(name)

    def test_move_key(self, cleanup_keys):
        key = Key()
        src = cleanup_keys('pytest_mv_src')
        dst = cleanup_keys('pytest_mv_dst')
        key.add_key(src, refresh=True)
        og = key.get_key(src)
        key.mv_key(src, dst)
        assert not key.key_exists(src)
        assert key.key_exists(dst)
        moved = key.get_key(dst)
        assert og.address == moved.address

    def test_key_encrypt_decrypt(self, cleanup_keys):
        key = Key()
        name = cleanup_keys('pytest_enc_test')
        password = 'testpass123'
        key.add_key(name, refresh=True)
        og = key.get_key(name)
        assert not key.is_key_encrypted(name)
        key.encrypt_key(name, password=password)
        assert key.is_key_encrypted(name)
        key.decrypt_key(name, password=password)
        assert not key.is_key_encrypted(name)
        decrypted = key.get_key(name)
        assert og.address == decrypted.address

    def test_keys_list(self, cleanup_keys):
        key = Key()
        name = cleanup_keys('pytest_list_test')
        key.add_key(name, refresh=True)
        keys = key.keys()
        assert name in keys

    def test_key2address(self, cleanup_keys):
        key = Key()
        name = cleanup_keys('pytest_k2a_test')
        added = key.add_key(name, refresh=True)
        k2a = key.key2address()
        assert name in k2a
        assert k2a[name] == added.address
