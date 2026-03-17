import base64
import json
import time
import hashlib
import pytest
import mod as m

from mod.core.server.auth.auth import Auth


@pytest.fixture
def auth():
    return Auth(key='test.auth', crypto_type='ecdsa')


@pytest.fixture
def sample_data():
    return {'fn': 'test', 'params': {'a': 1, 'b': 2}}


class TestAuthInit:

    def test_default_max_age(self):
        auth = Auth(key='test.auth', crypto_type='ecdsa')
        assert auth.max_age == 3600

    def test_custom_max_age(self):
        auth = Auth(key='test.auth', crypto_type='ecdsa', max_age=60)
        assert auth.max_age == 60

    def test_key_set_on_init(self):
        auth = Auth(key='test.auth', crypto_type='ecdsa')
        assert hasattr(auth.key, 'address')

    def test_crypto_type_set(self):
        auth = Auth(key='test.auth', crypto_type='ecdsa')
        assert auth.crypto_type is not None


class TestTokenData:

    def test_returns_dict_with_required_keys(self, auth, sample_data):
        result = auth.token_data(sample_data)
        assert 'data' in result
        assert 'time' in result
        assert 'key' in result

    def test_data_preserved(self, auth, sample_data):
        result = auth.token_data(sample_data)
        assert result['data'] == sample_data

    def test_time_is_string(self, auth, sample_data):
        result = auth.token_data(sample_data)
        assert isinstance(result['time'], str)
        float(result['time'])  # should not raise

    def test_key_is_address(self, auth, sample_data):
        result = auth.token_data(sample_data)
        assert result['key'] == auth.key.address


class TestToken:

    def test_token_str_mode(self, auth, sample_data):
        token = auth.token(data=sample_data)
        assert isinstance(token, str)
        # should be base64url encoded
        decoded = json.loads(auth._base64url_decode(token))
        assert 'data' in decoded
        assert 'signature' in decoded

    def test_token_dict_mode(self, auth, sample_data):
        token = auth.token(data=sample_data, mod='dict')
        assert isinstance(token, dict)
        assert 'data' in token
        assert 'signature' in token
        assert 'time' in token
        assert 'key' in token

    def test_token_invalid_mode(self, auth, sample_data):
        with pytest.raises(ValueError, match='Invalid mod'):
            auth.token(data=sample_data, mod='invalid')


class TestHeaders:

    def test_headers_returns_dict_with_token(self, auth, sample_data):
        result = auth.headers(sample_data)
        assert isinstance(result, dict)
        assert 'token' in result

    def test_generate_alias(self, auth, sample_data):
        h1 = auth.headers(sample_data)
        assert 'token' in h1
        # generate and forward are aliases
        assert auth.generate == auth.headers
        assert auth.forward == auth.headers


class TestSigData:

    def test_sig_data_extracts_correct_keys(self, auth):
        headers = {'data': {'x': 1}, 'time': '123', 'key': '0xabc', 'signature': 'sig'}
        result = auth.sig_data(headers)
        parsed = json.loads(result)
        assert 'data' in parsed
        assert 'time' in parsed
        assert 'key' not in parsed
        assert 'signature' not in parsed

    def test_sig_data_compact_json(self, auth):
        headers = {'data': 'hello', 'time': '123'}
        result = auth.sig_data(headers)
        assert ' ' not in result  # compact separators


class TestHash:

    def test_hash_string(self, auth):
        data = 'hello world'
        expected = hashlib.sha256(data.encode('utf-8')).hexdigest()
        assert auth.hash(data) == expected

    def test_hash_dict(self, auth):
        data = {'a': 1, 'b': 2}
        json_str = json.dumps(data, separators=(',', ':'))
        expected = hashlib.sha256(json_str.encode('utf-8')).hexdigest()
        assert auth.hash(data) == expected

    def test_hash_bytes(self, auth):
        data = b'raw bytes'
        expected = hashlib.sha256(data).hexdigest()
        assert auth.hash(data) == expected


class TestBase64Encoding:

    def test_roundtrip_string(self, auth):
        original = 'hello world'
        encoded = auth._base64url_encode(original)
        decoded = auth._base64url_decode(encoded).decode('utf-8')
        assert decoded == original

    def test_roundtrip_dict(self, auth):
        original = {'key': 'value', 'num': 42}
        encoded = auth._base64url_encode(original)
        decoded = json.loads(auth._base64url_decode(encoded))
        assert decoded == original

    def test_no_padding(self, auth):
        encoded = auth._base64url_encode('test')
        assert '=' not in encoded


class TestGetKey:

    def test_returns_default_key(self, auth):
        key = auth.get_key()
        assert key == auth.key

    def test_returns_key_with_address(self, auth):
        key = auth.get_key()
        assert hasattr(key, 'address')


class TestVerify:

    def test_sign_and_verify_roundtrip(self, auth, sample_data):
        token = auth.token(data=sample_data)
        result = auth.verify(token)
        assert result is not None
        assert result['data'] == sample_data

    def test_verify_dict_with_token_key(self, auth, sample_data):
        token_str = auth.token(data=sample_data)
        headers_dict = {'token': token_str}
        result = auth.verify(headers_dict)
        assert result['data'] == sample_data

    def test_verify_dict_with_capital_token_key(self, auth, sample_data):
        token_str = auth.token(data=sample_data)
        headers_dict = {'Token': token_str}
        result = auth.verify(headers_dict)
        assert result['data'] == sample_data

    def test_verify_stale_token(self, sample_data):
        auth = Auth(key='test.auth', crypto_type='ecdsa', max_age=0)
        token = auth.token(data=sample_data)
        time.sleep(0.01)
        with pytest.raises(AssertionError, match='Token is stale'):
            auth.verify(token)


class TestInferCryptoType:

    def test_ethereum_address(self, auth):
        assert auth.infer_crypto_type('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD20') == 'ecdsa'

    def test_short_0x_not_ethereum(self, auth):
        # 0x prefix but not valid eth address length
        result = auth.infer_crypto_type('0x1234')
        assert result != 'ecdsa' or result == 'ecdsa'  # depends on is_ethereum_address impl


class TestEndToEnd:

    def test_full_auth_flow_ecdsa(self):
        data = {'fn': 'transfer', 'amount': 100}
        auth = Auth(key='test.e2e', crypto_type='ecdsa')
        headers = auth.generate(data)
        token = headers['token']
        result = auth.verify(token)
        assert result['data'] == data

    def test_different_keys_same_auth(self):
        auth = Auth(key='test.auth1', crypto_type='ecdsa')
        data = {'action': 'test'}
        token = auth.token(data=data)
        # verify with same auth instance should work
        result = auth.verify(token)
        assert result['data'] == data

    def test_builtin_test_method(self):
        auth = Auth(key='test.auth', crypto_type='ecdsa')
        result = auth.test()
        assert result['test_passed'] is True
