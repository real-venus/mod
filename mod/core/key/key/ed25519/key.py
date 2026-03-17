
import ed25519_zebra
from ..sr25519.utils import ss58_encode, ss58_decode, is_valid_ss58_address


class Ed25519Key:
    """
    Ed25519 crypto operations
    """
    crypto_type = 'ed25519'
    ss58_format = 42

    @staticmethod
    def derive_keypair(private_key: bytes, ss58_format: int = 42) -> tuple:
        private_key = private_key[:32]
        assert len(private_key) == 32
        # ed_from_seed returns (expanded_secret_key, public_key)
        private_key, public_key = ed25519_zebra.ed_from_seed(private_key)
        address = ss58_encode(public_key, ss58_format=ss58_format)
        return private_key, public_key, address

    @staticmethod
    def from_seed(seed: bytes) -> tuple:
        # ed_from_seed returns (expanded_secret_key, public_key)
        private_key, public_key = ed25519_zebra.ed_from_seed(seed)
        return private_key, public_key

    @staticmethod
    def sign_data(private_key: bytes, public_key: bytes, data: bytes) -> bytes:
        return ed25519_zebra.ed_sign(private_key, data)

    @staticmethod
    def verify_data(signature: bytes, data: bytes, public_key: bytes) -> bool:
        verified = ed25519_zebra.ed_verify(signature, data, public_key)
        if not verified:
            verified = ed25519_zebra.ed_verify(signature, b'<Bytes>' + data + b'</Bytes>', public_key)
        return verified

    @staticmethod
    def resolve_public_key(address: str = None, public_key=None) -> bytes:
        if public_key is not None:
            if isinstance(public_key, str):
                if public_key.startswith('0x'):
                    public_key = public_key[2:]
                public_key = bytes.fromhex(public_key)
            return public_key
        if is_valid_ss58_address(address):
            public_key = ss58_decode(address)
        else:
            public_key = address
        if isinstance(public_key, str):
            if public_key.startswith('0x'):
                public_key = public_key[2:]
            public_key = bytes.fromhex(public_key)
        return public_key
