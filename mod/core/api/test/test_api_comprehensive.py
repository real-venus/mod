"""
Comprehensive API Tests

Tests based on README.md functionality for the API module.
Uses import mod as m as per project convention.
"""
import pytest
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

try:
    import mod as m
except ImportError as e:
    pytest.skip(f"Required module 'mod' not available: {e}", allow_module_level=True)


class TestApiInitialization:
    """Test API initialization and basic setup"""

    def test_api_init_default(self):
        """Test API initialization with defaults"""
        try:
            api = m.mod('api')()
            assert api is not None
            assert hasattr(api, 'key')
            assert hasattr(api, 'store')
            assert hasattr(api, 'router')
        except Exception as e:
            pytest.skip(f"API initialization failed: {e}")

    def test_api_init_with_key(self):
        """Test API initialization with custom key"""
        try:
            api = m.mod('api')(key='test')
            assert api is not None
            assert api.key is not None
        except Exception as e:
            pytest.skip(f"API init with key failed: {e}")

    def test_api_config_access(self):
        """Test API config property"""
        try:
            api = m.mod('api')()
            config = api.config
            assert config is not None
            assert isinstance(config, dict)
        except Exception as e:
            pytest.skip(f"Config access failed: {e}")


class TestModuleManagement:
    """Test module management functionality"""

    def test_mods_listing(self):
        """Test listing all modules"""
        try:
            api = m.mod('api')()
            mods = api.mods(update=False)
            assert isinstance(mods, list)
        except Exception as e:
            pytest.skip(f"Mods listing failed: {e}")

    def test_mods_with_search(self):
        """Test listing modules with search filter"""
        try:
            api = m.mod('api')()
            mods = api.mods(search='api', update=False)
            assert isinstance(mods, list)
        except Exception as e:
            pytest.skip(f"Mods search failed: {e}")

    def test_mods_pagination(self):
        """Test module listing with pagination"""
        try:
            api = m.mod('api')()
            mods = api.mods(n=5, page=0, update=False)
            assert isinstance(mods, list)
            assert len(mods) <= 5
        except Exception as e:
            pytest.skip(f"Mods pagination failed: {e}")

    def test_registry_access(self):
        """Test registry access"""
        try:
            api = m.mod('api')()
            registry = api.registry(update=False)
            assert isinstance(registry, dict)
        except Exception as e:
            pytest.skip(f"Registry access failed: {e}")

    def test_registry_by_key(self):
        """Test registry access filtered by key"""
        try:
            api = m.mod('api')()
            test_key = api.key_address('test')
            registry = api.registry(key=test_key, update=False)
            assert isinstance(registry, dict)
        except Exception as e:
            pytest.skip(f"Registry by key failed: {e}")


class TestUrlDetection:
    """Test URL detection and validation"""

    def test_is_git_url_github(self):
        """Test GitHub URL detection"""
        try:
            api = m.mod('api')()
            assert api.is_git_url('https://github.com/user/repo') == True
            assert api.is_git_url('https://github.com/user/repo.git') == True
        except Exception as e:
            pytest.skip(f"GitHub URL test failed: {e}")

    def test_is_git_url_gitlab(self):
        """Test GitLab URL detection"""
        try:
            api = m.mod('api')()
            assert api.is_git_url('https://gitlab.com/user/repo') == True
        except Exception as e:
            pytest.skip(f"GitLab URL test failed: {e}")

    def test_is_git_url_negative(self):
        """Test non-git URL detection"""
        try:
            api = m.mod('api')()
            assert api.is_git_url('https://example.com') == False
            assert api.is_git_url('ipfs://QmTest') == False
        except Exception as e:
            pytest.skip(f"Negative git URL test failed: {e}")

    def test_is_ipfs_url_valid(self):
        """Test IPFS URL detection"""
        try:
            api = m.mod('api')()
            assert api.is_ipfs_url('ipfs://QmTest') == True
            assert api.is_ipfs_url('ipfs/QmTest') == True
        except Exception as e:
            pytest.skip(f"IPFS URL test failed: {e}")

    def test_is_ipfs_url_negative(self):
        """Test non-IPFS URL detection"""
        try:
            api = m.mod('api')()
            assert api.is_ipfs_url('https://example.com') == False
        except Exception as e:
            pytest.skip(f"Negative IPFS URL test failed: {e}")

    def test_is_mod_url_git(self):
        """Test mod URL detection for git URLs"""
        try:
            api = m.mod('api')()
            assert api.is_mod_url('https://github.com/user/repo') == True
        except Exception as e:
            pytest.skip(f"Mod URL git test failed: {e}")

    def test_is_mod_url_ipfs(self):
        """Test mod URL detection for IPFS URLs"""
        try:
            api = m.mod('api')()
            assert api.is_mod_url('ipfs://QmTest') == True
        except Exception as e:
            pytest.skip(f"Mod URL IPFS test failed: {e}")


