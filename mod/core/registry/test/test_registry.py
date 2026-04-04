"""Tests for Registry — module registration and lookup."""
import os
import json
import tempfile
import shutil
import pytest
from unittest.mock import MagicMock, patch
from mod.core.registry.registry import Registry


class TestRegistryKeyAddress:
    def test_key_address_with_string_name(self):
        reg = Registry.__new__(Registry)
        reg.key = MagicMock()
        reg.key.valid_ss58_address.return_value = False
        mock_key = MagicMock()
        mock_key.address = '0xabc123'
        with patch('mod.core.registry.registry.m.key', return_value=mock_key):
            result = reg.key_address('mykey')
        assert result == '0xabc123'

    def test_key_address_with_valid_ss58(self):
        reg = Registry.__new__(Registry)
        reg.key = MagicMock()
        reg.key.valid_ss58_address.return_value = True
        result = reg.key_address('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')
        assert result == '5grwvaef5zxb26fz9rcqpdws57cterhpnehxcpcnohgkutqy'


class TestRegistryHelpers:
    def test_path(self):
        reg = Registry.__new__(Registry)
        reg.folder_path = '/tmp/test_api'
        assert reg.path('registry.json') == '/tmp/test_api/registry.json'

    def test_put_delegates_to_store(self):
        reg = Registry.__new__(Registry)
        reg.store = MagicMock()
        reg.store.put.return_value = 'cid_123'
        result = reg.put({'data': 1})
        reg.store.put.assert_called_once_with({'data': 1})
        assert result == 'cid_123'

    def test_get_delegates_to_store(self):
        reg = Registry.__new__(Registry)
        reg.store = MagicMock()
        reg.store.get.return_value = {'data': 1}
        result = reg.get('cid_123')
        reg.store.get.assert_called_once_with('cid_123')
        assert result == {'data': 1}


class TestRegistryExists:
    def test_exists_true(self):
        reg = Registry.__new__(Registry)
        reg.key = MagicMock()
        reg.key.valid_ss58_address.return_value = False
        mock_key = MagicMock()
        mock_key.address = '0xowner'
        with patch('mod.core.registry.registry.m.key', return_value=mock_key), \
             patch('mod.core.registry.registry.m.get', return_value={'0xowner': {'store': 'cid1'}}):
            reg.registry_path = '/tmp/registry.json'
            assert reg.exists(mod='store', key='owner') is True

    def test_exists_false(self):
        reg = Registry.__new__(Registry)
        reg.key = MagicMock()
        reg.key.valid_ss58_address.return_value = False
        mock_key = MagicMock()
        mock_key.address = '0xowner'
        with patch('mod.core.registry.registry.m.key', return_value=mock_key), \
             patch('mod.core.registry.registry.m.get', return_value={}):
            reg.registry_path = '/tmp/registry.json'
            assert reg.exists(mod='store', key='owner') is False
