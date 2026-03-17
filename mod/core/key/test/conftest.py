import sys
import os
import pytest

# Add the mod framework root to path so 'core.key' resolves
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from core.key import Key


@pytest.fixture
def key_factory():
    """Factory fixture to create Key instances by crypto type."""
    def _create(crypto_type='ecdsa'):
        return Key(crypto_type=crypto_type)
    return _create


@pytest.fixture
def cleanup_keys():
    """Fixture that tracks and cleans up test keys after tests."""
    created = []
    key = Key()

    def _track(name):
        created.append(name)
        return name

    yield _track

    for name in created:
        try:
            if key.key_exists(name):
                key.rm_key(name)
        except Exception:
            pass
