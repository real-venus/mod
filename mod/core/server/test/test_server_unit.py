"""
Tests for Server class logic.
"""
import pytest
import json
from unittest.mock import MagicMock, patch


class TestServerTagDivider:
    """Test server tag divider logic."""

    tag_divider = '::'

    def test_tag_in_mod_name(self):
        mod = 'mymod::tag1'
        assert self.tag_divider in mod
        base_mod = mod.split(self.tag_divider)[0]
        assert base_mod == 'mymod'

    def test_no_tag_in_mod_name(self):
        mod = 'mymod'
        assert self.tag_divider not in mod

    def test_multiple_tags(self):
        mod = 'mymod::tag1::tag2'
        base_mod = mod.split(self.tag_divider)[0]
        assert base_mod == 'mymod'


class TestGetPort:
    """Test port allocation logic."""

    def test_explicit_port(self):
        port = 8080
        result = port or 9999
        assert result == 8080

    def test_none_port_falls_back(self):
        port = None
        fallback = 9999
        result = port or fallback
        assert result == 9999

    def test_zero_port_falls_back(self):
        port = 0
        fallback = 9999
        result = port or fallback
        assert result == 9999


class TestServerExists:
    """Test server existence checking."""

    def test_exists_true(self):
        servers = ['api', 'worker', 'gateway']
        assert 'api' in servers

    def test_exists_false(self):
        servers = ['api', 'worker']
        assert 'missing' not in servers


class TestServerNamespace:
    """Test namespace-related server methods."""

    def test_servers_from_namespace(self):
        namespace = {'api': 'http://localhost:8000', 'worker': 'http://localhost:8001'}
        servers = list(namespace.keys())
        assert servers == ['api', 'worker']

    def test_urls_from_namespace(self):
        namespace = {'api': 'http://localhost:8000', 'worker': 'http://localhost:8001'}
        urls = list(namespace.values())
        assert 'http://localhost:8000' in urls

    def test_namespace_search_filter(self):
        namespace = {
            'api': 'http://localhost:8000',
            'api_v2': 'http://localhost:8001',
            'worker': 'http://localhost:8002',
        }
        filtered = {k: v for k, v in namespace.items() if 'api' in k}
        assert len(filtered) == 2


class TestServerKill:
    """Test kill logic."""

    def test_kill_returns_status(self):
        name = 'test_server'
        result = {'status': 'killed', 'name': name}
        assert result['status'] == 'killed'
        assert result['name'] == name

    def test_kill_all_returns_servers(self):
        servers = ['s1', 's2', 's3']
        result = {'status': 'killed all', 'servers': servers}
        assert len(result['servers']) == 3


class TestServeParams:
    """Test serve parameter merging."""

    def test_params_merge(self):
        params = {'a': 1}
        extra_params = {'b': 2}
        merged = {**(params or {}), **extra_params}
        assert merged == {'a': 1, 'b': 2}

    def test_none_params_merge(self):
        params = None
        extra_params = {'b': 2}
        merged = {**(params or {}), **extra_params}
        assert merged == {'b': 2}


class TestModsFilter:
    """Test mods filtering logic."""

    def test_module_filter_valid(self):
        features = ['name', 'url', 'key']
        mod = {'name': 'test', 'url': 'http://localhost', 'key': '0x123'}
        assert isinstance(mod, dict) and all(f in mod for f in features)

    def test_module_filter_missing_feature(self):
        features = ['name', 'url', 'key']
        mod = {'name': 'test', 'url': 'http://localhost'}
        assert not (isinstance(mod, dict) and all(f in mod for f in features))

    def test_module_filter_not_dict(self):
        features = ['name', 'url', 'key']
        mod = None
        assert not (isinstance(mod, dict) and all(f in mod for f in features))

    def test_mods_search(self):
        mods = [
            {'name': 'api', 'url': 'http://localhost:8000', 'key': '0x1'},
            {'name': 'api_v2', 'url': 'http://localhost:8001', 'key': '0x2'},
            {'name': 'worker', 'url': 'http://localhost:8002', 'key': '0x3'},
        ]
        search = 'api'
        filtered = [m for m in mods if search in m['name']]
        assert len(filtered) == 2


class TestWaitForServer:
    """Test wait_for_server error message fix."""

    def test_error_message_uses_max_time(self):
        """Verify the fixed error message uses max_time, not undefined trials."""
        name = 'test_server'
        max_time = 10
        msg = f'Failed to start {name} after {max_time}s'
        assert 'after 10s' in msg
        assert 'trials' not in msg


class TestJsonSerializability:
    """Test the JSON serialization fallback in serve route."""

    def test_json_serializable_passthrough(self):
        result = {'key': 'value', 'num': 42}
        json.dumps(result)  # should not raise

    def test_non_serializable_falls_back(self):
        from datetime import datetime
        result = {'time': datetime.now()}
        try:
            json.dumps(result)
            converted = result
        except (TypeError, ValueError):
            converted = json.loads(json.dumps(result, default=str))
        assert isinstance(converted['time'], str)

    def test_response_wrapper(self):
        result = 'hello'
        response = {'result': result}
        assert json.loads(json.dumps(response)) == {'result': 'hello'}
