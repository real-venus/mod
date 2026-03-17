
import json
import base64
import re
from typing import Union
from os import urandom
from nacl.hashlib import scrypt
from nacl.secret import SecretBox
from sr25519 import pair_from_ed25519_secret_key
from scalecodec.utils.ss58 import ss58_encode, ss58_decode, is_valid_ss58_address as _is_valid_ss58_address
from scalecodec.base import ScaleBytes
from scalecodec.types import Bytes
from hashlib import blake2b
from math import ceil

JUNCTION_ID_LEN = 32
RE_JUNCTION = r'(\/\/?)([^/]+)'

NONCE_LENGTH = 24
SCRYPT_LENGTH = 32 + (3 * 4)
PKCS8_DIVIDER = bytes([161, 35, 3, 33, 0])
PKCS8_HEADER = bytes([48, 83, 2, 1, 1, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32])
PUB_LENGTH = 32
SALT_LENGTH = 32
SEC_LENGTH = 64
SEED_LENGTH = 32
SCRYPT_N = 1 << 15
SCRYPT_P = 1
SCRYPT_R = 8


def is_valid_ss58_address(address: str) -> bool:
    try:
        ss58_decode(address)
        return True
    except:
        return False


def is_substrate_ss58_address(s: str) -> bool:
    if not isinstance(s, str):
        return False
    s = s.strip()
    if not (47 <= len(s) <= 48):
        return False
    if not re.fullmatch(r'[1-9A-HJ-NP-Za-km-z]{47,48}', s):
        return False
    common_prefixes = {
        '1', '5', 'D', 'F', 'H', 'J', 'K', 'L', 'M', 'N',
        'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'
    }
    if s[0] not in common_prefixes:
        return False
    if s.startswith('0x'):
        return False
    return True


class DeriveJunction:
    def __init__(self, chain_code, is_hard=False):
        self.chain_code = chain_code
        self.is_hard = is_hard

    @classmethod
    def from_derive_path(cls, path: str, is_hard=False):
        if path.isnumeric():
            byte_length = ceil(int(path).bit_length() / 8)
            chain_code = int(path).to_bytes(byte_length, 'little').ljust(32, b'\x00')
        else:
            path_scale = Bytes()
            path_scale.encode(path)
            if len(path_scale.data) > JUNCTION_ID_LEN:
                chain_code = blake2b(path_scale.data.data, digest_size=32).digest()
            else:
                chain_code = bytes(path_scale.data.data.ljust(32, b'\x00'))
        return cls(chain_code=chain_code, is_hard=is_hard)


def extract_derive_path(derive_path: str):
    path_check = ''
    junctions = []
    paths = re.findall(RE_JUNCTION, derive_path)
    if paths:
        path_check = ''.join(''.join(path) for path in paths)
        for path_separator, path_value in paths:
            junctions.append(DeriveJunction.from_derive_path(
                path=path_value, is_hard=path_separator == '//')
            )
    if path_check != derive_path:
        raise ValueError('Reconstructed path "{}" does not match input'.format(path_check))
    return junctions


def decode_pair_from_encrypted_json(json_data: Union[str, dict], passphrase: str) -> tuple:
    if type(json_data) is str:
        json_data = json.loads(json_data)
    if json_data.get('encoding', {}).get('version') != "3":
        raise ValueError("Unsupported JSON format")
    encrypted = base64.b64decode(json_data['encoded'])
    if 'scrypt' in json_data['encoding']['type']:
        salt = encrypted[0:32]
        n = int.from_bytes(encrypted[32:36], byteorder='little')
        p = int.from_bytes(encrypted[36:40], byteorder='little')
        r = int.from_bytes(encrypted[40:44], byteorder='little')
        password = scrypt(passphrase.encode(), salt, n=n, r=r, p=p, dklen=32, maxmem=2 ** 26)
        encrypted = encrypted[SCRYPT_LENGTH:]
    else:
        password = passphrase.encode().rjust(32, b'\x00')
    if "xsalsa20-poly1305" not in json_data['encoding']['type']:
        raise ValueError("Unsupported encoding type")
    nonce = encrypted[0:NONCE_LENGTH]
    message = encrypted[NONCE_LENGTH:]
    secret_box = SecretBox(key=password)
    decrypted = secret_box.decrypt(message, nonce)
    secret_key, public_key = decode_pkcs8(decrypted)
    if 'sr25519' in json_data['encoding']['content']:
        converted_public_key, secret_key = pair_from_ed25519_secret_key(secret_key)
        assert(public_key == converted_public_key)
    return secret_key, public_key


def decode_pkcs8(ciphertext: bytes) -> tuple:
    current_offset = 0
    header = ciphertext[current_offset:len(PKCS8_HEADER)]
    if header != PKCS8_HEADER:
        raise ValueError("Invalid Pkcs8 header found in body")
    current_offset += len(PKCS8_HEADER)
    secret_key = ciphertext[current_offset:current_offset + SEC_LENGTH]
    current_offset += SEC_LENGTH
    divider = ciphertext[current_offset:current_offset + len(PKCS8_DIVIDER)]
    if divider != PKCS8_DIVIDER:
        raise ValueError("Invalid Pkcs8 divider found in body")
    current_offset += len(PKCS8_DIVIDER)
    public_key = ciphertext[current_offset: current_offset + PUB_LENGTH]
    return secret_key, public_key


def encode_pkcs8(public_key: bytes, private_key: bytes) -> bytes:
    return PKCS8_HEADER + private_key + PKCS8_DIVIDER + public_key


def encode_pair(public_key: bytes, private_key: bytes, passphrase: str) -> bytes:
    message = encode_pkcs8(public_key, private_key)
    salt = urandom(SALT_LENGTH)
    password = scrypt(passphrase.encode(), salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32, maxmem=2 ** 26)
    secret_box = SecretBox(key=password)
    message = secret_box.encrypt(message)
    scrypt_params = SCRYPT_N.to_bytes(4, 'little') + SCRYPT_P.to_bytes(4, 'little') + SCRYPT_R.to_bytes(4, 'little')
    return salt + scrypt_params + message.nonce + message.ciphertext
