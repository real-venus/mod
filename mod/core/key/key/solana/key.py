
import ed25519_zebra
import base58
from .utils import is_valid_solana_address


class SolanaKey:
    """
    Solana (Ed25519 + Base58) crypto operations
    """
    crypto_type = 'solana'

    @staticmethod
    def derive_keypair(private_key: bytes, **kwargs) -> tuple:
        private_key = private_key[:32] if len(private_key) > 32 else private_key
        assert len(private_key) == 32, f'private_key should be 32 bytes, got {len(private_key)}'
        private_key, public_key = ed25519_zebra.ed_from_seed(private_key)
        address = base58.b58encode(public_key).decode('ascii')
        return private_key, public_key, address

    @staticmethod
    def from_seed(seed: bytes) -> tuple:
        private_key, public_key = ed25519_zebra.ed_from_seed(seed)
        return private_key, public_key

    @staticmethod
    def sign_data(private_key: bytes, public_key: bytes, data: bytes) -> bytes:
        return ed25519_zebra.ed_sign(private_key, data)

    @staticmethod
    def verify_data(signature: bytes, data: bytes, public_key: bytes) -> bool:
        return ed25519_zebra.ed_verify(signature, data, public_key)

    @staticmethod
    def resolve_public_key(address: str = None, public_key=None) -> bytes:
        if public_key is not None:
            if isinstance(public_key, str):
                if public_key.startswith('0x'):
                    public_key = bytes.fromhex(public_key[2:])
                else:
                    try:
                        public_key = base58.b58decode(public_key)
                    except Exception:
                        public_key = bytes.fromhex(public_key)
            return public_key
        if isinstance(address, str):
            try:
                public_key = base58.b58decode(address)
            except Exception:
                if address.startswith('0x'):
                    address = address[2:]
                public_key = bytes.fromhex(address)
        return public_key

    @staticmethod
    def is_valid_address(address: str) -> bool:
        return is_valid_solana_address(address)
