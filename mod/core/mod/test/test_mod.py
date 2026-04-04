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
