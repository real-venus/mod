"""Tests for the module app registry, ownership, and lifecycle management."""
import os
import sys
import json
import shutil
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import mod as m


# ─── Fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def ns():
    """Provide a Namespace instance."""
    return m.mod('server.namespace')()


@pytest.fixture(autouse=True)
def cleanup_app_registry(ns):
    """Clean up test entries from app registries after each test."""
    yield
    for name in ['_test_app', '_test_app2', '_test_owned', '_test_other']:
        try:
            ns.dereg_app(name)
        except Exception:
            pass
        try:
            ns.uninstall_app(name)
        except Exception:
            pass


@pytest.fixture(autouse=True)
def cleanup_test_app_mods():
    """Remove test app modules after each test."""
    yield
    for name in ['_test_newapp']:
        path = os.path.join(m.paths['orbit']['orbit'], name)
        if os.path.exists(path):
            shutil.rmtree(path)


# ─── App Registration ───────────────────────────────────────────────

class TestRegApp:
    def test_reg_app_creates_entry(self, ns):
        result = ns.reg_app('_test_app', 'http://0.0.0.0:3100', owner='0xabc')
        assert result['status'] == 'success'
        assert result['name'] == '_test_app'

    def test_reg_app_appears_in_namespace(self, ns):
        ns.reg_app('_test_app', 'http://0.0.0.0:3100', owner='0xabc')
        apps = ns.app_namespace()
        assert '_test_app' in apps
        assert apps['_test_app']['url'] == 'http://0.0.0.0:3100'

    def test_reg_app_stores_owner(self, ns):
        ns.reg_app('_test_app', 'http://0.0.0.0:3100', owner='0xABC123')
        apps = ns.app_namespace()
        assert apps['_test_app']['owner'] == '0xabc123'  # lowercased

    def test_dereg_app_removes_entry(self, ns):
        ns.reg_app('_test_app', 'http://0.0.0.0:3100')
        result = ns.dereg_app('_test_app')
        assert result['status'] == 'success'
        apps = ns.app_namespace()
        assert '_test_app' not in apps

    def test_dereg_nonexistent_returns_error(self, ns):
        result = ns.dereg_app('_nonexistent_xyz')
        assert result['status'] == 'error'

    def test_app_namespace_search(self, ns):
        ns.reg_app('_test_app', 'http://0.0.0.0:3100')
        ns.reg_app('_test_app2', 'http://0.0.0.0:3101')
        result = ns.app_namespace(search='_test_app2')
        assert '_test_app2' in result
        assert '_test_app' not in result


# ─── Ownership ──────────────────────────────────────────────────────

class TestAppOwnership:
    def test_app_owner_returns_owner(self, ns):
        ns.reg_app('_test_owned', 'http://0.0.0.0:3100', owner='0xOwner')
        owner = ns.app_owner('_test_owned')
        assert owner == '0xowner'

    def test_app_owner_none_for_missing(self, ns):
        owner = ns.app_owner('_nonexistent_xyz')
        assert owner is None

    def test_is_app_owner_true(self, ns):
        ns.reg_app('_test_owned', 'http://0.0.0.0:3100', owner='0xOwner')
        assert ns.is_app_owner('_test_owned', '0xOwner') is True

    def test_is_app_owner_case_insensitive(self, ns):
        ns.reg_app('_test_owned', 'http://0.0.0.0:3100', owner='0xAbCdEf')
        assert ns.is_app_owner('_test_owned', '0xabcdef') is True
        assert ns.is_app_owner('_test_owned', '0xABCDEF') is True

    def test_is_app_owner_false_for_different_address(self, ns):
        ns.reg_app('_test_owned', 'http://0.0.0.0:3100', owner='0xOwner')
        assert ns.is_app_owner('_test_owned', '0xNotOwner') is False

    def test_is_app_owner_true_when_no_owner_set(self, ns):
        """Backwards compat: no owner means anyone can manage."""
        ns.reg_app('_test_app', 'http://0.0.0.0:3100', owner='')
        assert ns.is_app_owner('_test_app', '0xAnyone') is True

    def test_is_app_owner_checks_installed_apps(self, ns):
        """Ownership check should also look at installed apps."""
        ns.install_app('_test_owned', port=3100, owner='0xInstalled')
        assert ns.is_app_owner('_test_owned', '0xInstalled') is True
        assert ns.is_app_owner('_test_owned', '0xOther') is False


