"""
Shared fixtures for server test suite.
"""
import pytest
import os
import sys
import json
import tempfile
import shutil
import threading
import time
from unittest.mock import MagicMock, patch


@pytest.fixture
def tmp_dir():
    """Provide a temporary directory, cleaned up after test."""
    d = tempfile.mkdtemp(prefix='mod_test_')
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def mock_store(tmp_dir):
    """Mock store that uses filesystem in tmp_dir."""
    store = MagicMock()
    _data = {}

    def put(path, value):
        _data[path] = value

    def get(path, default=None, **kwargs):
        return _data.get(path, default)

    def rm(path):
        _data.pop(path, None)

    def get_path(name):
        p = os.path.join(tmp_dir, name)
        os.makedirs(p, exist_ok=True)
        return p

    store.put = put
    store.get = get
    store.rm = rm
    store.get_path = get_path
    store._data = _data
    return store


@pytest.fixture
def mock_mod():
    """Create a mock module object with info and callable functions."""
    mod = MagicMock()
    mod.info = {
        'name': 'test_mod',
        'key': '0xtest',
        'fns': ['hello', 'add', 'info'],
        'url': 'http://localhost:8080',
    }
    mod.hello = MagicMock(return_value='world')
    mod.add = MagicMock(side_effect=lambda a=0, b=0: a + b)
    return mod


@pytest.fixture
def mock_auth():
    """Mock auth that passes through headers with a key."""
    auth = MagicMock()
    auth.verify = MagicMock(side_effect=lambda h: {**h, 'key': h.get('key', 'test_key')})
    return auth


@pytest.fixture
def mock_serializer():
    """Mock serializer."""
    s = MagicMock()
    s.serialize = MagicMock(side_effect=lambda x: x)
    s.deserialize = MagicMock(side_effect=lambda x: x)
    return s
