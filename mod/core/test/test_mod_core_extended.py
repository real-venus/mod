"""Extended tests for mod/core/mod.py — additional Mod class tests."""
import os
import sys
import json
import tempfile
import shutil
import time
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from mod.core.mod import Mod


# ─── Helpers ──────────────────────────────────────────────────────────

class MockMod:
    """A lightweight mock that tests Mod methods without __init__."""

    def __new__(cls):
        obj = object.__new__(Mod)
        obj.homepath = os.path.expanduser('~')
        obj.avoid_folders = set(Mod._avoid_folders)
        obj.file_types = list(Mod._default_file_types)
        obj.anchor_names = list(Mod._default_anchor_names)
        obj.name = 'mod'
        obj.storage_path = os.path.expanduser('~/.mod')
        obj._mod_cache = {}
        obj.obj_cache = {}
        obj.modscache = {}
        obj.fnscache = {}
        obj.tree_cache = {}
        obj.executor_cache = {}
        obj._config_cache = {}
        obj._executors = {}
        obj.paths = {
            'mod': os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/mod',
            'lib': os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'orbit': {
                'orbit': '/tmp/mod_test_orbit',
                'core': os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/mod/core',
                'local': os.getcwd(),
            },
            'home': os.path.expanduser('~'),
        }
        return obj


@pytest.fixture
def mod():
    return MockMod()


# ─── munch ───────────────────────────────────────────────────────────

class TestMunch:
    def test_dict(self, mod):
        result = mod.munch({'a': 1, 'b': 2})
        assert result.a == 1
        assert result.b == 2

    def test_nested(self, mod):
        result = mod.munch({'a': {'b': 3}})
        assert result.a.b == 3

    def test_list(self, mod):
        result = mod.munch({'a': [{'b': 1}]})
        assert result.a[0].b == 1

    def test_non_dict(self, mod):
        assert mod.munch(42) == 42
        assert mod.munch('hello') == 'hello'


# ─── env edge cases ─────────────────────────────────────────────────

class TestEnvExtended:
    def test_home(self, mod):
        result = mod.env('HOME')
        assert result is not None
        assert '/' in result

    def test_env_returns_dict(self, mod):
        result = mod.env()
        assert 'HOME' in result
        assert 'PATH' in result

    def test_none_key(self, mod):
        result = mod.env(None)
        assert isinstance(result, dict)


# ─── time extended ───────────────────────────────────────────────────

class TestTimeExtended:
    def test_float_positive(self, mod):
        t = mod.time()
        assert t > 1000000

    def test_int_milliseconds(self, mod):
        t = mod.time(mode='int')
        assert t > 1000000000  # milliseconds since epoch

    def test_iso_format(self, mod):
        t = mod.time(mode='iso')
        assert 'T' in t
        assert t.endswith('Z')

    def test_date_contains_day(self, mod):
        t = mod.time(mode='date')
        # time.ctime returns something like 'Mon Mar 24 ...'
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        assert any(d in t for d in days)


# ─── iscid extended ──────────────────────────────────────────────────

class TestIsCidExtended:
    def test_valid_qm_prefix(self, mod):
        cid = 'Qm' + 'a' * 44
        assert mod.iscid(cid) is True

    def test_wrong_prefix(self, mod):
        cid = 'Xm' + 'a' * 44
        assert mod.iscid(cid) is False

    def test_wrong_length(self, mod):
        cid = 'Qm' + 'a' * 10
        assert mod.iscid(cid) is False

    def test_none_input(self, mod):
        assert mod.iscid(None) is False

    def test_list_input(self, mod):
        assert mod.iscid([1, 2, 3]) is False


# ─── filter_path extended ───────────────────────────────────────────

class TestFilterPathExtended:
    def test_venv_excluded(self, mod):
        assert mod.filter_path('/foo/venv/bar.py') is False

    def test_env_excluded(self, mod):
        assert mod.filter_path('/foo/.env/bar.py') is False

    def test_git_excluded(self, mod):
        assert mod.filter_path('/foo/.git/config') is False

    def test_egg_info_excluded(self, mod):
        assert mod.filter_path('/foo/egg-info/bar') is False

    def test_ipynb_checkpoints_excluded(self, mod):
        assert mod.filter_path('/foo/.ipynb_checkpoints/bar') is False

    def test_multiple_avoid_folders(self, mod):
        assert mod.filter_path('/foo/node_modules/__pycache__/bar') is False

    def test_search_case_sensitive(self, mod):
        assert mod.filter_path('/foo/bar.py', search='Bar') is False
        assert mod.filter_path('/foo/bar.py', search='bar') is True


