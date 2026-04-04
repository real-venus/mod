"""Fixtures for registry tests."""
import os
import sys
import pytest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))))


@pytest.fixture
def mock_store():
    store = MagicMock()
    store.put.return_value = 'cid_abc123'
    store.get.return_value = {}
    return store


@pytest.fixture
def mock_key():
    key = MagicMock()
    key.address = '0xdeadbeef'
    key.valid_ss58_address.return_value = False
    return key
