import pytest
from core.key import Key


class TestEcdsa:
    crypto_type = 'ecdsa'

    def test_keygen(self):
        key = Key(crypto_type=self.crypto_type)
        assert key.address is not None
        assert key.public_key is not None
        assert key.private_key is not None
        assert key.crypto_type_name == self.crypto_type
        # ECDSA addresses are ethereum format (0x + 40 hex chars)
        assert key.address.startswith('0x')
        assert len(key.address) == 42

    def test_sign_verify(self):
        key = Key(crypto_type=self.crypto_type)
        data = 'hello ecdsa'
        sig = key.sign(data)
        assert isinstance(sig, bytes)
        assert key.verify(data, sig, address=key.address, crypto_type=self.crypto_type)

    def test_sign_verify_wrong_key(self):
        key1 = Key(crypto_type=self.crypto_type)
        key2 = Key(crypto_type=self.crypto_type)
        data = 'test message'
        sig = key1.sign(data)
        assert not key1.verify(data, sig, address=key2.address, crypto_type=self.crypto_type)

    def test_from_mnemonic(self):
        key = Key(crypto_type=self.crypto_type)
        mnemonic = key.generate_mnemonic()
        k1 = key.from_mnemonic(mnemonic, crypto_type=self.crypto_type)
        k2 = key.from_mnemonic(mnemonic, crypto_type=self.crypto_type)
        assert k1.address == k2.address
        assert k1.private_key == k2.private_key

    def test_alias_eth(self):
        key = Key(crypto_type='eth')
        assert key.crypto_type_name == 'ecdsa'
        assert key.address.startswith('0x')

    def test_sign_hex_mode(self):
        key = Key(crypto_type=self.crypto_type)
        sig = key.sign('test', mode='hex')
        assert isinstance(sig, str)
        assert sig.startswith('0x')

    def test_sign_dict_mode(self):
        key = Key(crypto_type=self.crypto_type)
        sig = key.sign('test', mode='dict')
        assert isinstance(sig, dict)
        assert sig['crypto_type'] == self.crypto_type

    def test_address2keytype(self):
        key = Key(crypto_type=self.crypto_type)
        assert key.address2keytype(key.address) == 'ecdsa'