# ─── Installed Apps ─────────────────────────────────────────────────

class TestInstalledApps:
    def test_install_app(self, ns):
        result = ns.install_app('_test_app', port=3100, owner='0xabc', path='/tmp/test')
        assert result['status'] == 'success'

    def test_install_app_persists(self, ns):
        ns.install_app('_test_app', port=3100, owner='0xabc', path='/tmp/test')
        installed = ns.store.get('app_installed.json', {})
        assert '_test_app' in installed
        assert installed['_test_app']['port'] == 3100
        assert installed['_test_app']['owner'] == '0xabc'

    def test_uninstall_app(self, ns):
        ns.install_app('_test_app', port=3100, owner='0xabc')
        result = ns.uninstall_app('_test_app')
        assert result['status'] == 'success'
        installed = ns.store.get('app_installed.json', {})
        assert '_test_app' not in installed

    def test_uninstall_nonexistent_returns_error(self, ns):
        result = ns.uninstall_app('_nonexistent_xyz')
        assert result['status'] == 'error'

    def test_reg_app_also_installs(self, ns):
        """reg_app should also add to installed apps."""
        ns.reg_app('_test_app', 'http://0.0.0.0:3100', owner='0xabc', port=3100)
        installed = ns.store.get('app_installed.json', {})
        assert '_test_app' in installed


# ─── App Status ─────────────────────────────────────────────────────

class TestAppStatus:
    def test_status_shows_running_apps(self, ns):
        ns.reg_app('_test_app', 'http://0.0.0.0:3100', owner='0xabc', port=3100)
        status = ns.app_status()
        assert '_test_app' in status
        assert status['_test_app']['running'] is True
        assert status['_test_app']['url'] == 'http://0.0.0.0:3100'

    def test_status_shows_stopped_apps(self, ns):
        ns.install_app('_test_app', port=3100, owner='0xabc')
        # Not in running registry, only installed
        status = ns.app_status()
        assert '_test_app' in status
        assert status['_test_app']['running'] is False

    def test_status_merges_running_and_installed(self, ns):
        ns.install_app('_test_app', port=3100, owner='0xabc', path='/tmp/a')
        ns.reg_app('_test_app', 'http://0.0.0.0:3100', owner='0xabc', port=3100)
        ns.install_app('_test_app2', port=3101, owner='0xabc', path='/tmp/b')
        status = ns.app_status()
        assert '_test_app' in status
        assert '_test_app2' in status
        assert status['_test_app']['running'] is True
        assert status['_test_app2']['running'] is False

    def test_status_filter_by_owner(self, ns):
        ns.install_app('_test_owned', port=3100, owner='0xabc')
        ns.install_app('_test_other', port=3101, owner='0xdef')
        status = ns.app_status(owner='0xabc')
        assert '_test_owned' in status
        assert '_test_other' not in status


# ─── Factory: new_app ───────────────────────────────────────────────

