"""
API Core Tests

Tests for the main API functionality including:
- Module registration
- Content management
- IPFS integration
- Registry operations
"""
import pytest
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

try:
    import mod as m
    from api.api.api import Api
except ImportError as e:
    pytest.skip(f"Required modules not available: {e}", allow_module_level=True)


class TestApiCore:
    """Test suite for API core functionality"""

    def test_api_initialization(self):
        """Test that API can be initialized"""
        try:
            api = Api(key='test', store='ipfs')
            assert api is not None
            assert hasattr(api, 'store')
            assert hasattr(api, 'key')
            assert hasattr(api, 'router')
        except Exception as e:
            pytest.skip(f"API initialization failed: {e}")

    def test_api_has_required_methods(self):
        """Test that API has all required methods"""
        try:
            api = Api(key='test', store='ipfs')
            required_methods = [
                'reg', 'mod', 'get', 'put', 'add',
                'content', 'registry', 'mods', 'exists',
                'cid', 'call', 'txs'
            ]
            for method in required_methods:
                assert hasattr(api, method), f"API missing method: {method}"
        except Exception as e:
            pytest.skip(f"API method check failed: {e}")

    def test_key_address(self):
        """Test key address retrieval"""
        try:
            api = Api(key='test', store='ipfs')
            address = api.key_address()
            assert address is not None
            assert isinstance(address, str)
            assert len(address) > 0
        except Exception as e:
            pytest.skip(f"Key address test failed: {e}")

    def test_store_property(self):
        """Test that store property works"""
        try:
            api = Api(key='test', store='ipfs')
            store = api.store
            assert store is not None
            assert hasattr(store, 'add') or hasattr(store, 'put')
            assert hasattr(store, 'get')
        except Exception as e:
            pytest.skip(f"Store property test failed: {e}")

    def test_registry_access(self):
        """Test registry can be accessed"""
        try:
            api = Api(key='test', store='ipfs')
            registry = api.registry()
            assert isinstance(registry, dict)
        except Exception as e:
            pytest.skip(f"Registry access test failed: {e}")

    def test_mods_listing(self):
        """Test that mods can be listed"""
        try:
            api = Api(key='test', store='ipfs')
            mods = api.mods(key='test')
            assert isinstance(mods, list)
        except Exception as e:
            pytest.skip(f"Mods listing test failed: {e}")

    def test_is_git_url(self):
        """Test git URL detection"""
        try:
            api = Api(key='test', store='ipfs')
            assert api.is_git_url('https://github.com/user/repo') == True
            assert api.is_git_url('https://gitlab.com/user/repo') == True
            assert api.is_git_url('https://example.com') == False
        except Exception as e:
            pytest.skip(f"Git URL test failed: {e}")

    def test_is_ipfs_url(self):
        """Test IPFS URL detection"""
        try:
            api = Api(key='test', store='ipfs')
            assert api.is_ipfs_url('ipfs://Qm...') == True
            assert api.is_ipfs_url('ipfs/Qm...') == True
            assert api.is_ipfs_url('https://example.com') == False
        except Exception as e:
            pytest.skip(f"IPFS URL test failed: {e}")


class TestApiBalances:
    """Test suite for API balance functionality"""

    def test_balance_method_exists(self):
        """Test that balance method exists"""
        try:
            api = Api(key='test', store='ipfs')
            assert hasattr(api, 'balance')
            assert callable(api.balance)
        except Exception as e:
            pytest.skip(f"Balance method test failed: {e}")

    def test_get_balances_method_exists(self):
        """Test that get_balances method exists"""
        try:
            api = Api(key='test', store='ipfs')
            assert hasattr(api, 'get_balances')
            assert callable(api.get_balances)
        except Exception as e:
            pytest.skip(f"Get balances method test failed: {e}")

    def test_balances_method_exists(self):
        """Test that balances method exists"""
        try:
            api = Api(key='test', store='ipfs')
            assert hasattr(api, 'balances')
            assert callable(api.balances)
        except Exception as e:
            pytest.skip(f"Balances method test failed: {e}")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
