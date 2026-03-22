"""Tests for mod/core/utils.py — utility functions."""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from mod.core.utils import (
    length,
    path_exists,
    exists,
    import_object,
    shlex_split,
    is_success,
    is_error,
    mean,
    median,
    stdev,
    retry,
    shuffle,
    reverse_map,
    is_class,
    copy,
    echo,
)


# ─── length ──────────────────────────────────────────────────────────

class TestLength:
    def test_string(self):
        assert length('hello') == 5

    def test_bytes(self):
        assert length(b'\x00\x01\x02') == 3

    def test_empty(self):
        assert length('') == 0
        assert length(b'') == 0

    def test_unicode(self):
        assert length('abc') == 3


# ─── path_exists / exists ────────────────────────────────────────────

class TestPathExists:
    def test_existing_file(self, tmp_text_file):
        assert path_exists(tmp_text_file) is True

    def test_nonexistent(self):
        assert path_exists('/nonexistent_path_xyz') is False

    def test_exists_alias(self, tmp_text_file):
        assert exists(tmp_text_file) is True


# ─── shlex_split ─────────────────────────────────────────────────────

class TestShlexSplit:
    def test_simple(self):
        assert shlex_split('a b c') == ['a', 'b', 'c']

    def test_quoted(self):
        assert shlex_split('hello "world foo"') == ['hello', 'world foo']

    def test_single_quoted(self):
        assert shlex_split("hello 'world foo'") == ['hello', 'world foo']

    def test_empty(self):
        assert shlex_split('') == []

    def test_escaped(self):
        assert shlex_split(r'a\ b c') == ['a b', 'c']

    def test_multiple_spaces(self):
        assert shlex_split('a   b   c') == ['a', 'b', 'c']


# ─── is_success / is_error ───────────────────────────────────────────

class TestIsSuccess:
    def test_success_dict(self):
        assert is_success({'result': 'ok'}) is True

    def test_error_dict(self):
        assert is_success({'error': 'fail'}) is False

    def test_success_false(self):
        assert is_success({'success': False}) is False

    def test_non_dict(self):
        assert is_success('hello') is True
        assert is_success(42) is True

    def test_none(self):
        assert is_success(None) is True


class TestIsError:
    def test_error_true(self):
        assert is_error({'error': True}) is True

    def test_success_false(self):
        assert is_error({'success': False}) is True

    def test_no_error(self):
        assert is_error({'data': 'ok'}) is False

    def test_non_dict(self):
        assert is_error('hello') is False


# ─── mean ─────────────────────────────────────────────────────────────

class TestMean:
    def test_basic(self):
        assert mean([1, 2, 3]) == 2.0

    def test_single(self):
        assert mean([5]) == 5.0

    def test_empty(self):
        assert mean([]) == 0.0

    def test_default(self):
        result = mean()
        assert result == 5.0  # mean of 0..10

    def test_floats(self):
        assert abs(mean([1.5, 2.5]) - 2.0) < 1e-9

    def test_tuple_input(self):
        assert mean((1, 2, 3)) == 2.0


# ─── median ───────────────────────────────────────────────────────────

class TestMedian:
    def test_odd(self):
        assert median([1, 2, 3]) == 2

    def test_even(self):
        assert median([1, 2, 3, 4]) == 2.5

    def test_single(self):
        assert median([7]) == 7

    def test_unsorted(self):
        assert median([3, 1, 2]) == 2


# ─── stdev ────────────────────────────────────────────────────────────

class TestStdev:
    def test_uniform(self):
        assert stdev([5, 5, 5]) == 0.0

    def test_basic(self):
        result = stdev([0, 10])
        assert result > 0

    def test_empty(self):
        assert stdev([]) == 0.0

    def test_default(self):
        result = stdev()
        assert result > 0


# ─── retry ────────────────────────────────────────────────────────────

class TestRetry:
    def test_success_first_try(self):
        call_count = [0]
        def fn():
            call_count[0] += 1
            return 'ok'
        wrapped = retry(fn, trials=3, verbose=False)
        assert wrapped() == 'ok'
        assert call_count[0] == 1

    def test_success_after_retries(self):
        call_count = [0]
        def fn():
            call_count[0] += 1
            if call_count[0] < 3:
                raise ValueError('not yet')
            return 'ok'
        wrapped = retry(fn, trials=3, verbose=False)
        assert wrapped() == 'ok'
        assert call_count[0] == 3

    def test_all_retries_fail(self):
        def fn():
            raise RuntimeError('always fails')
        wrapped = retry(fn, trials=2, verbose=False)
        with pytest.raises(RuntimeError, match='always fails'):
            wrapped()

    def test_preserves_name(self):
        def my_func():
            pass
        wrapped = retry(my_func)
        assert wrapped.__name__ == 'my_func'


# ─── shuffle ──────────────────────────────────────────────────────────

class TestShuffle:
    def test_preserves_elements(self):
        x = [1, 2, 3, 4, 5]
        result = shuffle(x.copy())
        assert sorted(result) == [1, 2, 3, 4, 5]

    def test_empty(self):
        assert shuffle([]) == []


# ─── reverse_map ──────────────────────────────────────────────────────

class TestReverseMap:
    def test_basic(self):
        assert reverse_map({'a': 1, 'b': 2}) == {1: 'a', 2: 'b'}

    def test_empty(self):
        assert reverse_map({}) == {}


# ─── is_class ─────────────────────────────────────────────────────────

class TestIsClass:
    def test_class(self):
        assert is_class(int) is True
        assert is_class(str) is True

    def test_instance(self):
        assert is_class(42) is False
        assert is_class('hello') is False


# ─── copy ─────────────────────────────────────────────────────────────

class TestCopy:
    def test_deep_copy(self):
        original = {'a': [1, 2, 3]}
        copied = copy(original)
        copied['a'].append(4)
        assert original['a'] == [1, 2, 3]

    def test_simple(self):
        assert copy(42) == 42


# ─── echo ─────────────────────────────────────────────────────────────

class TestEcho:
    def test_passthrough(self):
        assert echo(42) == 42
        assert echo('hello') == 'hello'
        assert echo(None) is None


# ─── import_object ────────────────────────────────────────────────────

class TestImportObject:
    def test_import_builtin(self):
        obj = import_object('os.path.join')
        assert obj is os.path.join

    def test_import_json(self):
        obj = import_object('json.dumps')
        import json
        assert obj is json.dumps

    def test_invalid_key(self):
        with pytest.raises(ValueError, match='Invalid import key'):
            import_object('justasingleword')

    def test_nonexistent_module(self):
        with pytest.raises(ModuleNotFoundError):
            import_object('nonexistent_module_xyz.SomeClass')

    def test_slash_splitter(self):
        obj = import_object('os/path/join')
        assert obj is os.path.join
