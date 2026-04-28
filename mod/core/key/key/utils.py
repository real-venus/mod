
"""
Shared key utilities. Crypto-specific utils live in their respective submodules:
  - sr25519/utils.py: SS58, PKCS8, derive paths, substrate address detection
  - edcsa/utils.py:   ECDSA sign/verify, BIP32/BIP39, ethereum address detection
  - solana/utils.py:  Solana address validation
"""

import re
from bip39 import bip39_validate

# Re-export from submodules for backward compatibility
from .sr25519.utils import (
    ss58_encode,
    ss58_decode,
    is_valid_ss58_address,
    is_substrate_ss58_address,
    extract_derive_path,
    DeriveJunction,
    decode_pair_from_encrypted_json,
    decode_pkcs8,
    encode_pkcs8,
    encode_pair,
)

from .edcsa.utils import (
    mnemonic_to_ecdsa_private_key,
    ecdsa_sign,
    ecdsa_verify,
    is_valid_ecdsa_address,
    is_ethereum_address,
    valid_h160_address,
)

from .solana.utils import is_valid_solana_address


# --- Shared helpers ---

def str2bytes(data: str, mode: str = 'hex') -> bytes:
    if mode in ['utf-8']:
        return bytes(data, mode)
    elif mode in ['hex']:
        return bytes.fromhex(data)


def is_int(value) -> bool:
    try:
        int(value)
        return True
    except (ValueError, TypeError):
        return False


def python2str(x):
    from copy import deepcopy
    import json
    x = deepcopy(x)
    input_type = type(x)
    if input_type == str:
        return x
    if input_type in [dict]:
        x = json.dumps(x)
    elif input_type in [bytes]:
        x = bytes2str(x)
    elif input_type in [list, tuple, set]:
        x = json.dumps(list(x))
    elif input_type in [int, float, bool]:
        x = str(x)
    return x


def bytes2str(data: bytes, mode: str = 'utf-8') -> str:
    if hasattr(data, 'hex'):
        return data.hex()
    else:
        if isinstance(data, str):
            return data
        return bytes.decode(data, mode)


def is_mnemonic(mnemonic: str, language_code: str = 'en') -> bool:
    if not isinstance(mnemonic, str):
        return False
    return bip39_validate(mnemonic, language_code=language_code)


def detect_address_type(addr: str) -> str:
    """
    Detect address type: 'ecdsa', 'sr25519', 'solana', or 'unknown'
    """
    addr = addr.strip()
    if is_ethereum_address(addr):
        return 'ecdsa'
    if is_substrate_ss58_address(addr):
        return 'sr25519'
    if is_valid_solana_address(addr):
        return 'solana'
    return 'unknown'
