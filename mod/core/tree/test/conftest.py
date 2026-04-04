"""Fixtures for tree tests."""
import os
import sys
import tempfile
import shutil
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))))


@pytest.fixture
def tmp_dir():
    d = tempfile.mkdtemp(prefix='mod_tree_test_')
    yield d
    shutil.rmtree(d, ignore_errors=True)
