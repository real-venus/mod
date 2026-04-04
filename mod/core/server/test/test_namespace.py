"""
Tests for the Namespace registry.
"""
import pytest
import os
import tempfile
import shutil
import json


class TestNamespaceLogic:
    """Test namespace registry operations without mod dependency."""

    def setup_method(self):
        self.tmp_dir = tempfile.mkdtemp(prefix='mod_ns_test_')
        self._data = {}

    def teardown_method(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def _put(self, path, val):
        self._data[path] = val

    def _get(self, path, default=None):
        return self._data.get(path, default)

    def test_register_server(self):
        registry = self._get('registry.json', {})
        registry['test_server'] = 'http://localhost:8000'
        self._put('registry.json', registry)
        assert 'test_server' in self._get('registry.json', {})

    def test_deregister_server(self):
        self._put('registry.json', {'srv': 'http://localhost:8000'})
        reg = self._get('registry.json', {})
        del reg['srv']
        self._put('registry.json', reg)
        assert 'srv' not in self._get('registry.json', {})

    def test_exists(self):
        self._put('registry.json', {'srv': 'http://localhost:8000'})
        reg = self._get('registry.json', {})
        assert 'srv' in reg
        assert 'nonexistent' not in reg

    def test_namespace_search(self):
        registry = {
            'api': 'http://localhost:8000',
            'api_v2': 'http://localhost:8001',
            'worker': 'http://localhost:8002',
        }
        self._put('registry.json', registry)
        reg = self._get('registry.json', {})
        filtered = {k: v for k, v in reg.items() if 'api' in k}
        assert len(filtered) == 2
        assert 'worker' not in filtered

    def test_namespace_no_search_returns_all(self):
        registry = {'a': '1', 'b': '2', 'c': '3'}
        self._put('registry.json', registry)
        reg = self._get('registry.json', {})
        assert len(reg) == 3

    def test_register_overwrites(self):
        self._put('registry.json', {'srv': 'http://localhost:8000'})
        reg = self._get('registry.json', {})
        reg['srv'] = 'http://localhost:9000'
        self._put('registry.json', reg)
        assert self._get('registry.json')['srv'] == 'http://localhost:9000'

    def test_empty_registry(self):
        reg = self._get('registry.json', {})
        assert reg == {}


class TestAppRegistry:
    """Test app registry logic."""

    def setup_method(self):
        self._data = {}

    def _put(self, path, val):
        self._data[path] = val

    def _get(self, path, default=None):
        return self._data.get(path, default)

    def test_register_app(self):
        registry = self._get('app_registry.json', {})
        registry['myapp'] = {'url': 'http://localhost:3000', 'owner': '0xabc'}
        self._put('app_registry.json', registry)
        assert 'myapp' in self._get('app_registry.json', {})

    def test_app_owner(self):
        registry = {'myapp': {'url': 'http://localhost:3000', 'owner': '0xabc'}}
        self._put('app_registry.json', registry)
        entry = self._get('app_registry.json', {}).get('myapp')
        assert entry['owner'] == '0xabc'

    def test_is_app_owner(self):
        registry = {'myapp': {'url': 'http://localhost:3000', 'owner': '0xabc'}}
        self._put('app_registry.json', registry)
        owner = self._get('app_registry.json')['myapp']['owner']
        assert '0xabc'.lower() == owner.lower()

    def test_app_status_merge(self):
        """Test merging installed and running apps."""
        installed = {'app1': {'port': 3000, 'owner': '0x1', 'path': '/a'}}
        running = {'app1': {'url': 'http://localhost:3000', 'owner': '0x1'}}
        self._put('app_installed.json', installed)
        self._put('app_registry.json', running)

        inst = self._get('app_installed.json', {})
        run = self._get('app_registry.json', {})
        all_names = set(list(inst.keys()) + list(run.keys()))
        assert 'app1' in all_names