# ─── files extended ─────────────────────────────────────────────────

class TestFilesExtended:
    def test_nonexistent_path(self, mod):
        result = mod.files('/nonexistent_path_xyz_test_12345')
        assert result == []

    def test_returns_sorted(self, mod, nested_dir):
        result = mod.files(nested_dir)
        assert result == sorted(result)

    def test_depth_two(self, mod, nested_dir):
        result = mod.files(nested_dir, depth=2)
        filenames = [os.path.basename(f) for f in result]
        assert 'a.py' in filenames
        assert 'b.py' in filenames
        # c.py is at depth 3 (nested_dir/sub/deep/c.py)
        assert 'c.py' not in filenames


# ─── folders extended ────────────────────────────────────────────────

class TestFoldersExtended:
    def test_include_hidden(self, mod, nested_dir):
        result = mod.folders(nested_dir, depth=3, include_hidden=True)
        dirnames = [os.path.basename(d) for d in result]
        assert '.hidden' in dirnames

    def test_search_filter(self, mod, nested_dir):
        # search filters paths containing the search string
        result = mod.folders(nested_dir, depth=3, search='sub')
        dirnames = [os.path.basename(d) for d in result]
        assert 'sub' in dirnames

    def test_returns_sorted(self, mod, nested_dir):
        result = mod.folders(nested_dir, depth=3)
        assert result == sorted(result)


# ─── glob extended ───────────────────────────────────────────────────

class TestGlobExtended:
    def test_returns_files_only(self, mod, nested_dir):
        result = mod.glob(nested_dir)
        for f in result:
            assert os.path.isfile(f)

    def test_depth_zero(self, mod, nested_dir):
        result = mod.glob(nested_dir, depth=0)
        assert result == []

    def test_include_hidden(self, mod, nested_dir):
        # With include_hidden=True, hidden dir files should appear
        result_hidden = mod.glob(nested_dir, include_hidden=True)
        result_normal = mod.glob(nested_dir, include_hidden=False)
        # hidden version should have more or equal files
        assert len(result_hidden) >= len(result_normal)


# ─── ls extended ─────────────────────────────────────────────────────

class TestLsExtended:
    def test_sorted_output(self, mod, nested_dir):
        result = mod.ls(nested_dir)
        assert result == sorted(result)

    def test_search_multiple_matches(self, mod, nested_dir):
        # Create files that match a unique prefix
        for name in ['zzuniq_a.py', 'zzuniq_b.py']:
            with open(os.path.join(nested_dir, name), 'w') as f:
                f.write('')
        result = mod.ls(nested_dir, search='zzuniq_')
        assert len(result) == 2


# ─── get_json extended ──────────────────────────────────────────────

class TestGetJsonExtended:
    def test_nested_json(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'nested.json')
        data = {'a': {'b': [1, 2, 3]}, 'c': True}
        with open(path, 'w') as f:
            json.dump(data, f)
        result = mod.get_json(path)
        assert result == data

    def test_empty_json(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'empty.json')
        with open(path, 'w') as f:
            json.dump({}, f)
        result = mod.get_json(path)
        assert result == {}

    def test_list_json(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'list.json')
        with open(path, 'w') as f:
            json.dump([1, 2, 3], f)
        result = mod.get_json(path)
        assert result == [1, 2, 3]

    def test_default_types(self, mod):
        assert mod.get_json('/nonexistent', default=[]) == []
        assert mod.get_json('/nonexistent', default=None) is None
        assert mod.get_json('/nonexistent', default=42) == 42


# ─── put_json extended ──────────────────────────────────────────────

class TestPutJsonExtended:
    def test_creates_file(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'new_data')
        mod.put_json(path, {'x': 1})
        assert os.path.exists(path + '.json')

    def test_overwrites(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'overwrite')
        mod.put_json(path, {'first': True})
        mod.put_json(path, {'second': True})
        result = mod.get_json(path)
        assert result.get('second') is True


# ─── put_text extended ──────────────────────────────────────────────

class TestPutTextExtended:
    def test_unicode(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'unicode.txt')
        mod.put_text(path, 'hello 世界 🌍')
        with open(path, 'r') as f:
            assert f.read() == 'hello 世界 🌍'

    def test_returns_size(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'sized.txt')
        result = mod.put_text(path, 'abc')
        assert result['size'] > 0

    def test_empty_content(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'empty.txt')
        result = mod.put_text(path, '')
        assert result['success'] is True
        with open(path, 'r') as f:
            assert f.read() == ''


