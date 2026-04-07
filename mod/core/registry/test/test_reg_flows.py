"""Integration tests for registry reg/dereg flows — git URL, CID, shorthand.

Uses the 'test' key (non-owner) so modules land in portal/.
A small public repo is used as the dummy: fiveoutofnine/whatcanirun.
"""
import os
import json
import shutil
import pytest

import mod as m
from mod.core.registry.registry import Registry

DUMMY_REPO = 'https://github.com/fiveoutofnine/whatcanirun'
DUMMY_SHORTHAND = 'fiveoutofnine/whatcanirun'
DUMMY_NAME = 'whatcanirun'
TEST_KEY = 'test'


@pytest.fixture(scope='module')
def reg():
    """Registry instance with the test key."""
    return Registry(key=TEST_KEY)


@pytest.fixture(scope='module')
def store():
    return m.mod('localfs')()


@pytest.fixture(scope='module')
def test_key_address():
    return m.key(TEST_KEY).address.lower()


@pytest.fixture(autouse=True)
def cleanup(reg, test_key_address):
    """Remove test modules before and after each test."""
    names = [DUMMY_NAME, 'testcidmod', 'testconfigmod', 'testgitcid', 'testanchormod']
    for name in names:
        _cleanup_mod(reg, name, test_key_address)
    yield
    for name in names:
        _cleanup_mod(reg, name, test_key_address)


def _cleanup_mod(reg, name, key_addr):
    """Silently remove a mod from the registry and disk."""
    try:
        reg.rm_mod(mod=name, key=key_addr)
    except Exception:
        pass
    for base in [m.paths['orbit'].get('portal', ''), m.paths['orbit'].get('orbit', '')]:
        # Modules live under <base>/<key>/<name>
        p = os.path.join(base, key_addr, name)
        if os.path.isdir(p):
            shutil.rmtree(p)
        # Also clean flat path (in case of stale data)
        p_flat = os.path.join(base, name)
        if os.path.isdir(p_flat):
            shutil.rmtree(p_flat)


# ── Git URL registration ───────────────────────────────────────────


class TestRegGitUrl:
    """Register a module from a full GitHub URL."""

    def test_reg_git_url(self, reg, test_key_address):
        info = reg.reg(DUMMY_REPO, key=TEST_KEY, name=DUMMY_NAME)
        assert info['name'] == DUMMY_NAME
        assert info['key'] == test_key_address
        assert 'cid' in info and info['cid']
        assert 'content' in info
        assert 'schema' in info
        # Module directory was created
        assert reg.exists(mod=DUMMY_NAME, key=test_key_address)

    def test_reg_git_url_creates_config(self, reg, test_key_address):
        info = reg.reg(DUMMY_REPO, key=TEST_KEY, name=DUMMY_NAME)
        modpath = os.path.join(m.paths['orbit']['portal'], test_key_address, DUMMY_NAME)
        config_path = os.path.join(modpath, 'config.json')
        assert os.path.isfile(config_path)

    def test_reg_git_url_creates_branch(self, reg, test_key_address):
        reg.reg(DUMMY_REPO, key=TEST_KEY, name=DUMMY_NAME)
        modpath = os.path.join(m.paths['orbit']['portal'], test_key_address, DUMMY_NAME)
        branch_path = os.path.join(modpath, '.mod', 'branch')
        assert os.path.isfile(branch_path)
        with open(branch_path) as f:
            assert f.read() == 'main'

    def test_reg_git_url_has_anchor_or_generates(self, reg):
        """After git reg, the module must be callable (anchor exists)."""
        reg.reg(DUMMY_REPO, key=TEST_KEY, name=DUMMY_NAME)
        # If we can get the schema, an anchor was found or generated
        schema = m.schema(DUMMY_NAME)
        assert isinstance(schema, dict)
        assert len(schema) > 0


# ── Shorthand (user/repo) registration ─────────────────────────────


class TestRegShorthand:
    """Register from user/repo shorthand."""

    def test_reg_shorthand(self, reg, test_key_address):
        info = reg.reg(DUMMY_SHORTHAND, key=TEST_KEY)
        assert info['name'] == DUMMY_NAME
        assert info['key'] == test_key_address
        assert reg.exists(mod=DUMMY_NAME, key=test_key_address)

    def test_shorthand_expands_to_github(self, reg):
        assert reg.is_git_url(DUMMY_SHORTHAND)


# ── CID registration (config.json) ─────────────────────────────────


