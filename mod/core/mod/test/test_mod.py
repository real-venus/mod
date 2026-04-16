"""Tests for Mod — core class methods and resolution."""
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


class TestInlinedMethods:
    """Verify methods previously in FsMixin, DeployMixin, FactoryMixin are on Mod."""

    def test_has_fs_methods(self):
        from mod.core.mod.mod import Mod
        assert hasattr(Mod, 'abspath')
        assert hasattr(Mod, 'files')

    def test_has_deploy_methods(self):
        from mod.core.mod.mod import Mod
        assert hasattr(Mod, 'serve')

    def test_has_factory_methods(self):
        from mod.core.mod.mod import Mod
        assert hasattr(Mod, 'new')
        assert hasattr(Mod, 'init_mod_meta')
        assert '.mod' in Mod._avoid_folders

    def test_factory_aliases(self):
        from mod.core.mod.mod import Mod
        assert Mod.fork is Mod.new
        assert Mod.create is Mod.new

    def test_init_mod_meta_creates_branch_file(self, tmp_path):
        from mod.core.mod.mod import Mod
        m = Mod()
        m.init_mod_meta(str(tmp_path))
        branch_file = tmp_path / '.mod' / 'branch'
        assert branch_file.exists()
        assert branch_file.read_text() == 'main'

    def test_init_mod_meta_custom_branch(self, tmp_path):
        from mod.core.mod.mod import Mod
        m = Mod()
        m.init_mod_meta(str(tmp_path), branch='dev')
        branch_file = tmp_path / '.mod' / 'branch'
        assert branch_file.read_text() == 'dev'

    def test_init_mod_meta_does_not_overwrite(self, tmp_path):
        from mod.core.mod.mod import Mod
        m = Mod()
        m.init_mod_meta(str(tmp_path), branch='dev')
        m.init_mod_meta(str(tmp_path), branch='other')
        branch_file = tmp_path / '.mod' / 'branch'
        assert branch_file.read_text() == 'dev'