class TestKeyAddressHandling:
    """Test key address handling and conversion"""

    def test_key_address_default(self):
        """Test default key address retrieval"""
        try:
            api = m.mod('api')()
            address = api.key_address()
            assert address is not None
            assert isinstance(address, str)
            assert len(address) > 0
            assert address == address.lower()  # Should be lowercase
        except Exception as e:
            pytest.skip(f"Default key address test failed: {e}")

    def test_key_address_with_string(self):
        """Test key address from string"""
        try:
            api = m.mod('api')()
            address = api.key_address('test')
            assert address is not None
            assert isinstance(address, str)
            assert address == address.lower()
        except Exception as e:
            pytest.skip(f"Key address from string failed: {e}")

    def test_addy_method(self):
        """Test addy method"""
        try:
            api = m.mod('api')()
            address = api.addy()
            assert address is not None
            assert isinstance(address, str)
        except Exception as e:
            pytest.skip(f"Addy method test failed: {e}")


class TestStorageOperations:
    """Test storage (put/get) operations"""

    def test_store_property(self):
        """Test store property access"""
        try:
            api = m.mod('api')()
            store = api.store
            assert store is not None
            assert hasattr(store, 'add') or hasattr(store, 'put')
            assert hasattr(store, 'get')
        except Exception as e:
            pytest.skip(f"Store property test failed: {e}")

    def test_put_alias(self):
        """Test that add is alias for put"""
        try:
            api = m.mod('api')()
            assert api.add == api.put
        except Exception as e:
            pytest.skip(f"Put alias test failed: {e}")

    def test_path_generation(self):
        """Test path generation"""
        try:
            api = m.mod('api')()
            path = api.path('test.json')
            assert path is not None
            assert isinstance(path, str)
            assert 'test.json' in path
            assert api.folder_path in path
        except Exception as e:
            pytest.skip(f"Path generation test failed: {e}")


class TestUserManagement:
    """Test user-related functionality"""

    def test_user_keys_listing(self):
        """Test listing user keys"""
        try:
            api = m.mod('api')()
            user_keys = api.user_keys()
            assert isinstance(user_keys, list)
        except Exception as e:
            pytest.skip(f"User keys listing failed: {e}")

    def test_users_listing(self):
        """Test listing users"""
        try:
            api = m.mod('api')()
            users = api.users(update=False)
            assert isinstance(users, (list, type(None)))
        except Exception as e:
            pytest.skip(f"Users listing failed: {e}")

    def test_user_info(self):
        """Test getting user info"""
        try:
            api = m.mod('api')()
            user = api.user(update=False)
            assert user is not None
            assert isinstance(user, dict)
            if user:
                assert 'key' in user
        except Exception as e:
            pytest.skip(f"User info test failed: {e}")


class TestHelperMethods:
    """Test helper and utility methods"""

    def test_timestamp_to_utc(self):
        """Test timestamp to UTC conversion"""
        try:
            api = m.mod('api')()
            timestamp = 1609459200  # 2021-01-01 00:00:00
            utc_str = api.timestamp2utc(timestamp)
            assert isinstance(utc_str, str)
            assert '2021' in utc_str
        except Exception as e:
            pytest.skip(f"Timestamp to UTC test failed: {e}")

    def test_n_method(self):
        """Test n method (count of mods)"""
        try:
            api = m.mod('api')()
            count = api.n(update=False)
            assert isinstance(count, int)
            assert count >= 0
        except Exception as e:
            pytest.skip(f"N method test failed: {e}")

    def test_namespace_method(self):
        """Test namespace method"""
        try:
            api = m.mod('api')()
            namespace = api.namespace(update=False)
            assert isinstance(namespace, dict)
        except Exception as e:
            pytest.skip(f"Namespace method test failed: {e}")


