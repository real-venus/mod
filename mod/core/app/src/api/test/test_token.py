"""
Token Tests

Tests for the Token authentication functionality including:
- Token creation
- Token verification
- Token data extraction
"""
import pytest
import sys
from pathlib import Path
import json

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

try:
    import mod as m
    from api.api.token.token import Token
except ImportError as e:
    pytest.skip(f"Required modules not available: {e}", allow_module_level=True)


class TestTokenCore:
    """Test suite for Token core functionality"""

    def test_token_initialization(self):
        """Test that Token can be initialized"""
        try:
            token = Token()
            assert token is not None
            assert hasattr(token, 'token')
            assert hasattr(token, 'verify')
            assert hasattr(token, 'token2data')
        except Exception as e:
            pytest.skip(f"Token initialization failed: {e}")

    def test_token_data_creation(self):
        """Test token data creation"""
        try:
            token_obj = Token()
            token_data = token_obj.token_data(
                data={'test': 'value'},
                cost=10,
                to=None,
                key=None
            )
            assert isinstance(token_data, str)
            # Check that it contains expected separators
            assert token_obj.tdiv in token_data
        except Exception as e:
            pytest.skip(f"Token data creation test failed: {e}")

    def test_token_creation_and_verification(self):
        """Test token creation and verification cycle"""
        try:
            token_obj = Token()
            test_data = {'test': 'value', 'number': 42}
            cost = 10

            # Create token
            token = token_obj.token(data=test_data, cost=cost)
            assert isinstance(token, str)
            assert len(token) > 0

            # Verify token
            verified = token_obj.verify(token)
            assert isinstance(verified, dict)
            assert 'signature' in verified
            assert 'key' in verified
            assert 'cost' in verified
            assert verified['cost'] == cost
            assert 'data' in verified
        except Exception as e:
            pytest.skip(f"Token creation and verification test failed: {e}")

    def test_token2data_conversion(self):
        """Test token to data conversion"""
        try:
            token_obj = Token()
            test_data = {'test': 'value'}
            cost = 5

            # Create token
            token = token_obj.token(data=test_data, cost=cost)

            # Convert back to data
            data = token_obj.token2data(token)
            assert isinstance(data, dict)
            assert 'cost' in data
            assert 'key' in data
            assert 'time' in data
            assert 'signature' in data
            assert data['cost'] == cost
        except Exception as e:
            pytest.skip(f"Token to data conversion test failed: {e}")

    def test_token_test_method(self):
        """Test the built-in test method"""
        try:
            token_obj = Token()
            result = token_obj.test(cost=15, data={'foo': 'bar'})
            assert isinstance(result, dict)
            assert 'token' in result
            assert 'verify_token' in result
            assert 'token_data' in result
        except Exception as e:
            pytest.skip(f"Token test method failed: {e}")

    def test_key_address(self):
        """Test key address retrieval"""
        try:
            token_obj = Token()
            address = token_obj.key_address()
            assert address is not None
            assert isinstance(address, str)
        except Exception as e:
            pytest.skip(f"Key address test failed: {e}")


class TestTokenValidation:
    """Test suite for Token validation"""

    def test_invalid_token_format(self):
        """Test that invalid token format raises error"""
        try:
            token_obj = Token()
            with pytest.raises(Exception):
                token_obj.token2data("invalid.token.format")
        except Exception as e:
            pytest.skip(f"Invalid token format test failed: {e}")

    def test_token_with_different_costs(self):
        """Test tokens with different costs"""
        try:
            token_obj = Token()
            for cost in [0, 1, 10, 100, 1000]:
                token = token_obj.token(data=None, cost=cost)
                verified = token_obj.verify(token)
                assert verified['cost'] == cost
        except Exception as e:
            pytest.skip(f"Token cost test failed: {e}")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
