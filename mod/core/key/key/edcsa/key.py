
from eth_keys.datatypes import PrivateKey
from .utils import mnemonic_to_ecdsa_private_key, ecdsa_sign, ecdsa_verify


class EcdsaKey:
    """
    ECDSA (Ethereum) crypto operations
    """
    crypto_type = 'ecdsa'

    @staticmethod
    def derive_keypair(private_key: bytes, **kwargs) -> tuple:
        private_key = private_key[:32] if len(private_key) > 32 else private_key
        assert len(private_key) == 32, f'private_key should be 32 bytes, got {len(private_key)}'
        private_key_obj = PrivateKey(private_key)
        public_key = private_key_obj.public_key.to_address()
        address = private_key_obj.public_key.to_checksum_address()
        return private_key, public_key, address

    @staticmethod
    def from_mnemonic(mnemonic: str) -> bytes:
        return mnemonic_to_ecdsa_private_key(mnemonic)

    @staticmethod
    def sign_data(private_key: bytes, public_key: bytes, data: bytes) -> bytes:
        return ecdsa_sign(private_key, data)

    @staticmethod
    def verify_data(signature: bytes, data: bytes, public_key: bytes) -> bool:
        return ecdsa_verify(signature, data, public_key)

    @staticmethod
    def resolve_public_key(address: str = None, public_key=None) -> bytes:
        if public_key is not None:
            if isinstance(public_key, str):
                if public_key.startswith('0x'):
                    public_key = public_key[2:]
                public_key = bytes.fromhex(public_key)
            return public_key
        public_key = address
        if isinstance(public_key, str):
            if public_key.startswith('0x'):
                public_key = public_key[2:]
                public_key = bytes.fromhex(public_key)
        return public_key
