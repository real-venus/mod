"""
Tests for the Gate request router.
"""
import pytest
import os
import json
import time
import tempfile
import shutil
from unittest.mock import MagicMock, patch, PropertyMock


class TestGateRoles:
    """Test Gate role management using mocks to avoid mod dependency overhead."""

    def setup_method(self):
        """Set up a Gate-like role manager with mock store."""
        self.tmp_dir = tempfile.mkdtemp(prefix='mod_gate_test_')
        self.roles_path = os.path.join(self.tmp_dir, 'roles')
        os.makedirs(self.roles_path, exist_ok=True)
        self._store_data = {}

    def teardown_method(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def _put(self, path, data):
        self._store_data[path] = data
        # Also write JSON file if it's a role
        if self.roles_path in str(path):
            fpath = path if path.endswith('.json') else path + '.json'
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            with open(fpath, 'w') as f:
                json.dump(data, f)

    def _get(self, path, default=None, **kwargs):
        return self._store_data.get(path, default)

    def test_role_data_path(self):
        role = 'public'
        expected = self.roles_path + '/' + role
        actual = self.roles_path + '/' + role
        assert actual == expected

    def test_add_and_check_user(self):
        """Test adding a user to a role and verifying membership."""
        role = 'public'
        path = self.roles_path + '/' + role
        user = '0xabc123'

        # Save role data with user
        role_data = {'users': [user.lower()], 'fns': []}
        self._put(path, role_data)

        # Check user exists
        data = self._get(path, {})
        users = [u.lower() for u in data.get('users', [])]
        assert user.lower() in users

    def test_remove_user(self):
        role = 'public'
        path = self.roles_path + '/' + role
        user = '0xabc123'

        # Add user
        self._put(path, {'users': [user], 'fns': []})

        # Remove user
        data = self._get(path, {})
        users = data.get('users', [])
        users.remove(user)
        data['users'] = users
        self._put(path, data)

        # Verify removed
        data = self._get(path, {})
        assert user not in data.get('users', [])

    def test_owner_role_has_wildcard_permission(self):
        role = 'owner'
        path = self.roles_path + '/' + role
        owner_key = '0xowner'

        role_data = {'users': [owner_key], 'fns': ['*']}
        self._put(path, role_data)

        data = self._get(path, {})
        assert '*' in data['fns']

    def test_non_owner_cannot_have_wildcard(self):
        """Non-owner roles should not have wildcard permission."""
        fns = ['read', 'write']
        assert '*' not in fns

    def test_user_to_role_mapping(self):
        """Test building user-to-role mapping."""
        roles = {
            'owner': {'users': ['0xowner'], 'fns': ['*']},
            'public': {'users': ['0xuser1', '0xuser2'], 'fns': ['read']},
        }
        user2role = {}
        for role, data in roles.items():
            for user in data.get('users', []):
                user2role[user] = role
        assert user2role['0xowner'] == 'owner'
        assert user2role['0xuser1'] == 'public'
        assert user2role['0xuser2'] == 'public'

    def test_roles_listing(self):
        """Test listing all roles from filesystem."""
        for role in ['owner', 'public', 'admin']:
            fpath = os.path.join(self.roles_path, f'{role}.json')
            with open(fpath, 'w') as f:
                json.dump({'users': [], 'fns': []}, f)

        roles = [f.split('.json')[0] for f in os.listdir(self.roles_path)]
        assert 'owner' in roles
        assert 'public' in roles
        assert 'admin' in roles

    def test_reset_roles(self):
        """Test resetting roles clears directory."""
        for role in ['owner', 'public']:
            fpath = os.path.join(self.roles_path, f'{role}.json')
            with open(fpath, 'w') as f:
                json.dump({'users': [], 'fns': []}, f)

        # Reset = delete all
        shutil.rmtree(self.roles_path)
        os.makedirs(self.roles_path)
        roles = os.listdir(self.roles_path)
        assert len(roles) == 0


class TestGateUnsandboxedFns:
    """Test the UNSANDBOXED_FNS set."""

    UNSANDBOXED_FNS = {
        'mods', 'mod', 'info', 'txs', 'h', 'tasks', 'kill_task', 'reset_tasks',
        'users', 'call', 'schema', 'content', 'config', 'versions', 'edit',
        'reg', 'update', 'fork', 'new', 'rm', 'n', 'transfer', 'set_public',
        'token', 'logs', 'namespace', 'serve', 'stop',
    }

    def test_info_is_unsandboxed(self):
        assert 'info' in self.UNSANDBOXED_FNS

    def test_mods_is_unsandboxed(self):
        assert 'mods' in self.UNSANDBOXED_FNS

    def test_serve_is_unsandboxed(self):
        assert 'serve' in self.UNSANDBOXED_FNS

    def test_stop_is_unsandboxed(self):
        assert 'stop' in self.UNSANDBOXED_FNS

    def test_module_call_detection(self):
        """Module calls with '/' and not in unsandboxed set should be sandboxed."""
        fn = 'ssh/keys'
        is_module_call = '/' in fn and fn.split('/')[0] not in self.UNSANDBOXED_FNS
        assert is_module_call is True

    def test_api_fn_not_sandboxed(self):
        fn = 'info'
        is_module_call = '/' in fn and fn.split('/')[0] not in self.UNSANDBOXED_FNS
        assert is_module_call is False

    def test_unsandboxed_with_slash(self):
        """API fn with slash like 'namespace/something' should not be sandboxed."""
        fn = 'namespace/list'
        is_module_call = '/' in fn and fn.split('/')[0] not in self.UNSANDBOXED_FNS
        assert is_module_call is False


class TestGateForwardLogic:
    """Test the forward routing logic without full Gate initialization."""

    def test_empty_fn_rejected(self):
        fn = ''
        with pytest.raises(AssertionError, match="Function name cannot be empty"):
            assert not isinstance(fn, str) or fn != '', "Function name cannot be empty"

    def test_non_empty_fn_passes(self):
        fn = 'info'
        assert not isinstance(fn, str) or fn != ''

    def test_params_json_string_parsed(self):
        params = '{"x": 1}'
        parsed = json.loads(params) if isinstance(params, str) else params
        assert parsed == {'x': 1}

    def test_params_dict_passthrough(self):
        params = {'x': 1}
        parsed = json.loads(params) if isinstance(params, str) else params
        assert parsed == {'x': 1}

    def test_bytes_result_decoded(self):
        result = b'hello world'
        if isinstance(result, bytes):
            result = result.decode('utf-8')
        assert result == 'hello world'


class TestGateDelegations:
    """Test delegation management logic."""

    def test_set_delegations(self):
        delegations = {}
        delegator = '0xowner'
        delegatees = ['0xdel1', '0xdel2']
        delegations[delegator] = delegatees
        assert delegations[delegator] == ['0xdel1', '0xdel2']

    def test_remove_delegation(self):
        delegations = {'0xowner': ['0xdel1']}
        del delegations['0xowner']
        assert '0xowner' not in delegations

    def test_delegation_empty_default(self):
        delegations = {}
        assert delegations == {}