# ─── text extended ──────────────────────────────────────────────────

class TestTextExtended:
    def test_read_file(self, mod, tmp_dir):
        path = os.path.join(tmp_dir, 'read_me.txt')
        with open(path, 'w') as f:
            f.write('test content here')
        result = mod.text(path)
        assert result == 'test content here'

    def test_refuses_home(self, mod):
        with pytest.raises(AssertionError):
            mod.text(os.path.expanduser('~'))


# ─── rm extended ─────────────────────────────────────────────────────

class TestRmExtended:
    def test_remove_nested_dir(self, mod, tmp_dir):
        nested = os.path.join(tmp_dir, 'a', 'b', 'c')
        os.makedirs(nested)
        with open(os.path.join(nested, 'file.txt'), 'w') as f:
            f.write('data')
        result = mod.rm(os.path.join(tmp_dir, 'a'))
        assert result['success'] is True
        assert not os.path.exists(os.path.join(tmp_dir, 'a'))

    def test_protected_home(self, mod):
        with pytest.raises(PermissionError):
            mod.rm('~')


# ─── get_path extended ──────────────────────────────────────────────

class TestGetPathExtended:
    def test_double_extension(self, mod):
        result = mod.get_path('/tmp/test.json', extension='json')
        # should not add .json twice
        assert not result.endswith('.json.json')

    def test_different_extension(self, mod):
        result = mod.get_path('/tmp/test', extension='yaml')
        assert result.endswith('.yaml')

    def test_storage_key_path(self, mod):
        result = mod.get_path('some_key')
        assert mod.storage_dir() in result
        assert 'some_key' in result


# ─── kwargs2str extended ────────────────────────────────────────────

class TestKwargs2StrExtended:
    def test_with_strings(self, mod):
        result = mod.kwargs2str({'name': 'test', 'count': 5})
        assert 'name=test' in result
        assert 'count=5' in result

    def test_with_none(self, mod):
        result = mod.kwargs2str({'a': None})
        assert 'None' in result


# ─── abspath extended ───────────────────────────────────────────────

class TestAbspathExtended:
    def test_double_slash(self, mod):
        result = mod.abspath('/tmp//foo')
        assert '//' not in result

    def test_dot_dot(self, mod):
        result = mod.abspath('/tmp/foo/../bar')
        assert result == '/tmp/bar'

    def test_tilde_subpath(self, mod):
        result = mod.abspath('~/foo/bar')
        assert result == os.path.expanduser('~/foo/bar')


# ─── relpath extended ───────────────────────────────────────────────

class TestRelpathExtended:
    def test_outside_home(self, mod):
        result = mod.relpath('/tmp/something')
        assert result == '/tmp/something'

    def test_nested_home(self, mod):
        home = os.path.expanduser('~')
        result = mod.relpath(home + '/a/b/c')
        assert result == '~/a/b/c'


# ─── storage_dir extended ───────────────────────────────────────────

class TestStorageDirExtended:
    def test_with_slash(self, mod):
        result = mod.storage_dir('model/openai')
        assert 'model.openai' in result

    def test_absolute(self, mod):
        result = mod.storage_dir()
        assert os.path.isabs(result)


# ─── sleep ───────────────────────────────────────────────────────────

class TestSleepExtended:
    def test_zero_sleep(self, mod):
        t0 = time.time()
        mod.sleep(0)
        elapsed = time.time() - t0
        assert elapsed < 0.1


# ─── mod_class extended ─────────────────────────────────────────────

class TestModClassExtended:
    def test_builtin_types(self, mod):
        assert mod.mod_class(str) == 'str'
        assert mod.mod_class(list) == 'list'
        assert mod.mod_class(dict) == 'dict'
        assert mod.mod_class(float) == 'float'


# ─── is_home extended ───────────────────────────────────────────────

class TestIsHomeExtended:
    def test_home_subdir(self, mod):
        assert mod.is_home(os.path.expanduser('~/foo')) is False

    def test_root(self, mod):
        assert mod.is_home('/') is False

    def test_none(self, mod):
        # None defaults to pwd which is not home (ensured by Mod.__init__)
        result = mod.is_home(None)
        assert isinstance(result, bool)
