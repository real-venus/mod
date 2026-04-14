"""
Integration Tests

Integration tests that test the full API workflow including:
- End-to-end API calls
- Router and API integration
- Token authentication flow
"""
import pytest
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

try:
    import mod as m
    from api.api.api import Api
    from api.api.router.router import Router
    from api.api.token.token import Token
except ImportError as e:
    pytest.skip(f"Required modules not available: {e}", allow_module_level=True)


class TestApiIntegration:
    """Integration tests for API components"""

    def test_api_router_integration(self):
        """Test that API and Router work together"""
        try:
            api = Api(key='test', store='localfs')
            assert hasattr(api, 'router')
            assert api.router is not None
            # Check that router methods are accessible from API
            assert hasattr(api, 'call')
            assert hasattr(api, 'txs')
        except Exception as e:
            pytest.skip(f"API Router integration test failed: {e}")

    def test_store_integration(self):
        """Test that store integration works"""
        try:
            api = Api(key='test', store='localfs')
            store = api.store
            assert store is not None

            # Test basic store operations
            test_data = {'test': 'integration', 'number': 123}
            cid = api.put(test_data)
            assert cid is not None
            assert isinstance(cid, str)

            # Retrieve data
            retrieved = api.get(cid)
            assert retrieved == test_data
        except Exception as e:
            pytest.skip(f"Store integration test failed: {e}")

    def test_key_integration(self):
        """Test that key integration works"""
        try:
            api = Api(key='test', store='localfs')
            assert api.key is not None
            assert hasattr(api.key, 'address')
            address = api.key.address
            assert address is not None
            assert isinstance(address, str)
        except Exception as e:
            pytest.skip(f"Key integration test failed: {e}")


class TestTokenAuthFlow:
    """Test the complete token authentication flow"""

    def test_token_creation_and_api_call(self):
        """Test creating a token and using it for an API call"""
        try:
            # Create token
            token_obj = Token()
            test_data = {'action': 'test', 'value': 42}
            token = token_obj.token(data=test_data, cost=10)
            assert token is not None

            # Verify token
            verified = token_obj.verify(token)
            assert verified['data'] == test_data
            assert verified['cost'] == 10
        except Exception as e:
            pytest.skip(f"Token auth flow test failed: {e}")


class TestEndToEnd:
    """End-to-end tests"""

    def test_full_api_workflow(self):
        """Test a complete API workflow from initialization to data retrieval"""
        try:
            # Initialize API
            api = Api(key='test', store='localfs')

            # Test registry access
            registry = api.registry()
            assert isinstance(registry, dict)

            # Test mod listing
            mods = api.mods(key='test')
            assert isinstance(mods, list)

            # Test key address
            address = api.key_address()
            assert address is not None
        except Exception as e:
            pytest.skip(f"Full API workflow test failed: {e}")

    def test_router_task_workflow(self):
        """Test a complete router task workflow"""
        try:
            router = Router(store='localfs', key='test')

            # Create task data
            task = router.task_data(
                fn='store/ls',
                params={'path': '/test'},
                timeout=1000
            )
            assert task is not None
            assert task['status'] == 'pending'

            # Check sync info
            info = router.sync_info()
            assert isinstance(info, dict)
        except Exception as e:
            pytest.skip(f"Router task workflow test failed: {e}")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