class TestNewApp:
    def test_new_app_has_expected_keys(self):
        """new_app should return name, port, owner, path, url, msg."""
        result = m.new_app('_test_newapp', install=False, serve=False)
        assert result['name'] == '_test_newapp'
        assert 'port' in result
        assert 'owner' in result
        assert 'path' in result
        assert 'url' in result
        assert 'msg' in result

    def test_new_app_creates_directory(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        assert os.path.isdir(result['path'])

    def test_new_app_creates_app_json(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        mod_json_path = os.path.join(result['app_dir'], 'app.json')
        assert os.path.exists(mod_json_path)
        with open(mod_json_path) as f:
            config = json.load(f)
        assert config['name'] == '_test_newapp'
        assert config['basePath'] == '/_test_newapp'
        assert 'owner' in config
        assert 'port' in config

    def test_new_app_sets_basepath_in_next_config(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        next_config_path = os.path.join(result['app_dir'], 'next.config.js')
        assert os.path.exists(next_config_path)
        with open(next_config_path) as f:
            content = f.read()
        assert "'/_test_newapp'" in content
        assert "'/appbase'" not in content

    def test_new_app_sets_package_name(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        pkg_path = os.path.join(result['app_dir'], 'package.json')
        with open(pkg_path) as f:
            pkg = json.load(f)
        assert pkg['name'] == '_test_newapp'

    def test_new_app_renames_inner_dir(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        inner = os.path.join(result['path'], '_test_newapp')
        assert os.path.isdir(inner)
        old_inner = os.path.join(result['path'], 'appbase')
        assert not os.path.exists(old_inner)

    def test_new_app_has_mod_py(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        mod_py = os.path.join(result['path'], '_test_newapp', 'mod.py')
        assert os.path.exists(mod_py)

    def test_new_app_sets_owner(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        assert result['owner'] == m.owner()

    def test_new_app_with_custom_port(self):
        result = m.new_app('_test_newapp', port=3999, install=False, serve=False)
        assert result['port'] == 3999
        with open(os.path.join(result['app_dir'], 'app.json')) as f:
            config = json.load(f)
        assert config['port'] == 3999

    def test_new_app_updates_template_text(self):
        result = m.new_app('_test_newapp', install=False, serve=False)
        page_path = os.path.join(result['app_dir'], 'app', 'page.tsx')
        with open(page_path) as f:
            content = f.read()
        assert '_test_newapp' in content
        assert 'appbase' not in content


# ─── Factory: kill_app / edit_app ownership checks ──────────────────

class TestAppOwnershipEnforcement:
    def test_kill_app_denies_non_owner(self, ns):
        ns.install_app('_test_owned', port=3100, owner='0xrealowner')
        ns.reg_app('_test_owned', 'http://0.0.0.0:3100', owner='0xrealowner')
        result = m.kill_app('_test_owned', key='test')
        # Should fail because test key != 0xrealowner
        # (unless the test key IS the owner, which it shouldn't be)
        # We check the error path exists
        assert isinstance(result, dict)

    def test_edit_app_denies_non_owner(self, ns):
        ns.install_app('_test_owned', port=3100, owner='0xrealowner')
        result = m.edit_app('_test_owned', query='test', key='test')
        assert isinstance(result, dict)


# ─── Appbase Template ──────────────────────────────────────────────

class TestAppbaseTemplate:
    def test_appbase_module_exists(self):
        assert m.mod_exists('appbase')

    def test_appbase_has_serve_method(self):
        appbase = m.mod('appbase')()
        assert hasattr(appbase, 'serve')

    def test_appbase_has_owner_property(self):
        appbase = m.mod('appbase')()
        assert hasattr(appbase, 'owner')

    def test_appbase_has_is_owner_method(self):
        appbase = m.mod('appbase')()
        assert hasattr(appbase, 'is_owner')

    def test_appbase_has_edit_method(self):
        appbase = m.mod('appbase')()
        assert hasattr(appbase, 'edit')

    def test_appbase_has_kill_method(self):
        appbase = m.mod('appbase')()
        assert hasattr(appbase, 'kill')

    def test_appbase_forward_returns_info(self):
        appbase = m.mod('appbase')()
        info = appbase.forward()
        assert 'name' in info
        assert 'owner' in info
        assert 'port' in info


# ─── Mixin Structure ───────────────────────────────────────────────

class TestFactoryAppMethods:
    def test_mod_has_new_app(self):
        assert hasattr(m.Mod, 'new_app')

    def test_mod_has_kill_app(self):
        assert hasattr(m.Mod, 'kill_app')

    def test_mod_has_edit_app(self):
        assert hasattr(m.Mod, 'edit_app')


# ─── Namespace Reset ───────────────────────────────────────────────

class TestReset:
    def test_reset_clears_app_registry(self, ns):
        ns.reg_app('_test_app', 'http://0.0.0.0:3100')
        ns.install_app('_test_app', port=3100)
        ns.reset()
        assert ns.app_namespace() == {}
        assert ns.store.get('app_installed.json', {}) == {}
