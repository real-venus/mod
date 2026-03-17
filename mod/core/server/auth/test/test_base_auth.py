import json
import time
import hashlib
import pytest
import mod as m

from mod.core.server.auth.auth.oath.auth import Auth as BaseAuth


@pytest.fixture
def auth():
    return BaseAuth(key='test.base_auth', crypto_type='sr25519')


@pytest.fixture
def sample_data():
    return {'fn': 'test', 'params': {'a': 1, 'b': 2}}


class TestBaseAuthInit:

    def test_default_params(self):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519')
        assert auth.max_age == 60
        assert auth.hash_type == 'sha256'
        assert auth.signature_keys == ['data', 'time', 'cost']

    def test_custom_max_age(self):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519', max_age=120)
        assert auth.max_age == 120

    def test_key_has_address(self):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519')
        assert hasattr(auth.key, 'address')

    def test_auth_features_built(self):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519')
        assert 'key' in auth.auth_features
        assert 'signature' in auth.auth_features
        assert 'data' in auth.auth_features


class TestBaseAuthForward:

    def test_forward_returns_dict(self, auth, sample_data):
        result = auth.forward(sample_data)
        assert isinstance(result, dict)
        assert 'data' in result
        assert 'time' in result
        assert 'cost' in result
        assert 'key' in result
        assert 'signature' in result

    def test_data_is_hashed(self, auth, sample_data):
        result = auth.forward(sample_data)
        expected_hash = auth.hash(sample_data)
        assert result['data'] == expected_hash

    def test_cost_defaults_to_zero(self, auth, sample_data):
        result = auth.forward(sample_data)
        assert result['cost'] == '0'

    def test_custom_cost(self, auth, sample_data):
        result = auth.forward(sample_data, cost=10)
        assert result['cost'] == '10'

    def test_aliases(self, auth):
        assert auth.headers == auth.forward
        assert auth.generate == auth.forward


class TestBaseAuthVerify:

    def test_verify_valid(self, auth, sample_data):
        headers = auth.forward(sample_data)
        assert auth.verify(headers) is True

    def test_verify_with_data(self, auth, sample_data):
        headers = auth.forward(sample_data)
        assert auth.verify(headers, data=sample_data) is True

    def test_verify_wrong_data(self, auth, sample_data):
        headers = auth.forward(sample_data)
        with pytest.raises(AssertionError, match='Data integrity'):
            auth.verify(headers, data={'wrong': 'data'})

    def test_verify_stale_token(self, sample_data):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519', max_age=0)
        headers = auth.forward(sample_data)
        time.sleep(0.01)
        with pytest.raises(AssertionError, match='expired'):
            auth.verify(headers)

    def test_verify_custom_max_age_override(self, auth, sample_data):
        headers = auth.forward(sample_data)
        # should pass with large max_age
        assert auth.verify(headers, max_age=9999) is True


class TestBaseAuthHash:

    def test_sha256_hash(self, auth):
        data = {'a': 1}
        json_str = json.dumps(data, separators=(',', ':'))
        expected = hashlib.sha256(json_str.encode()).hexdigest()
        assert auth.hash(data) == expected

    def test_identity_hash(self):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519', hash_type='identity')
        data = {'a': 1}
        result = auth.hash(data)
        assert result == json.dumps(data, separators=(',', ':'))

    def test_invalid_hash_type(self):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519', hash_type='md5')
        with pytest.raises(ValueError, match='Unsupported hash type'):
            auth.hash({'a': 1})


class TestBaseAuthGet:

    def test_extracts_signature_keys(self, auth):
        headers = {'data': 'hash', 'time': '123', 'cost': '0', 'key': 'addr', 'signature': 'sig'}
        result = json.loads(auth.get(headers))
        assert 'data' in result
        assert 'time' in result
        assert 'cost' in result
        assert 'key' not in result
        assert 'signature' not in result

    def test_missing_key_raises(self, auth):
        with pytest.raises(AssertionError):
            auth.get({'data': 'hash'})  # missing time and cost


class TestBaseAuthGetKey:

    def test_returns_default(self, auth):
        assert auth.get_key() == auth.key

    def test_has_address(self, auth):
        assert hasattr(auth.get_key(), 'address')


class TestBaseAuthEndToEnd:

    def test_builtin_test(self):
        auth = BaseAuth(key='test.base_auth', crypto_type='sr25519')
        result = auth.test()
        assert result['test_passed'] is True

    def test_full_flow(self):
        auth = BaseAuth(key='test.e2e', crypto_type='sr25519')
        data = {'action': 'deploy', 'module': 'test'}
        headers = auth.generate(data)
        assert auth.verify(headers, data=data) is True
