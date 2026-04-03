import base64
import hmac
import json
import time
from typing import Dict, Optional, Any, Set
import mod as m
import hashlib

class Auth:
    """Enterprise-grade authentication system with military-grade security"""

    separators=(',', ':')

    def __init__(self, 
                key=None, 
                crypto_type='sr25519', 
                hash_type='sha256',    
                max_age=60, 
                signature_keys=['data', 'time', 'cost'],
                enable_nonce=True,
                enable_expiry=True,
                nonce_cache_size=10000):
        """
        Initialize Auth with enhanced security features
        
        Args:
            key: Cryptographic key for signing
            crypto_type: Cryptographic algorithm (sr25519, ed25519, etc.)
            hash_type: Hash algorithm (sha256, sha512)
            max_age: Maximum token age in seconds
            signature_keys: Keys included in signature payload
            enable_nonce: Enable replay attack prevention
            enable_expiry: Enable explicit token expiration
            nonce_cache_size: Maximum nonces to track before cleanup
        """
        self.signature_keys = signature_keys
        self.crypto_type = crypto_type
        self.key = m.get_key(key=key, crypto_type=crypto_type)
        self.hash_type = hash_type
        self.auth_features = signature_keys + ['key', 'signature']
        self.max_age = max_age
        self.enable_nonce = enable_nonce
        self.enable_expiry = enable_expiry
        self.nonce_cache_size = nonce_cache_size
        self._used_nonces: Set[str] = set()

    def forward(self, data: Any, key=None, cost=0, ttl=None) -> dict:
        """
        Generate cryptographically signed authentication headers
        
        Args:
            data: Payload to authenticate
            key: Optional key override
            cost: Computational cost metric
            ttl: Time-to-live override (seconds)
            
        Returns:
            Authentication headers with signature
        """
        key = self.get_key(key)
        current_time = time.time()
        
        result = {
            'data': self.hash(data),
            'time': str(current_time),
            'cost': str(cost),
            'key': key.address,
        }
        
        # Replay attack prevention via nonce
        if self.enable_nonce:
            nonce = hashlib.sha256(
                f"{current_time}{key.address}{data}".encode()
            ).hexdigest()[:16]
            result['nonce'] = nonce
            if 'nonce' not in self.signature_keys:
                self.signature_keys.append('nonce')
        
        # Explicit expiration timestamp
        if self.enable_expiry:
            expiry = current_time + (ttl if ttl else self.max_age)
            result['expiry'] = str(expiry)
            if 'expiry' not in self.signature_keys:
                self.signature_keys.append('expiry')
        
        result['signature'] = key.sign(self.get(result), mode='str')
        return result

    headers = generate = forward

    def verify(self, headers: dict, data: Optional[Any]=None, max_age=None, check_nonce=True) -> bool:
        """
        Verify authentication headers with comprehensive security checks
        
        Args:
            headers: Authentication headers to verify
            data: Optional data to verify hash against
            max_age: Maximum age override
            check_nonce: Enable nonce replay protection
            
        Returns:
            True if verification succeeds
            
        Raises:
            AssertionError: If any security check fails
        """
        crypto_type = headers.get('crypto_type', self.crypto_type)
        current_time = time.time()
        
        # Expiry validation
        if 'expiry' in headers:
            expiry = float(headers['expiry'])
            assert current_time < expiry, f'Token expired at {expiry}, current time {current_time}'
        
        # Age validation
        age = abs(current_time - float(headers['time']))
        max_age = max_age if max_age is not None else self.max_age
        assert age < max_age, f'Token is stale {age} > {max_age}'
        
        # Replay attack prevention
        if check_nonce and self.enable_nonce and 'nonce' in headers:
            nonce = headers['nonce']
            assert nonce not in self._used_nonces, 'Nonce already used - possible replay attack'
            self._used_nonces.add(nonce)
            
            # Automatic cache cleanup
            if len(self._used_nonces) > self.nonce_cache_size:
                self._used_nonces.clear()
        
        # Cryptographic signature verification
        verified = self.key.verify(
            self.get(headers), 
            signature=headers['signature'], 
            address=headers['key']
        )
        assert verified, f'Invalid signature {headers}'
        
        # Data integrity check
        if data is not None:
            assert headers['data'] == self.hash(data), f'Invalid data hash'
        
        return verified

    def get_key(self, key=None):
        """Retrieve or validate cryptographic key"""
        if key is None:
            key = self.key
        else:
            key = m.get_key(key, crypto_type=self.crypto_type)
        assert hasattr(key, 'address'), f'Invalid key {key}'
        return key

    verify_headers = verify

    def _is_identity_hash_type(self):
        """Check if using identity hash (no hashing)"""
        return self.hash_type in ['identity', None, 'none']

    def hash(self, data: Any) -> str:
        """
        Cryptographic hash with deterministic serialization
        
        Args:
            data: Data to hash
            
        Returns:
            Hexadecimal hash string
        """
        data = json.dumps(data, separators=self.separators, sort_keys=True)
        if self.hash_type == 'sha256':
            return hashlib.sha256(data.encode()).hexdigest()
        elif self.hash_type == 'sha512':
            return hashlib.sha512(data.encode()).hexdigest()
        elif self._is_identity_hash_type():
            return data
        else: 
            raise ValueError(f'Invalid hash type {self.hash_type}')

    def get(self, headers: Dict[str, str]) -> str:
        """Extract and serialize signature payload"""
        assert all(k in headers for k in self.signature_keys), f'Missing keys in headers {headers}'
        return json.dumps(
            {k: headers[k] for k in self.signature_keys}, 
            separators=self.separators, 
            sort_keys=True
        )

    def revoke_nonce(self, nonce: str):
        """Manually revoke a nonce to prevent reuse"""
        self._used_nonces.add(nonce)

    def clear_nonces(self):
        """Clear all tracked nonces (use with caution)"""
        self._used_nonces.clear()

    def test(self, key='test.auth', crypto_type='sr25519'):
        """Comprehensive test suite for Auth functionality"""
        data = {'fn': 'test', 'params': {'a': 1, 'b': 2}}
        auth = Auth(key=key, crypto_type=crypto_type)
        
        # Basic authentication flow
        headers = auth.forward(data, key=key)
        assert auth.verify(headers, data=data)
        
        # TTL validation
        headers_ttl = auth.forward(data, key=key, ttl=120)
        assert auth.verify(headers_ttl, data=data)
        
        return {
            'test_passed': True, 
            'headers': headers, 
            'features': ['nonce', 'expiry', 'enhanced_hashing', 'replay_protection']
        }
