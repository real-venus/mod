
from typing import Union, Optional
import time
import os
import glob as _glob
import binascii
import copy
from copy import deepcopy
import hashlib
import web3
from scalecodec.base import ScaleBytes
from bip39 import bip39_to_mini_secret, bip39_generate, bip39_validate
import json
import shutil

from .utils import (
    python2str,
    str2bytes,
    detect_address_type,
    is_int,
    is_valid_ss58_address,
)

from .sr25519.key import Sr25519Key
from .ed25519.key import Ed25519Key
from .edcsa.key import EcdsaKey
from .solana.key import SolanaKey


class Key:

    # crypto type registry
    crypto_type_map = {'ed25519': 0, 'sr25519': 1, 'ecdsa': 2, 'solana': 3}
    crypto_type_aliases = {
        'eth': 'ecdsa',
        'secp256k1': 'ecdsa',
        'sub': 'sr25519',
        'substrate': 'sr25519',
        'dot': 'sr25519',
        'sol': 'solana',
    }
    crypto_types = list(crypto_type_map.keys())
    reverse_crypto_type_map = {v: k for k, v in crypto_type_map.items()}

    # dispatch registry: maps crypto_type name -> module class
    crypto_modules = {
        'sr25519': Sr25519Key,
        'ed25519': Ed25519Key,
        'ecdsa': EcdsaKey,
        'solana': SolanaKey,
    }

    default_key = 'mod'
    ss58_format = 42
    crypto_type = 'ecdsa'
    language_code = 'en'
    storage_path = os.path.expanduser('~/.mod/key')

    # --- standalone replacements for mod dependency ---

    @staticmethod
    def _put(path, data):
        """Write JSON data to a file path."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            json.dump(data, f)

    @staticmethod
    def _get(path, **kwargs):
        """Read JSON data from a file path."""
        if not os.path.exists(path):
            return None
        with open(path, 'r') as f:
            try:
                return json.load(f)
            except (json.JSONDecodeError, ValueError):
                f.seek(0)
                return f.read()

    @staticmethod
    def _rm(path):
        """Remove a file or directory."""
        if os.path.isdir(path):
            shutil.rmtree(path)
        elif os.path.isfile(path):
            os.remove(path)

    @staticmethod
    def _hash(data: str) -> str:
        """SHA256 hash of a string, returned as hex."""
        return hashlib.sha256(data.encode()).hexdigest()

    @staticmethod
    def _glob(pattern):
        """Glob for files matching pattern."""
        return _glob.glob(pattern, recursive=True)

    @staticmethod
    def _time():
        """Current unix timestamp."""
        return int(time.time())

    # expose as instance methods for backward compat
    put = _put
    get = _get
    rm = _rm
    hash = _hash
    glob = _glob
    time = _time

    def __init__(self,
                 private_key: Union[bytes, str] = None,
                 mnemonic: Optional[str] = None,
                 crypto_type: int = crypto_type,
                 path: str = 'mod',
                 **kwargs):
        self.set_key(private_key=private_key, crypto_type=crypto_type, mnemonic=mnemonic, path=path, **kwargs)

    def get_module(self, crypto_type: str):
        """Get the crypto module for a given type name."""
        crypto_type = self.get_crypto_type(crypto_type)
        if crypto_type not in self.crypto_modules:
            raise ValueError(f'crypto_type "{crypto_type}" not supported')
        return self.crypto_modules[crypto_type]

    def set_key(self, private_key: Union[bytes, str], crypto_type: int, mnemonic: Optional[str] = None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        mod = self.get_module(crypto_type)

        if mnemonic:
            private_key = self.from_mnemonic(mnemonic, crypto_type=crypto_type).private_key
        elif private_key is None:
            private_key = self.new_key(crypto_type=crypto_type).private_key
        if type(private_key) == str:
            private_key = str2bytes(private_key)

        private_key, public_key, address = mod.derive_keypair(private_key, ss58_format=self.ss58_format)

        if type(public_key) is str:
            public_key = bytes.fromhex(public_key.replace('0x', ''))

        self.crypto_type_name = crypto_type
        self.crypto_type = self.crypto_type_id = self.crypto_type_map[crypto_type]
        self.private_key = private_key
        self.public_key = public_key
        self.address = self.addy = self.key_address = self.ss58_address = address
        return {'address': address, 'crypto_type': crypto_type}

    def priv(self, key, crypto_type=None):
        return self.get_key(key, crypto_type=crypto_type).private_key.hex()

    def get_crypto_type(self, crypto_type=None):
        if crypto_type is None:
            crypto_type = self.crypto_type
        if crypto_type in self.crypto_type_aliases:
            crypto_type = self.crypto_type_aliases[crypto_type]
        if is_int(crypto_type):
            crypto_type = self.reverse_crypto_type_map[int(crypto_type)]
        elif isinstance(crypto_type, str):
            crypto_type = crypto_type.lower()
        else:
            raise ValueError(f'crypto_type {crypto_type} not supported')
        return crypto_type

    def valid_ss58_address(self, address):
        return is_valid_ss58_address(address)

    def to_checksum_address(self, address):
        return web3.Web3.to_checksum_address(address)

    def add_key(self, path: str, crypto_type=None, mnemonic: str = None, refresh: bool = False, private_key=None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        if not self.key_exists(path, crypto_type=crypto_type) or refresh:
            key = self.new_key(private_key=private_key, crypto_type=crypto_type, mnemonic=mnemonic, **kwargs)
            key_json = json.loads(key.to_json())
            assert crypto_type == self.get_crypto_type(key_json['crypto_type']), f'crypto_type mismatch {crypto_type} != {key_json["crypto_type"]}'
            path = self.get_path(path) + '/' + crypto_type + '/' + key.address + '.json'
            self.put(path, key_json)
            assert self.key_exists(path, crypto_type=crypto_type), f'key does not exist at {path}'
        return self.get_key(path, crypto_type=crypto_type)

    def mv_key(self, path, new_path):
        key = self.get_key(path)
        crypto_type = self.get_crypto_type(key.crypto_type)
        new_key_path = self.get_path(new_path + '/' + crypto_type)
        old_key_path = self.get_path(path + '/' + crypto_type)
        shutil.copytree(old_key_path, new_key_path, dirs_exist_ok=True)
        assert self.key_exists(new_path), f'key does not exist at {new_key_path}'
        shutil.rmtree(old_key_path)
        assert not self.key_exists(path), f'key still exists at {old_key_path}'
        return {'success': True, 'from': path, 'to': new_path}

    def get_path(self, path: str) -> str:
        if not path.startswith(self.storage_path):
            path = self.storage_path + '/' + path
        return path

    def root_key(self):
        return self.get_key(self.default_key)

    def get_key_dirpath(self, key: str, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        key_path = self.get_key_path(key, crypto_type=crypto_type)
        return '/'.join(key_path.split('/')[:-1])

    def get_key(self,
                key: str,
                password: Optional[str] = None,
                create_if_not_exists: bool = True,
                prompt_password: bool = False,
                crypto_type=None,
                type=None,
                **kwargs):
        if hasattr(key, 'address'):
            return key

        path = key
        crypto_type = self.get_crypto_type(type or crypto_type)

        if hasattr(path, 'address'):
            return path

        if 'type' in kwargs:
            crypto_type = kwargs.pop('type')
        path = path or 'mod'
        if not self.key_exists(path):
            if create_if_not_exists:
                key = self.add_key(path, **kwargs)
            else:
                raise ValueError(f'key does not exist at --> {path}')
        key_json = self.get_data(path)
        if self.is_encrypted(key_json):
            if prompt_password and password is None:
                password = input(f'enter password to decrypt {path} ')
            key_json = self.decrypt(data=key_json, password=password)
        if isinstance(key_json, str):
            key_json = json.loads(key_json)
        # unwrap {'data': {...}, 'encrypted': False, ...} format
        if isinstance(key_json, dict) and 'data' in key_json and isinstance(key_json['data'], dict):
            key_json = key_json['data']
        return self.from_json(key_json, crypto_type=crypto_type)

    def detect_address_type(self, address):
        return self.get_crypto_type(detect_address_type(address))

    def get_keys(self, search=None, clean_failed_keys=False):
        keys = {}
        for key in self.keys():
            if str(search) in key or search is None:
                try:
                    keys[key] = self.get_key(key)
                except Exception:
                    continue
                if keys[key] is None:
                    if clean_failed_keys:
                        self.rm_key(key)
                    keys.pop(key)
        return keys

    def key2path(self, search=None, crypto_type=crypto_type) -> dict:
        crypto_type = self.get_crypto_type(crypto_type)
        if not os.path.exists(self.storage_path):
            return {}
        key_names = os.listdir(self.storage_path)
        key2path = {}
        for kn in key_names:
            if search:
                if not search in kn:
                    continue
            key_path = self.storage_path + '/' + kn + '/' + crypto_type + '/'
            if not os.path.exists(key_path):
                continue
            key_address_filenames = os.listdir(key_path)
            for filename in key_address_filenames:
                full_path = key_path + filename
                if os.path.isfile(full_path):
                    key2path[kn] = full_path
        return key2path

    def key2address(self, crypto_type=None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        key2path = self.key2path(crypto_type=crypto_type)
        key2address = {}
        for key, path in key2path.items():
            key2address[key] = path.split('/')[-1].split('.')[0]
        return key2address

    def key2type(self, search=None, crypto_type=None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        key2path = self.key2path(crypto_type=crypto_type)
        key2address = {}
        for key, path in key2path.items():
            if search:
                if not search in key:
                    continue
            key2address[key] = path.split('/')[-1].split('.')[0]
        return key2address

    def address2key(self, search: Optional[str] = None, crypto_type=None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        address2key = {v: k for k, v in self.key2address(crypto_type=crypto_type).items()}
        if search is not None:
            return {k: v for k, v in address2key.items() if search in k}
        return address2key

    def keys(self, search: str = None, crypto_type=None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        keys = list(self.key2path(crypto_type=crypto_type).keys())
        if search is not None:
            keys = [key for key in keys if search in key]
        return keys

    def n(self, *args, **kwargs):
        return len(self.key2address(*args, **kwargs))

    def key_exists(self, key, crypto_type=None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        key2path = self.key2path(crypto_type=crypto_type)
        if f'/{crypto_type}/' in key:
            key = key.split(f'/{crypto_type}/')[0].split(self.storage_path)[-1].strip('/')
        if key in key2path or key in key2path.values():
            return True
        return False

    def get_key_path(self, key, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        key2path = self.key2path(crypto_type=crypto_type)
        if key in key2path:
            return key2path[key]
        elif key in key2path.values():
            return key
        else:
            return self.get_path(key)

    def key_name(self, key, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        address2key = self.address2key(crypto_type=crypto_type)
        if key in address2key:
            return address2key[key]
        elif key in address2key.values():
            return key
        else:
            return None
    keyname = key_name

    @property
    def name(self):
        if not hasattr(self, '_key_name'):
            self._key_name = self.key_name(self.address, crypto_type=self.crypto_type)
        return self._key_name

    def get_data(self, key: str, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        key_path = self.get_key_path(key, crypto_type=crypto_type)
        data = self.get(key_path)
        if isinstance(data, str):
            data = data.replace("'", '"')
            data = json.loads(data)
        return data

    key_info = key_data = get_data

    def _rm_all_keys(self):
        if input(f'Are you sure to remove {self.storage_path} (y to continue)') == 'y':
            return self.rm(self.storage_path)
        else:
            return 'RM_ALL_KEYS ABORTED'

    def key2dirpath(self, crypto_type=None, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        key2path = self.key2path(crypto_type=crypto_type)
        key2dirpath = {}
        for key, path in key2path.items():
            key2dirpath[key] = '/'.join(path.split('/')[:-1])
        return key2dirpath

    def rm_key(self, key=None, crypto_type=None, **kwargs):
        key2dirpath = self.key2dirpath(crypto_type=crypto_type)
        assert os.path.exists(key2dirpath[key])
        shutil.rmtree(key2dirpath[key])
        assert not self.key_exists(key, crypto_type=crypto_type), f'Failed to delete key {key}'
        return {'deleted': [key]}

    def is_mnemonic(self, mnemonic: str) -> bool:
        if not isinstance(mnemonic, str):
            return False
        return bip39_validate(mnemonic, self.language_code)

    def new_key(self, mnemonic: str = None, suri: str = None, private_key: str = None, crypto_type: Union[int, str] = crypto_type, **kwargs):
        crypto_type = self.get_crypto_type(crypto_type)
        if mnemonic:
            key = self.from_mnemonic(mnemonic, crypto_type=crypto_type)
        elif private_key:
            key = self.from_private_key(private_key, crypto_type=crypto_type)
        elif suri:
            key = self.from_uri(suri, crypto_type=crypto_type)
        else:
            key = self.from_mnemonic(self.generate_mnemonic(), crypto_type=crypto_type)
        return key

    def to_json(self, password: str = None) -> dict:
        state_dict = copy.deepcopy(self.__dict__)
        for k, v in state_dict.items():
            if type(v) in [bytes]:
                state_dict[k] = v.hex()
                if password is not None:
                    state_dict[k] = self.encrypt(data=state_dict[k], password=password)
        if '_ss58_address' in state_dict:
            state_dict['ss58_address'] = state_dict.pop('_ss58_address')
        state_dict = json.dumps(state_dict)
        return state_dict

    def from_json(self, obj: Union[str, dict], password: str = None, crypto_type=None) -> dict:
        if type(obj) == str:
            obj = json.loads(obj)
        if obj is None:
            return None
        if self.is_encrypted(obj) and password is not None:
            obj = self.decrypt(data=obj, password=password)
        if 'ss58_address' in obj:
            obj['_ss58_address'] = obj.pop('ss58_address')
        if crypto_type is not None:
            obj['crypto_type'] = crypto_type
        return Key(**obj)

    def generate_mnemonic(self, words: int = 24) -> str:
        mnemonic = bip39_generate(words, self.language_code)
        assert bip39_validate(mnemonic, self.language_code), "Invalid mnemonic"
        return mnemonic

    def from_uri(self, uri: str, crypto_type=crypto_type) -> 'Key':
        return self.derive_path(uri, crypto_type=crypto_type)

    def from_mnemonic(self, mnemonic: str = None, crypto_type=crypto_type) -> 'Key':
        crypto_type = self.get_crypto_type(crypto_type)
        mnemonic = mnemonic or self.generate_mnemonic()

        if crypto_type == "ecdsa":
            if self.language_code != "en":
                raise ValueError("ECDSA mnemonic only supports english")
            private_key = EcdsaKey.from_mnemonic(mnemonic)
            keypair = self.from_private_key(private_key, crypto_type=crypto_type)
        else:
            seed_hex = binascii.hexlify(bytearray(bip39_to_mini_secret(mnemonic, "", self.language_code))).decode("ascii")
            if type(seed_hex) is str:
                seed_hex = bytes.fromhex(seed_hex.replace('0x', ''))
            mod = self.get_module(crypto_type)
            private_key, public_key = mod.from_seed(seed_hex)
            keypair = Key(private_key=private_key, crypto_type=crypto_type)

        keypair.mnemonic = mnemonic
        return keypair

    def key_equals(self, key2: 'Key') -> bool:
        return self.private_key == key2.private_key and self.public_key == key2.public_key and self.crypto_type == key2.crypto_type

    def from_path(self, path: str, name=None, crypto_type=crypto_type) -> 'Key':
        address = os.listdir(path + '/' + crypto_type)[0].split('/')[-1].split('.json')[0]
        name = name or path.split('/')[0]
        if self.key_exists(name, crypto_type=crypto_type):
            self.rm_key(name, crypto_type=crypto_type)
        new_path = self.get_path(name)
        shutil.copytree(path, new_path, dirs_exist_ok=True)
        assert self.key_exists(name, crypto_type=crypto_type), f'key does not exist at {new_path}'
        key = self.get_key(name, crypto_type=crypto_type)
        assert key.address == address, f'address mismatch {key.address} != {address}'
        return key

    def from_private_key(self, private_key: Union[bytes, str], crypto_type: int = crypto_type) -> 'Key':
        if isinstance(private_key, str):
            if private_key.startswith('0x'):
                private_key = private_key[2:]
            private_key = bytes.fromhex(private_key)
        return Key(private_key=private_key, crypto_type=crypto_type)

    def encode_signature_data(self, data: Union[ScaleBytes, bytes, str, dict]) -> bytes:
        data = copy.deepcopy(data)
        if not isinstance(data, str):
            data = python2str(data)
        if isinstance(data, str):
            if type(data) is str:
                data = data.encode()
        if type(data) is ScaleBytes:
            data = bytes(data.data)
        return data

    def get_sig(self, signature: Union[bytes, str]):
        if isinstance(signature, str):
            if signature.startswith('0x'):
                signature = bytes.fromhex(signature[2:])
            else:
                signature = bytes.fromhex(signature)
        if type(signature) is not bytes:
            raise TypeError(f"Signature should be of type bytes or a hex-string {signature}")
        return signature

    def get_public_key(self, address=None, public_key=None, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        mod = self.get_module(crypto_type)
        return mod.resolve_public_key(address=address, public_key=public_key)

    def is_valid_solana_address(self, address):
        return SolanaKey.is_valid_address(address)

    def address2keytype(self, address):
        if web3.Web3.is_address(address):
            return 'ecdsa'
        elif is_valid_ss58_address(address):
            return 'sr25519'
        elif self.is_valid_solana_address(address):
            return 'solana'
        else:
            raise ValueError(f'address {address} is not a valid ss58, ethereum, or solana address')

    def sign(self, data: Union[ScaleBytes, bytes, str], mode='bytes', key=None, crypto_type=None) -> bytes:
        data = self.encode_signature_data(data)
        crypto_type = self.get_crypto_type(crypto_type)
        key = self.get_key(key, crypto_type=crypto_type) if key else self
        mod = self.get_module(crypto_type)

        signature = mod.sign_data(key.private_key, key.public_key, data)

        if mode in ['str', 'hex']:
            signature = '0x' + signature.hex()
        elif mode in ['dict', 'json']:
            signature = {
                'data': data.decode(),
                'crypto_type': crypto_type,
                'signature': signature.hex(),
                'address': key.address
            }
        elif mode == 'bytes':
            signature = signature
        else:
            raise ValueError(f'invalid mode {mode}')

        return signature

    def verify(self,
               data: Union[ScaleBytes, bytes, str, dict],
               signature: Union[bytes, str] = None,
               address=None,
               public_key: Optional[str] = None,
               max_age=None,
               crypto_type=None,
               **kwargs) -> bool:
        if isinstance(data, dict) and all(k in data for k in ['data', 'signature', 'address']):
            data, signature, address = data['data'], data['signature'], data['address']
        data = self.encode_signature_data(data)
        signature = self.get_sig(signature)
        crypto_type = self.get_crypto_type(crypto_type)
        mod = self.get_module(crypto_type)
        public_key = mod.resolve_public_key(address=address, public_key=public_key)

        return mod.verify_data(signature, data, public_key)

    def encrypt(self, data, password=None, key=None):
        return self.get_encryption_key(password=password, key=key).encrypt(data)

    def decrypt(self, data, password=None, key=None):
        return self.get_encryption_key(password=password, key=key).decrypt(data)

    lowercase2checksum = to_checksum_address

    def get_encryption_key(self, password: str = None, key: Optional[str] = None):
        from .aes import AesKey
        return AesKey(password or self._get_password())

    def _get_password(self):
        """Get or generate a password for encryption."""
        pw_path = self.storage_path + '/password'
        if os.path.exists(pw_path):
            with open(pw_path, 'r') as f:
                try:
                    return json.load(f)
                except (json.JSONDecodeError, ValueError):
                    f.seek(0)
                    return f.read().strip()
        pw = self._hash(str(int(time.time())))
        os.makedirs(os.path.dirname(pw_path), exist_ok=True)
        with open(pw_path, 'w') as f:
            json.dump(pw, f)
        return pw

    def encrypt_key(self, path='test.enc', key=None, crypto_type=None, password=None):
        assert self.key_exists(path), f'file {path} does not exist'
        assert not self.is_key_encrypted(path), f'{path} already encrypted'
        path = self.get_key_path(path)
        data = self.get(path)
        enc_data = self.encrypt(deepcopy(data), password=password)
        if not isinstance(data, dict):
            return False
        enc_text = {'data': enc_data, "address": data['address'], "crypto_type": data['crypto_type'], 'encrypted': True}
        self.put(path, enc_text)
        assert self.is_key_encrypted(path)
        return enc_text

    def is_key_encrypted(self, key, data=None, crypto_type=None):
        return self.is_encrypted(self.get_data(key, crypto_type=crypto_type))

    def encrypted_keys(self, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        keys = self.keys(crypto_type=crypto_type)
        encrypted_keys = []
        for k in keys:
            if self.is_key_encrypted(k, crypto_type=crypto_type):
                encrypted_keys.append(k)
        return encrypted_keys

    def decrypt_key(self, path='test.enc', crypto_type=None, password=None, key=None):
        crypto_type = self.get_crypto_type(crypto_type)
        assert self.key_exists(path, crypto_type=crypto_type), f'file {path} does not exist'
        assert self.is_key_encrypted(path, crypto_type=crypto_type), f'{path} not encrypted'
        path = self.get_key_path(path, crypto_type=crypto_type)
        data = self.get_data(path, crypto_type=crypto_type)
        assert self.is_encrypted(data), f'{path} not encrypted'
        dec_text = self.decrypt(data['data'], password=password, key=key)
        self.put(path, dec_text)
        assert not self.is_key_encrypted(path, crypto_type=crypto_type), f'failed to decrypt {path}'
        loaded_key = self.get_key(path, crypto_type=crypto_type)
        return {'path': path, 'address': loaded_key.ss58_address, 'crypto_type': loaded_key.crypto_type}

    password_path = storage_path + '/password'
    min_password_chars = 8

    def set_password(self, password=None):
        import getpass
        if password is None:
            password = getpass.getpass('Enter password:')
        assert len(password) >= self.min_password_chars
        self.put(self.password_path, password)
        return password

    def password(self, update=False):
        return self._get_password()

    def encrypt_all_keys(self, password=None, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        keys = self.keys(crypto_type=crypto_type)
        encrypted_keys = {}
        for k in keys:
            if not self.is_key_encrypted(k, crypto_type=crypto_type):
                encrypted_keys[k] = self.encrypt_key(k, password=password, crypto_type=crypto_type)
        return encrypted_keys

    def decrypt_all_keys(self, password=None, key=None, crypto_type=None):
        crypto_type = self.get_crypto_type(crypto_type)
        keys = self.keys(crypto_type=crypto_type)
        decrypted_keys = {}
        for k in keys:
            if self.is_key_encrypted(k, crypto_type=crypto_type):
                decrypted_keys[k] = self.decrypt_key(k, password=password, key=key, crypto_type=crypto_type)
        return decrypted_keys

    def __str__(self):
        crypto_type = self.get_crypto_type(self.crypto_type)
        return f'Key({self.address}, type={crypto_type})'

    def is_encrypted(self, data):
        if isinstance(data, str):
            if data.startswith('{') and data.endswith('}'):
                try:
                    data = json.loads(data)
                except:
                    pass
            if data in self.keys():
                data = self.get_data(data)
        return isinstance(data, dict) and bool(data.get('encrypted', False))

    @property
    def multiaddress(self):
        return self.crypto_type_name + '/' + self.address
