"""Tests for Cli class — parsing and routing utilities."""
import pytest
from mod.core.cli.cli import Cli


class TestStr2Python:
    """Test the str2python type-coercion helper."""

    @pytest.fixture
    def cli(self, monkeypatch):
        monkeypatch.setattr('sys.argv', ['cli', 'mod/go'])
        return Cli.__new__(Cli)

    def test_int(self, cli):
        assert cli.str2python('42') == 42

    def test_float(self, cli):
        assert cli.str2python('3.14') == 3.14

    def test_bool_true(self, cli):
        assert cli.str2python('true') is True
        assert cli.str2python('True') is True

    def test_bool_false(self, cli):
        assert cli.str2python('false') is False

    def test_none_variants(self, cli):
        assert cli.str2python('None') is None
        assert cli.str2python('null') is None

    def test_list(self, cli):
        assert cli.str2python('[1,2,3]') == [1, 2, 3]

    def test_empty_list(self, cli):
        assert cli.str2python('[]') == []

    def test_dict(self, cli):
        result = cli.str2python('{a:1}')
        assert result == {'a': 1}

    def test_empty_dict(self, cli):
        assert cli.str2python('{}') == {}

    def test_plain_string(self, cli):
        assert cli.str2python('hello') == 'hello'


class TestGetParams:
    """Test argv parsing into args/kwargs."""

    @pytest.fixture
    def cli(self, monkeypatch):
        monkeypatch.setattr('sys.argv', ['cli'])
        c = Cli.__new__(Cli)
        return c

    def test_positional_args(self, cli):
        cli.argv = ['hello', '42']
        params = cli.get_params()
        assert params['args'] == ['hello', 42]
        assert params['kwargs'] == {}

    def test_kwargs(self, cli):
        cli.argv = ['key=value', 'num=5']
        params = cli.get_params()
        assert params['kwargs']['key'] == 'value'
        assert params['kwargs']['num'] == 5

    def test_empty_argv(self, cli):
        cli.argv = []
        params = cli.get_params()
        assert params == {'args': [], 'kwargs': {}}


class TestGetInitParams:
    """Test --key=value init param extraction."""

    @pytest.fixture
    def cli(self, monkeypatch):
        monkeypatch.setattr('sys.argv', ['cli'])
        c = Cli.__new__(Cli)
        return c

    def test_double_dash_params(self, cli):
        cli.argv = ['--key=mod', 'arg1']
        result = cli.get_init_params()
        assert result == {'key': 'mod'}
        assert cli.argv == ['arg1']

    def test_no_init_params(self, cli):
        cli.argv = ['arg1', 'arg2']
        result = cli.get_init_params()
        assert result == {}


class TestHelpers:
    @pytest.fixture
    def cli(self, monkeypatch):
        monkeypatch.setattr('sys.argv', ['cli'])
        return Cli.__new__(Cli)

    def test_shorten_short_string(self, cli):
        assert cli.shorten('hello') == 'hello'

    def test_shorten_long_string(self, cli):
        long = 'a' * 100
        result = cli.shorten(long, n=5)
        assert len(result) < 100
        assert '...' in result

    def test_is_generator_string_false(self, cli):
        assert cli.is_generator('nonexistent') is False
