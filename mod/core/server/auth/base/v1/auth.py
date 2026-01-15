import base64
import hmac
import json
import time
from typing import Dict, Optional, Any
import mod as m
import hashlib

class Auth:

    features = ['data', 'time', 'key', 'signature']
    max_age=3600

    def __init__(self, 
                key=None, 
                crypto_type='ecdsa' ):
        
        """

        Initialize the Auth class
        :param key: the key to use for signing
        :param crypto_type: the crypto type to use for signing
        :param signature_keys: the keys to use for signing 
        """
        self.set_key(key=key, crypto_type=crypto_type)

    def set_key(self, key, crypto_type=None):
        """
        Set the key to use for signing
        """
        self.key = m.key(key=key, crypto_type=crypto_type)
        self.crypto_type = crypto_type or self.key.crypto_type_name

    def token(self,  data: dict = {},  key=None, owner=None, cost=0) -> dict:
        """
        Generate the headers with the JWT token
        """
        key = self.get_key(key)
        result = {
            'data': self.encode_data(data),
            'time': str(time.time()),
            'owner': owner or m.owner(),
            'cost':  str(cost),
            'key': key.address,
        }
        result['signature'] = key.sign(self.sig_data(result), mode='str')

        return self.result2token(result)

    concat_features = ['time', 'cost', 'owner', 'data','key', 'signature' ]
    sig_features = concat_features[:-1]


    def encode_data(self, data: dict) -> str:
        """Encode data dictionary into a base64url string"""
        json_data = json.dumps(data, separators=(',', ':'))
        return self._base64url_encode(json_data)

    def decode_data(self, data_str: str) -> dict:
        """Decode base64url string back into a data dictionary"""
        json_data = self._base64url_decode(data_str).decode('utf-8')
        return json.loads(json_data)

    def result2token(self, result: dict) -> dict:
        token_data =  '.'.join([ str(result[k]) for k in self.concat_features])
        return token_data

    def token2result(self, token: str) -> dict:
        parts = token.split('.')
        result = {}
        for i, k in enumerate(self.concat_features):
            result[k] = parts[i]
        return result
        


    def headers(self, data: dict, key=None) -> dict:
        return {'token': self.token(data=data, key=key)}

    generate = forward = headers

    def verify(self, token: str) -> dict:
        """
        Verify and decode a JWT token
        provide the data if you want to verify the data hash
        """
        if isinstance(token, dict) and 'token' in token:
            token = token['token']
        headers = self.token2result(token)
        signature = headers['signature']
        age = abs(time.time() - float(headers['time']))
        assert age < self.max_age, f'Token is stale {age} > {self.max_age}'
        sigdata = self.sig_data(headers)
        print(sigdata)
        verified = self.key.verify(sigdata, signature=headers['signature'], address=headers['key'])
        assert verified, f'Invalid signature {headers} sigdatahash: {self.hash(sigdata)}'
        return headers

    def get_key(self, key=None):
        """
        Get the key to use for signing
        """
        if key is None:
            key = self.key
        else:
            key = m.key(key, crypto_type=self.crypto_type)
        assert hasattr(key, 'address'), f'Invalid key {key}'
        return key

    def hash(self, data: Any) -> str:
        """
        Hash the data using sha256
        """
        if isinstance(data, dict):
            data = json.dumps(data, separators=(',', ':'))
        if isinstance(data, str):
            data = data.encode('utf-8')

        return hashlib.sha256(data).hexdigest() 

    def sig_data(self, headers: Dict[str, str]) -> str:
        """
        get the signature data from the headers
        """
        sig_data =  m.hash(json.dumps({k: headers[k] for k in self.sig_features}, separators=(',', ':')))
        print(f'sig_data: {sig_data}')
        return sig_data

    def test(self, key='test.auth', crypto_type='ecdsa'):
        data = {'fn': 'test', 'params': {'a': 1, 'b': 2}}
        auth = Auth(key=key, crypto_type=crypto_type)
        token = auth.token(data, key=key)
        assert auth.verify(token), 'Auth test failed'
        return {'test_passed': True, 'headers': headers,  'data': data, }

    def _base64url_encode(self, data):
        """Encode data in base64url format"""
        if isinstance(data, str):
            data = data.encode('utf-8')
        elif isinstance(data, dict):
            data = json.dumps(data, separators=(',', ':')).encode('utf-8')
        encoded = base64.urlsafe_b64encode(data).rstrip(b'=')
        return encoded.decode('utf-8')
    
    def _base64url_decode(self, data):
        """Decode base64url data"""
        padding = b'=' * (4 - (len(data) % 4))
        return base64.urlsafe_b64decode(data.encode('utf-8') + padding)


