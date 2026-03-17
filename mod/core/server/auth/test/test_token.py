import json
import pytest
import mod as m

from mod.core.server.auth.auth.token.token import Token


@pytest.fixture
def token_auth():
    return Token()


class TestTokenInit:

    def test_class_attributes(self):
        t = Token()
        assert t.sig_keys == ['signature']
        assert t.token_keys == ['key', 'to', 'cost', 'time', 'data']
        assert t.tdiv == '.'


class TestTokenGeneration:

    def test_token_returns_string(self, token_auth):
        token = token_auth.token(data={'test': 1})
        assert isinstance(token, str)

    def test_token_has_correct_parts(self, token_auth):
        token = token_auth.token(data={'test': 1})
        parts = token.split('.')
        expected_parts = len(token_auth.token_keys) + len(token_auth.sig_keys)
        assert len(parts) == expected_parts


class TestToken2Data:

    def test_decode_token(self, token_auth):
        token = token_auth.token(data={'test': 1})
        result = token_auth.token2data(token)
        assert 'key' in result
        assert 'to' in result
        assert 'cost' in result
        assert 'time' in result
        assert 'data' in result
        assert 'signature' in result

    def test_cost_is_float(self, token_auth):
        token = token_auth.token(data={'test': 1}, cost=5)
        result = token_auth.token2data(token)
        assert isinstance(result['cost'], float)

    def test_time_is_int(self, token_auth):
        token = token_auth.token(data={'test': 1})
        result = token_auth.token2data(token)
        assert isinstance(result['time'], int)


class TestTokenVerify:

    def test_verify_valid_token(self, token_auth):
        token = token_auth.token(data={'test': 1})
        result = token_auth.verify(token)
        assert result is not None
        assert 'token' in result

    def test_verify_with_cost(self, token_auth):
        token = token_auth.token(data={'test': 1}, cost=10)
        result = token_auth.verify(token)
        assert result['cost'] == 10.0


class TestTokenEndToEnd:

    def test_builtin_test(self):
        t = Token()
        result = t.test(data={'hello': 'world'})
        assert 'token' in result
        assert 'verify_token' in result
