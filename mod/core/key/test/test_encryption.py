import pytest
from core.key import Key


CRYPTO_TYPES = ['sr25519', 'ed25519', 'ecdsa', 'solana']


class TestEncryption:

    @pytest.mark.parametrize('crypto_type', CRYPTO_TYPES)
    def test_encrypt_decrypt(self, crypto_type):
        key = Key(crypto_type=crypto_type)
        value = 'hello world'
        enc = key.encrypt(value)
        dec = key.decrypt(enc)
        assert str(dec) == value

    @pytest.mark.parametrize('crypto_type', CRYPTO_TYPES)
    def test_encrypt_decrypt_with_password(self, crypto_type):
        key = Key(crypto_type=crypto_type)
        value = 'secret data'
        password = 'mypassword123'
        enc = key.encrypt(value, password=password)
        dec = key.decrypt(enc, password=password)
        assert str(dec) == value

    @pytest.mark.parametrize('value', ['10', 'fam', 'hello world'])
    def test_encrypt_different_values(self, value):
        key = Key(crypto_type='ecdsa')
        enc = key.encrypt(value)
        dec = key.decrypt(enc)
        assert str(dec) == value

    def test_encrypt_dict_value(self):
        key = Key(crypto_type='ecdsa')
        value = {'a': 2, 'b': 'test'}
        enc = key.encrypt(value)
        dec = key.decrypt(enc)
        assert dec == value

    def test_encrypt_int_value(self):
        key = Key(crypto_type='ecdsa')
        value = 42
        enc = key.encrypt(value)
        dec = key.decrypt(enc)
        assert dec == value
