"""Tests for Config class."""
from mod.core.config.config import Config


class TestConfigBasics:
    def test_create_empty(self):
        c = Config()
        assert len(c) == 0

    def test_create_with_data(self):
        c = Config(a=1, b='hello')
        assert c['a'] == 1
        assert c['b'] == 'hello'

    def test_attribute_access(self):
        c = Config(x=42)
        assert c.x == 42

    def test_attribute_set(self):
        c = Config()
        c.y = 99
        assert c['y'] == 99
        assert c.y == 99

    def test_attribute_delete(self):
        c = Config(z=1)
        del c.z
        assert 'z' not in c

    def test_missing_attribute_raises(self):
        c = Config()
        import pytest
        with pytest.raises(AttributeError):
            _ = c.nonexistent

    def test_missing_delete_raises(self):
        c = Config()
        import pytest
        with pytest.raises(AttributeError):
            del c.nonexistent


class TestConfigRepr:
    def test_str_leaves(self):
        c = Config(a=1, b=2)
        s = str(c)
        assert 'a' in s
        assert '1' in s

    def test_str_nested(self):
        c = Config(top=1, sub=Config(inner=2))
        s = str(c)
        assert 'inner' in s
        assert '2' in s

    def test_str_nested_plain_dict(self):
        c = Config(sub={'k': 'v'})
        s = str(c)
        assert 'k' in s
        assert 'v' in s


class TestConfigFromDict:
    def test_from_dict_flat(self):
        c = Config.from_dict({'a': 1, 'b': 2})
        assert isinstance(c, Config)
        assert c.a == 1

    def test_from_dict_nested(self):
        c = Config.from_dict({'outer': {'inner': 42}})
        assert isinstance(c.outer, Config)
        assert c.outer.inner == 42

    def test_from_dict_list(self):
        c = Config.from_dict({'entries': [{'x': 1}, {'x': 2}]})
        assert isinstance(c.entries[0], Config)
        assert c.entries[1].x == 2

    def test_from_dict_primitive(self):
        assert Config.from_dict(42) == 42
        assert Config.from_dict('hello') == 'hello'


class TestConfigToDict:
    def test_to_dict_flat(self):
        c = Config(a=1, b=2)
        d = c.to_dict()
        assert isinstance(d, dict)
        assert not isinstance(d, Config)
        assert d == {'a': 1, 'b': 2}

    def test_to_dict_nested(self):
        c = Config.from_dict({'outer': {'inner': 42}})
        d = c.to_dict()
        assert isinstance(d['outer'], dict)
        assert not isinstance(d['outer'], Config)

    def test_to_dict_list(self):
        c = Config.from_dict({'items': [{'x': 1}]})
        d = c.to_dict()
        assert isinstance(d['items'][0], dict)
        assert not isinstance(d['items'][0], Config)


class TestConfigCopyUpdate:
    def test_copy(self):
        c = Config(a=1)
        c2 = c.copy()
        c2.a = 99
        assert c.a == 1

    def test_update(self):
        c = Config(a=1)
        c.update(b=2)
        assert c.b == 2
        assert c.a == 1

    def test_update_nested(self):
        c = Config(a=1)
        c.update(sub={'x': 1})
        assert isinstance(c.sub, Config)
        assert c.sub.x == 1