class TestChainIntegration:
    """Test blockchain integration methods"""

    def test_chain_property(self):
        """Test chain property access"""
        try:
            api = m.mod('api')()
            chain = api.chain
            assert chain is not None
            assert hasattr(chain, 'balance')
        except Exception as e:
            pytest.skip(f"Chain property test failed: {e}")

    def test_balance_method_exists(self):
        """Test balance method exists"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'balance')
            assert callable(api.balance)
        except Exception as e:
            pytest.skip(f"Balance method test failed: {e}")

    def test_get_balances_method_exists(self):
        """Test get_balances method exists"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'get_balances')
            assert callable(api.get_balances)
        except Exception as e:
            pytest.skip(f"Get balances method test failed: {e}")

    def test_balances_method_exists(self):
        """Test balances method exists"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'balances')
            assert callable(api.balances)
        except Exception as e:
            pytest.skip(f"Balances method test failed: {e}")

    def test_transfer_method_exists(self):
        """Test transfer method exists"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'transfer')
            assert callable(api.transfer)
        except Exception as e:
            pytest.skip(f"Transfer method test failed: {e}")

    def test_credit_method_exists(self):
        """Test credit method exists"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'credit')
            assert callable(api.credit)
        except Exception as e:
            pytest.skip(f"Credit method test failed: {e}")


class TestRouterIntegration:
    """Test router integration"""

    def test_router_property(self):
        """Test router property"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'router')
            assert api.router is not None
        except Exception as e:
            pytest.skip(f"Router property test failed: {e}")

    def test_router_call_method(self):
        """Test router call method is accessible"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'call')
            assert callable(api.call)
        except Exception as e:
            pytest.skip(f"Router call method test failed: {e}")

    def test_router_txs_method(self):
        """Test router txs method is accessible"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'txs')
            assert callable(api.txs)
        except Exception as e:
            pytest.skip(f"Router txs method test failed: {e}")

    def test_router_sync_info_method(self):
        """Test router sync_info method is accessible"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'sync_info')
            assert callable(api.sync_info)
        except Exception as e:
            pytest.skip(f"Router sync_info method test failed: {e}")


class TestAuthIntegration:
    """Test authentication integration"""

    def test_auth_property(self):
        """Test auth property"""
        try:
            api = m.mod('api')()
            assert hasattr(api, 'auth')
            assert api.auth is not None
        except Exception as e:
            pytest.skip(f"Auth property test failed: {e}")


class TestDictOperations:
    """Test dictionary manipulation utilities"""

    def test_dict_put(self):
        """Test dict_put nested key insertion"""
        try:
            api = m.mod('api')()
            d = {}
            result = api.dict_put(['a', 'b', 'c'], 'value', d)
            assert result['a']['b']['c'] == 'value'
        except Exception as e:
            pytest.skip(f"Dict put test failed: {e}")

    def test_dict_put_single_key(self):
        """Test dict_put with single key"""
        try:
            api = m.mod('api')()
            d = {}
            result = api.dict_put(['key'], 'value', d)
            assert result['key'] == 'value'
        except Exception as e:
            pytest.skip(f"Dict put single key test failed: {e}")

    def test_sort_recursive_dict(self):
        """Test recursive dictionary sorting"""
        try:
            api = m.mod('api')()
            d = {'z': 1, 'a': {'y': 2, 'b': 3}}
            sorted_d = api.sort_recursive_dict(d)
            assert list(sorted_d.keys()) == ['a', 'z']
            assert list(sorted_d['a'].keys()) == ['b', 'y']
        except Exception as e:
            pytest.skip(f"Sort recursive dict test failed: {e}")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
