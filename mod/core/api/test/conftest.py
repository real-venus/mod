"""
Pytest configuration and fixtures for API tests
"""
import pytest
import sys
import os
from pathlib import Path

# Add the parent directory to path so we can import mod
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

try:
    import mod as m
except ImportError:
    pytest.skip("mod module not available", allow_module_level=True)


@pytest.fixture(scope="session")
def test_key():
    """Fixture to provide a test key for authentication"""
    try:
        key = m.key('test')
        return key
    except Exception as e:
        pytest.skip(f"Could not create test key: {e}")


@pytest.fixture(scope="session")
def api_instance():
    """Fixture to provide an API instance for testing"""
    try:
        from api.api.api import Api
        api = Api(key='test', store='localfs')
        return api
    except Exception as e:
        pytest.skip(f"Could not create API instance: {e}")


@pytest.fixture(scope="session")
def router_instance():
    """Fixture to provide a Router instance for testing"""
    try:
        from api.api.router.router import Router
        router = Router(store='localfs', key='test')
        return router
    except Exception as e:
        pytest.skip(f"Could not create Router instance: {e}")


@pytest.fixture(scope="session")
def token_instance():
    """Fixture to provide a Token instance for testing"""
    try:
        from api.api.token.token import Token
        token = Token()
        return token
    except Exception as e:
        pytest.skip(f"Could not create Token instance: {e}")


@pytest.fixture
def sample_params():
    """Fixture to provide sample parameters for testing"""
    return {
        'test_param': 'test_value',
        'number': 42,
        'nested': {
            'key': 'value'
        }
    }


@pytest.fixture
def cleanup_test_files():
    """Fixture to cleanup test files after tests"""
    test_files = []

    def add_file(filepath):
        test_files.append(filepath)

    yield add_file

    # Cleanup
    for filepath in test_files:
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except:
                pass
