"""Tests for Mod — core class mixins and resolution."""
import os
import pytest
from unittest.mock import MagicMock, patch


class TestModImport:
    def test_mod_class_importable(self):
        from mod.core.mod.mod import Mod
        assert Mod is not None

    def test_mod_class_constants(self):
        from mod.core.mod.mod import Mod
        assert Mod.name == 'mod'
        assert '__pycache__' in Mod._avoid_folders
        assert 'node_modules' in Mod._avoid_folders
        assert 'py' in Mod._default_file_types


class TestFsMixin:
    def test_fs_mixin_importable(self):
        from mod.core.mod.fs import FsMixin
        assert FsMixin is not None


class TestDeployMixin:
    def test_deploy_mixin_importable(self):
        from mod.core.mod.deploy import DeployMixin
        assert DeployMixin is not None


class TestFactoryMixin:
    def test_factory_mixin_importable(self):
        from mod.core.mod.factory import FactoryMixin
        assert FactoryMixin is not None

    def test_avoid_folders_includes_dot_mod(self):
        from mod.core.mod.mod import Mod
        assert '.mod' in Mod._avoid_folders


class TestBranch:
    def test_init_mod_meta_creates_branch_file(self, tmp_path):
        from mod.core.mod.factory import FactoryMixin
        fm = FactoryMixin()
        fm.init_mod_meta(str(tmp_path))
        branch_file = tmp_path / '.mod' / 'branch'
        assert branch_file.exists()
        assert branch_file.read_text() == 'main'

    def test_init_mod_meta_custom_branch(self, tmp_path):
        from mod.core.mod.factory import FactoryMixin
        fm = FactoryMixin()
        fm.init_mod_meta(str(tmp_path), branch='dev')
        branch_file = tmp_path / '.mod' / 'branch'
        assert branch_file.read_text() == 'dev'

    def test_init_mod_meta_does_not_overwrite(self, tmp_path):
        from mod.core.mod.factory import FactoryMixin
        fm = FactoryMixin()
        fm.init_mod_meta(str(tmp_path), branch='dev')
        fm.init_mod_meta(str(tmp_path), branch='other')
        branch_file = tmp_path / '.mod' / 'branch'
        assert branch_file.read_text() == 'dev'
