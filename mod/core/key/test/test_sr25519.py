import pytest
from core.key import Key


class TestSr25519:
    crypto_type = 'sr25519'

    def test_keygen(self):
        key = Key(crypto_type=self.crypto_type)
        assert key.address is not None
        assert key.public_key is not None
        assert key.private_key is not None
        assert key.crypto_type_name == self.crypto_type
        # SR25519 addresses are SS58 format (start with 5 for generic substrate)
        assert len(key.address) in [47, 48]

    def test_sign_verify(self):
        key = Key(crypto_type=self.crypto_type)
        data = 'hello sr25519'
        sig = key.sign(data)
        assert isinstance(sig, bytes)
        assert key.verify(data, sig, public_key=key.public_key, crypto_type=self.crypto_type)

    def test_sign_verify_wrong_key(self):
        key1 = Key(crypto_type=self.crypto_type)
        key2 = Key(crypto_type=self.crypto_type)
        data = 'test message'
        sig = key1.sign(data)
        assert not key1.verify(data, sig, public_key=key2.public_key, crypto_type=self.crypto_type)

    def test_from_mnemonic(self):
        key = Key(crypto_type=self.crypto_type)
        mnemonic = key.generate_mnemonic()
        k1 = key.from_mnemonic(mnemonic, crypto_type=self.crypto_type)
        k2 = key.from_mnemonic(mnemonic, crypto_type=self.crypto_type)
        assert k1.address == k2.address
        assert k1.private_key == k2.private_key

    def test_sign_hex_mode(self):
        key = Key(crypto_type=self.crypto_type)
        sig = key.sign('test', mode='hex')
        assert isinstance(sig, str)
        assert sig.startswith('0x')

    def test_sign_dict_mode(self):
        key = Key(crypto_type=self.crypto_type)
        sig = key.sign('test', mode='dict')
        assert isinstance(sig, dict)
        assert 'signature' in sig
        assert 'address' in sig
        assert 'data' in sig
        assert sig['crypto_type'] == self.crypto_type
