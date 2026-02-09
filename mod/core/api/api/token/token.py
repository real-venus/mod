import mod as m
import requests
import os
import json
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
import time
import glob
import datetime
import inspect
import base64


class Token:

    fns = ['token', 'token2data', 'verify_token', 'test']
    sig_keys = ['signature']
    token_keys = ['key', 'to', 'cost', 'time', 'data']
    tdiv = '.'
    def token_data(self,  data=None,  cost=0, to=None, key=None) -> Dict[str, Any]:
        token_data = {
            'to': to or m.owner(),
            'cost': cost or 0,
            'time': int(m.time('int')),
            'key': key or m.key(),
            'data': json.dumps(data)
        }
        return self.tdiv.join([str(token_data[k]) for k in self.token_keys])

    def key_address(self, key=None) -> str:
        key = key or m.key()
        return key.address
    
    def token(self,  data=None, cost=0,  to=None, signature=None,key=None) -> Dict[str, Any]:
        to = to or m.owner()
        key = key or m.key()
        key_address = self.key_address(key)
        token_data = self.token_data(data=data, cost=cost, to=to, key=key_address)
        signature = key.sign(token_data, mode='str')
        assert m.verify(token_data, signature=signature, address=to), "Signature verification failed"
        return self.tdiv.join([token_data, signature])


    def token2data(self, token: str) -> Dict[str, Any]:
        token_chunks = token.split(self.tdiv)
        assert len(token_chunks) == len(self.token_keys) + len(self.sig_keys), "Invalid token format"
        token_dict = {k: v for k, v in zip(self.token_keys + self.sig_keys, token_chunks)}
        token_dict['cost'] = float(token_dict['cost'])
        token_dict['time'] = int(token_dict['time'])
        try:
            token_dict['data'] = json.loads(token_dict['data'])
        except:
            pass
        return token_dict
        
    def verify(self, token: str) -> bool:
        token_data  = self.tdiv.join(token.split(self.tdiv)[:-(len(self.sig_keys))])
        result = self.token2data(token)
        print(f'verifying token data: {result}')
        assert m.verify(token_data, signature=result['signature'], address=result["key"])
        result['token'] = token
        return result

    def test(self, cost=0, data=None, to=None) -> bool:
        token = self.token(cost=cost, data=data, to=to)
        verify_token = self.verify(token)
        assert verify_token['cost'] == cost, "Cost mismatch in token verification"
        return {'token': token, 'verify_token': verify_token, 'token_data': self.token2data(token)}
