import json
import time
import pytest
import mod as m

from mod.core.server.auth.auth.jwt.jwt import AuthJWT


@pytest.fixture
def jwt():
    return AuthJWT(key='test.jwt', crypto_type='sr25519')


@pytest.fixture
def sample_data():
    return {'fn': 'test', 'params': {'a': 1, 'b': 2}}


class TestAuthJWTInit:

    def test_key_set(self):
        jwt = AuthJWT(key='test.jwt', crypto_type='sr25519')
        assert hasattr(jwt.key, 'address')

    def test_crypto_type_property(self):
        jwt = AuthJWT(key='test.jwt', crypto_type='sr25519')
        assert jwt.crypto_type == 'sr25519'


class TestJWTToken:

    def test_token_str_format(self, jwt, sample_data):
        token = jwt.token(sample_data)
        assert isinstance(token, str)
        parts = token.split('.')
        assert len(parts) == 3  # header.payload.signature

    def test_token_dict_mode(self, jwt, sample_data):
        result = jwt.token(sample_data, mode='dict')
        assert isinstance(result, dict)
        assert 'token' in result

    def test_token_invalid_mode(self, jwt, sample_data):
        with pytest.raises(ValueError):
            jwt.token(sample_data, mode='bad')

    def test_token_contains_data(self, jwt, sample_data):
        token = jwt.token(sample_data)
        data = jwt.token2data(token)
        assert data['data'] == sample_data

    def test_token_contains_iat(self, jwt, sample_data):
        token = jwt.token(sample_data)
        data = jwt.token2data(token)
        assert 'iat' in data

    def test_token_contains_exp(self, jwt, sample_data):
        token = jwt.token(sample_data)
        data = jwt.token2data(token)
        assert 'exp' in data

    def test_token_contains_iss(self, jwt, sample_data):
        token = jwt.token(sample_data)
        data = jwt.token2data(token)
        assert 'iss' in data


class TestJWTVerify:

    def test_verify_valid_token(self, jwt, sample_data):
        token = jwt.token(sample_data)
        result = jwt.verify(token)
        assert 'key' in result
        assert 'signature' in result

    def test_verify_dict_input(self, jwt, sample_data):
        token_dict = jwt.token(sample_data, mode='dict')
        result = jwt.verify(token_dict)
        assert 'key' in result

    def test_verify_expired_token(self, jwt, sample_data):
        token = jwt.token(sample_data, expiration=0)
        time.sleep(0.01)
        with pytest.raises(Exception, match='expired'):
            jwt.verify(token)


class TestJWTToken2Data:

    def test_decode_roundtrip(self, jwt, sample_data):
        token = jwt.token(sample_data)
        decoded = jwt.token2data(token)
        assert decoded['data'] == sample_data

    def test_decode_dict_input(self, jwt, sample_data):
        token_dict = jwt.token(sample_data, mode='dict')
        decoded = jwt.token2data(token_dict)
        assert decoded['data'] == sample_data


class TestJWTHeaders:

    def test_headers_alias(self, jwt, sample_data):
        assert jwt.headers == jwt.generate

    def test_headers_returns_token(self, jwt, sample_data):
        result = jwt.headers(sample_data)
        assert isinstance(result, str)
        assert len(result.split('.')) == 3


class TestJWTBase64:

    def test_roundtrip_string(self, jwt):
        original = 'test data'
        encoded = jwt._base64url_encode(original)
        decoded = jwt._base64url_decode(encoded).decode('utf-8')
        assert decoded == original

    def test_roundtrip_dict(self, jwt):
        original = {'key': 'val'}
        encoded = jwt._base64url_encode(original)
        decoded = json.loads(jwt._base64url_decode(encoded))
        assert decoded == original


class TestJWTEndToEnd:

    def test_builtin_test_token(self):
        jwt = AuthJWT(key='test.jwt', crypto_type='sr25519')
        result = jwt.test_token()
        assert result['expired_token_caught'] is True

    def test_builtin_test_token2data(self):
        jwt = AuthJWT(key='test.jwt', crypto_type='sr25519')
        result = jwt.test_token2data()
        assert result['decoded_data']['data'] == {'fam': 'fam', 'admin': 1}

    def test_builtin_test_headers(self):
        jwt = AuthJWT(key='test.jwt', crypto_type='sr25519')
        result = jwt.test_headers()
        assert 'verified' in result