class TestRegCidConfig:
    """Register from a CID that points to a config.json."""

    def test_reg_cid_config_with_git_url(self, reg, store, test_key_address):
        """CID of config.json with url -> clones from git."""
        config = {
            'name': 'testgitcid',
            'description': 'CID test with git url',
            'url': DUMMY_REPO,
        }
        cid = store.put(config)
        assert store.iscid(cid)

        info = reg.reg(cid, key=TEST_KEY)
        assert info['name'] == 'testgitcid'
        assert info['key'] == test_key_address
        assert info.get('description') == 'CID test with git url'
        assert reg.exists(mod='testgitcid', key=test_key_address)

    def test_reg_cid_config_no_url(self, reg, store, test_key_address):
        """CID of config.json without url -> creates local mod."""
        config = {
            'name': 'testconfigmod',
            'description': 'A purely local module from CID config',
            'version': '0.1.0',
            'fns': ['forward', 'info'],
            'port': 7777,
        }
        cid = store.put(config)
        info = reg.reg(cid, key=TEST_KEY)
        assert info['name'] == 'testconfigmod'
        assert info['key'] == test_key_address
        assert reg.exists(mod='testconfigmod', key=test_key_address)

        # Config fields merged into info
        assert info.get('description') == 'A purely local module from CID config'
        assert info.get('version') == '0.1.0'
        assert info.get('fns') == ['forward', 'info']
        assert info.get('port') == 7777

    def test_reg_cid_config_writes_config_json(self, reg, store, test_key_address):
        """Config from CID should be written to disk."""
        config = {
            'name': 'testconfigmod',
            'description': 'Written config',
        }
        cid = store.put(config)
        reg.reg(cid, key=TEST_KEY)
        modpath = os.path.join(m.paths['orbit']['portal'], test_key_address, 'testconfigmod')
        config_path = os.path.join(modpath, 'config.json')
        assert os.path.isfile(config_path)
        with open(config_path) as f:
            disk_config = json.load(f)
        assert disk_config['name'] == 'testconfigmod'
        assert disk_config['description'] == 'Written config'

    def test_reg_cid_config_has_working_anchor(self, reg, store, test_key_address):
        """Mod without any .py files should get a working anchor (auto-generated)."""
        # Use a unique name to avoid mod cache pollution from other tests
        config = {'name': 'testanchormod', 'description': 'anchor test'}
        cid = store.put(config)
        info = reg.reg(cid, key=TEST_KEY)
        # Schema CID was stored during registration — proves anchor worked
        assert 'schema' in info and info['schema']
        stored_schema = reg.get(info['schema'])
        assert isinstance(stored_schema, dict)
        assert len(stored_schema) > 0

    def test_reg_cid_no_name_fails(self, reg, store):
        """CID config without name and no name param should fail."""
        config = {'description': 'no name here'}
        cid = store.put(config)
        with pytest.raises(AssertionError, match='no "name" field'):
            reg.reg(cid, key=TEST_KEY)


# ── CID detection ──────────────────────────────────────────────────


class TestCidDetection:
    """is_cid_url should recognize valid CID format, not just local CIDs."""

    def test_iscid_recognizes_stored(self, reg, store):
        cid = store.put({'test': 1})
        assert reg.is_cid_url(cid)

    def test_iscid_recognizes_format(self, reg):
        # QmXxx... is valid CIDv0 format even if not stored
        assert reg.store.iscid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')

    def test_not_cid(self, reg):
        assert not reg.is_cid_url('not-a-cid')
        assert not reg.is_cid_url('https://github.com/user/repo')
        assert not reg.is_cid_url('hello')


# ── Deregistration ──────────────────────────────────────────────────


class TestDereg:
    """rm_mod should remove from registry and store."""

    def test_dereg_local(self, reg, test_key_address):
        """Register then deregister a local module."""
        info = reg.reg(DUMMY_REPO, key=TEST_KEY, name=DUMMY_NAME)
        assert reg.exists(mod=DUMMY_NAME, key=test_key_address)

        result = reg.rm_mod(mod=DUMMY_NAME, key=test_key_address)
        assert result is True
        assert not reg.exists(mod=DUMMY_NAME, key=test_key_address)

    def test_dereg_cid_config(self, reg, store, test_key_address):
        """Register from CID config then deregister."""
        config = {'name': 'testcidmod', 'description': 'will be removed'}
        cid = store.put(config)
        reg.reg(cid, key=TEST_KEY)
        assert reg.exists(mod='testcidmod', key=test_key_address)

        result = reg.rm_mod(mod='testcidmod', key=test_key_address)
        assert result is True
        assert not reg.exists(mod='testcidmod', key=test_key_address)

    def test_dereg_nonexistent(self, reg, test_key_address):
        """rm_mod on a non-registered module returns False."""
        result = reg.rm_mod(mod='does_not_exist_xyz', key=test_key_address)
        assert result is False


# ── Round-trip ──────────────────────────────────────────────────────


class TestRoundTrip:
    """Full reg -> call -> dereg -> re-reg cycle."""

    def test_roundtrip_git(self, reg, test_key_address):
        # Register
        info = reg.reg(DUMMY_REPO, key=TEST_KEY, name=DUMMY_NAME)
        cid1 = info['cid']
        assert reg.exists(mod=DUMMY_NAME, key=test_key_address)

        # Call module
        mod_info = m.fn(f'{DUMMY_NAME}/info')()
        assert mod_info['name'] == DUMMY_NAME

        # Deregister
        reg.rm_mod(mod=DUMMY_NAME, key=test_key_address)
        assert not reg.exists(mod=DUMMY_NAME, key=test_key_address)

        # Re-register
        info2 = reg.reg(DUMMY_REPO, key=TEST_KEY, name=DUMMY_NAME)
        assert reg.exists(mod=DUMMY_NAME, key=test_key_address)
        # CIDs can differ (timestamps change)
        assert info2['name'] == DUMMY_NAME

    def test_roundtrip_cid_config(self, reg, store, test_key_address):
        config = {
            'name': 'testcidmod',
            'description': 'round-trip test',
            'version': '1.0.0',
        }
        cid = store.put(config)

        # Register
        info = reg.reg(cid, key=TEST_KEY)
        assert info['name'] == 'testcidmod'
        assert info['version'] == '1.0.0'
        assert reg.exists(mod='testcidmod', key=test_key_address)

        # Deregister
        reg.rm_mod(mod='testcidmod', key=test_key_address)
        assert not reg.exists(mod='testcidmod', key=test_key_address)

        # Re-register
        info2 = reg.reg(cid, key=TEST_KEY)
        assert info2['name'] == 'testcidmod'
        assert reg.exists(mod='testcidmod', key=test_key_address)
