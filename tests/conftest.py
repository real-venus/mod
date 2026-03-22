"""Shared fixtures for mod protocol tests."""
import os
import sys
import json
import tempfile
import shutil
import pytest

# Ensure mod is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.fixture
def tmp_dir():
    """Provide a temporary directory that is cleaned up after the test."""
    d = tempfile.mkdtemp(prefix='mod_test_')
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def tmp_json(tmp_dir):
    """Create a temporary JSON file and return its path."""
    path = os.path.join(tmp_dir, 'test.json')
    data = {'name': 'test', 'value': 42}
    with open(path, 'w') as f:
        json.dump(data, f)
    return path


@pytest.fixture
def tmp_text_file(tmp_dir):
    """Create a temporary text file and return its path."""
    path = os.path.join(tmp_dir, 'test.txt')
    with open(path, 'w') as f:
        f.write('hello world')
    return path


@pytest.fixture
def tmp_py_file(tmp_dir):
    """Create a temporary Python file with a class."""
    path = os.path.join(tmp_dir, 'sample.py')
    with open(path, 'w') as f:
        f.write('''class SampleClass:
    def greet(self):
        return "hello"

class AnotherClass:
    pass

def standalone_fn():
    return 42
''')
    return path


@pytest.fixture
def nested_dir(tmp_dir):
    """Create a nested directory structure for testing file/folder listing."""
    # Structure:
    # tmp_dir/
    #   a.py
    #   sub/
    #     b.py
    #     deep/
    #       c.py
    #   .hidden/
    #     d.py
    #   __pycache__/
    #     e.pyc

    for sub in ['sub/deep', '.hidden', '__pycache__']:
        os.makedirs(os.path.join(tmp_dir, sub), exist_ok=True)

    files = {
        'a.py': 'x = 1',
        'sub/b.py': 'y = 2',
        'sub/deep/c.py': 'z = 3',
        '.hidden/d.py': 'h = 4',
        '__pycache__/e.pyc': 'cache',
    }
    for rel, content in files.items():
        with open(os.path.join(tmp_dir, rel), 'w') as f:
            f.write(content)

    return tmp_dir
