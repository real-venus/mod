import pytest
import base58
from core.key import Key


class TestSolana:
    crypto_type = 'solana'

    def test_keygen(self):
        key = Key(crypto_type=self.crypto_type)
        assert key.address is not None
        assert key.public_key is not None
        assert key.private_key is not None
        assert key.crypto_type_name == self.crypto_type
        # Solana addresses are base58-encoded 32-byte public keys
        decoded = base58.b58decode(key.address)
        assert len(decoded) == 32

    def test_sign_verify(self):
        key = Key(crypto_type=self.crypto_type)
        data = 'hello solana'
        sig = key.sign(data)
        assert isinstance(sig, bytes)
        assert key.verify(data, sig, address=key.address, crypto_type=self.crypto_type)

    def test_sign_verify_wrong_key(self):
        key1 = Key(crypto_type=self.crypto_type)
        key2 = Key(crypto_type=self.crypto_type)
        data = 'test message'
        sig = key1.sign(data)
        result = False
        try:
            result = key1.verify(data, sig, address=key2.address, crypto_type=self.crypto_type)
        except Exception:
            result = False
        assert not result

    def test_from_mnemonic(self):
        key = Key(crypto_type=self.crypto_type)
        mnemonic = key.generate_mnemonic()
        k1 = key.from_mnemonic(mnemonic, crypto_type=self.crypto_type)
        k2 = key.from_mnemonic(mnemonic, crypto_type=self.crypto_type)
        assert k1.address == k2.address
        assert k1.private_key == k2.private_key

    def test_alias_sol(self):
        key = Key(crypto_type='sol')
        assert key.crypto_type_name == 'solana'
        decoded = base58.b58decode(key.address)
        assert len(decoded) == 32

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
        assert sig['address'] == key.address

    def test_valid_address(self):
        key = Key(crypto_type=self.crypto_type)
        assert key.is_valid_solana_address(key.address)
        assert not key.is_valid_solana_address('0xinvalid')

    def test_address2keytype(self):
        key = Key(crypto_type=self.crypto_type)
        assert key.address2keytype(key.address) == 'solana'
