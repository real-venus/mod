import pytest
import json
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock


@pytest.fixture
def tmp_store(tmp_path):
    """Provide a temp directory for the proton store."""
    return tmp_path


@pytest.fixture
def mock_mod():
    """Mock the mod framework's put/get."""
    store = {}

    def mock_put(key, value, password=None):
        store[key] = value

    def mock_get(key, password=None, **kwargs):
        return store.get(key)

    with patch('proton.mod.m') as m_mock:
        m_mock.put = MagicMock(side_effect=mock_put)
        m_mock.get = MagicMock(side_effect=mock_get)
        m_mock._store = store
        yield m_mock


@pytest.fixture
def proton(mock_mod, tmp_store):
    """Create a Mod instance with mocked storage."""
    from proton.mod import Mod
    instance = Mod()
    instance.store_path = tmp_store
    instance.accounts_file = tmp_store / 'accounts.json'
    instance.shares_file = tmp_store / 'shares.json'
    return instance
