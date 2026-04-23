"""
Tests for pm/firecracker module.

Usage:
    cd ~/mod && python -m pytest mod/orbit/pm/firecracker/test/ -v
"""

import json
import os
import sys
import time
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, call

# Load Mod class from mod.py directly
import importlib.util

_mod_path = Path(__file__).resolve().parent.parent / 'mod.py'
_spec = importlib.util.spec_from_file_location('firecracker_mod', _mod_path)
_fc_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fc_module)
Mod = _fc_module.Mod


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def fc(tmp_path):
    """Create a Firecracker Mod instance with mocked prerequisites."""
    instance = object.__new__(Mod)
    instance.module_dir = Path(__file__).resolve().parent.parent
    instance.config = {
        'name': 'pm/firecracker',
        'mode': 'local',
        'kernel_image': '/tmp/vmlinux.bin',
        'rootfs_image': '/tmp/rootfs.ext4',
        'network': {'tap_prefix': 'fc-tap', 'subnet': '172.16.0.0/24',
                     'gateway': '172.16.0.1'},
    }
    instance.mode = 'local'
    instance.remote_host = None
    instance.store_dir = tmp_path / '.firecracker'
    instance.store_dir.mkdir(parents=True)
    instance.registry_path = instance.store_dir / 'vms.json'
    instance.sockets_dir = instance.store_dir / 'sockets'
    instance.sockets_dir.mkdir()
    instance.log_dir = instance.store_dir / 'logs'
    instance.log_dir.mkdir()
    instance.kernel_image = '/tmp/vmlinux.bin'
    instance.rootfs_image = '/tmp/rootfs.ext4'
    instance.network_config = {
        'tap_prefix': 'fc-tap', 'subnet': '172.16.0.0/24',
        'gateway': '172.16.0.1'}
    instance.prerequisites = {
        'kvm': True, 'firecracker': True,
        'kernel': True, 'rootfs': True}
    instance.prerequisites_ok = True
    return instance


@pytest.fixture
def fc_remote(fc):
    """Remote-mode instance."""
    fc.mode = 'remote'
    fc.remote_host = '10.0.1.5'
    fc.prerequisites = {'ssh': True, 'firecracker': True}
    fc.prerequisites_ok = True
    return fc


def _seed_registry(fc, vms):
    """Write VMs dict to the registry file."""
    with open(fc.registry_path, 'w') as f:
        json.dump(vms, f)


# ── TestHealth ───────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self, fc):
        r = fc.health()
        assert r['status'] == 'ok'
        assert r['module'] == 'pm/firecracker'
        assert r['mode'] == 'local'
        assert r['vms'] == 0

    def test_health_degraded(self, fc):
        fc.prerequisites_ok = False
        fc.prerequisites['kvm'] = False
        r = fc.health()
        assert r['status'] == 'degraded'
        assert r['prerequisites']['kvm'] is False

    def test_health_counts_vms(self, fc):
        _seed_registry(fc, {'vm1': {'id': 'vm1', 'status': 'running'}})
        r = fc.health()
        assert r['vms'] == 1


# ── TestStatus ───────────────────────────────────────────────────────

class TestStatus:
    def test_status_empty(self, fc):
        r = fc.status()
        assert r['module'] == 'pm/firecracker'
        assert r['total_vms'] == 0
        assert r['running'] == 0
        assert r['stopped'] == 0

    def test_status_counts(self, fc):
        _seed_registry(fc, {
            'a': {'status': 'running'},
            'b': {'status': 'running'},
            'c': {'status': 'stopped'},
        })
        r = fc.status()
        assert r['total_vms'] == 3
        assert r['running'] == 2
        assert r['stopped'] == 1

    def test_status_remote_shows_host(self, fc_remote):
        r = fc_remote.status()
        assert r['remote_host'] == '10.0.1.5'

    def test_status_local_hides_host(self, fc):
        r = fc.status()
        assert r['remote_host'] is None


# ── TestForward ──────────────────────────────────────────────────────

class TestForward:
    def test_forward_returns_status(self, fc):
        r = fc.forward()
        assert r['module'] == 'pm/firecracker'
        assert 'total_vms' in r


# ── TestRegistry ─────────────────────────────────────────────────────

class TestRegistry:
    def test_empty_registry(self, fc):
        assert fc._load_registry() == {}

    def test_save_and_load(self, fc):
        data = {'vm1': {'id': 'vm1', 'name': 'test', 'status': 'running'}}
        fc._save_registry(data)
        loaded = fc._load_registry()
        assert loaded == data

    def test_corrupt_registry(self, fc):
        fc.registry_path.write_text('not json')
        assert fc._load_registry() == {}

    def test_cleanup_dead_vms(self, fc):
        _seed_registry(fc, {
            'alive': {'pid': os.getpid(), 'status': 'running'},
            'dead': {'pid': 99999999, 'status': 'running'},
        })
        fc._cleanup_dead_vms()
        reg = fc._load_registry()
        assert reg['alive']['status'] == 'running'
        assert reg['dead']['status'] == 'stopped'

    def test_cleanup_skips_stopped(self, fc):
        _seed_registry(fc, {
            'stopped': {'pid': 99999999, 'status': 'stopped'},
        })
        fc._cleanup_dead_vms()
        reg = fc._load_registry()
        assert reg['stopped']['status'] == 'stopped'


# ── TestCreate ───────────────────────────────────────────────────────

class TestCreate:
    def test_create_fails_without_prerequisites(self, fc):
        fc.prerequisites_ok = False
        fc.prerequisites['kvm'] = False
        r = fc.create(name='test')
        assert 'error' in r
        assert 'Prerequisites' in r['error']

    @patch('builtins.open', create=True)
    @patch.object(Mod, '_find_free_port', return_value=2222)
    @patch.object(Mod, '_api_call', return_value={'success': True})
    @patch.object(Mod, '_wait_for_socket', return_value=True)
    @patch.object(Mod, '_save_registry')
    @patch.object(Mod, '_load_registry', return_value={})
    @patch('subprocess.Popen')
    def test_create_success(self, mock_popen, mock_load, mock_save,
                            mock_wait, mock_api, mock_port, mock_open, fc):
        mock_proc = MagicMock()
        mock_proc.pid = 42
        mock_popen.return_value = mock_proc

        # Kernel and rootfs exist
        with patch('pathlib.Path.exists', return_value=True):
            r = fc.create(name='web', memory=1024, vcpus=2)

        assert r['success'] is True
        assert r['pid'] == 42
        assert r['ssh_port'] == 2222
        assert 'web-' in r['vm_id']

        # Verify registry was saved
        assert mock_save.called
        saved = mock_save.call_args[0][0]
        vm_id = r['vm_id']
        assert saved[vm_id]['name'] == 'web'
        assert saved[vm_id]['memory'] == 1024
        assert saved[vm_id]['vcpus'] == 2

    def test_create_missing_kernel(self, fc):
        fc.kernel_image = '/nonexistent/vmlinux.bin'
        r = fc.create(name='test')
        assert 'error' in r
        assert 'Kernel not found' in r['error']

    def test_create_missing_rootfs(self, fc):
        fc.rootfs_image = '/nonexistent/rootfs.ext4'
        with patch('pathlib.Path.exists', side_effect=lambda: True):
            # kernel exists, rootfs doesn't
            def exists_side(self=None):
                return True
            with patch.object(Path, 'exists') as mock_exists:
                mock_exists.side_effect = [True, False]  # kernel ok, rootfs not
                r = fc.create(name='test', kernel='/tmp/vmlinux.bin',
                              rootfs='/nonexistent/rootfs.ext4')
        assert 'error' in r
        assert 'Rootfs not found' in r['error']

    @patch('builtins.open', create=True)
    @patch.object(Mod, '_find_free_port', return_value=2222)
    @patch.object(Mod, '_wait_for_socket', return_value=False)
    @patch('subprocess.Popen')
    def test_create_socket_timeout(self, mock_popen, mock_wait,
                                   mock_port, mock_open, fc):
        mock_proc = MagicMock()
        mock_proc.pid = 42
        mock_popen.return_value = mock_proc

        with patch('pathlib.Path.exists', return_value=True):
            r = fc.create(name='test')

        assert 'error' in r
        assert 'socket' in r['error'].lower()
        mock_proc.kill.assert_called_once()

    @patch('builtins.open', create=True)
    @patch.object(Mod, '_find_free_port', return_value=2222)
    @patch.object(Mod, '_configure_vm', return_value={'error': 'config fail'})
    @patch.object(Mod, '_wait_for_socket', return_value=True)
    @patch('subprocess.Popen')
    def test_create_config_failure(self, mock_popen, mock_wait,
                                   mock_cfg, mock_port, mock_open, fc):
        mock_proc = MagicMock()
        mock_proc.pid = 42
        mock_popen.return_value = mock_proc

        with patch('pathlib.Path.exists', return_value=True):
            r = fc.create(name='test')

        assert 'error' in r
        assert r['error'] == 'config fail'
        mock_proc.kill.assert_called_once()


# ── TestList ─────────────────────────────────────────────────────────

class TestList:
    def test_list_empty(self, fc):
        r = fc.list()
        assert r['count'] == 0
        assert r['vms'] == []

    def test_list_populated(self, fc):
        _seed_registry(fc, {
            'vm1': {'id': 'vm1', 'name': 'a'},
            'vm2': {'id': 'vm2', 'name': 'b'},
        })
        r = fc.list()
        assert r['count'] == 2
        assert len(r['vms']) == 2


# ── TestGet ──────────────────────────────────────────────────────────

class TestGet:
    def test_get_found(self, fc):
        _seed_registry(fc, {'vm1': {'id': 'vm1', 'name': 'web'}})
        r = fc.get('vm1')
        assert r['name'] == 'web'

    def test_get_not_found(self, fc):
        r = fc.get('nonexistent')
        assert 'error' in r


# ── TestStop ─────────────────────────────────────────────────────────

class TestStop:
    def test_stop_not_found(self, fc):
        r = fc.stop('nonexistent')
        assert 'error' in r

    @patch('os.kill')
    def test_stop_running(self, mock_kill, fc):
        _seed_registry(fc, {
            'vm1': {'id': 'vm1', 'pid': 12345, 'status': 'running'}
        })
        r = fc.stop('vm1')
        assert r['success'] is True
        reg = fc._load_registry()
        assert reg['vm1']['status'] == 'stopped'
        assert 'stopped_at' in reg['vm1']

    def test_stop_already_stopped(self, fc):
        _seed_registry(fc, {
            'vm1': {'id': 'vm1', 'pid': 12345, 'status': 'stopped'}
        })
        r = fc.stop('vm1')
        assert r['success'] is True

    @patch('os.kill', side_effect=ProcessLookupError)
    def test_stop_dead_process(self, mock_kill, fc):
        _seed_registry(fc, {
            'vm1': {'id': 'vm1', 'pid': 99999999, 'status': 'running'}
        })
        r = fc.stop('vm1')
        assert r['success'] is True


# ── TestDelete ───────────────────────────────────────────────────────

class TestDelete:
    @patch('os.kill')
    def test_delete_removes_from_registry(self, mock_kill, fc):
        sock = fc.sockets_dir / 'vm1.sock'
        sock.touch()
        log = fc.log_dir / 'vm1.log'
        log.touch()
        _seed_registry(fc, {
            'vm1': {
                'id': 'vm1', 'pid': 12345, 'status': 'running',
                'socket_path': str(sock), 'log_path': str(log)
            }
        })
        r = fc.delete('vm1')
        assert r['success'] is True
        assert fc._load_registry() == {}
        assert not sock.exists()
        assert not log.exists()

    def test_delete_nonexistent(self, fc):
        r = fc.delete('nonexistent')
        assert r['success'] is True

    @patch('os.kill')
    def test_delete_no_socket_file(self, mock_kill, fc):
        _seed_registry(fc, {
            'vm1': {
                'id': 'vm1', 'pid': 12345, 'status': 'stopped',
                'socket_path': '/tmp/gone.sock', 'log_path': '/tmp/gone.log'
            }
        })
        r = fc.delete('vm1')
        assert r['success'] is True
        assert fc._load_registry() == {}


# ── TestExec ─────────────────────────────────────────────────────────

class TestExec:
    def test_exec_not_found(self, fc):
        r = fc.exec('nonexistent', 'ls')
        assert 'error' in r

    def test_exec_no_ssh_port(self, fc):
        _seed_registry(fc, {'vm1': {'id': 'vm1'}})
        r = fc.exec('vm1', 'ls')
        assert 'error' in r
        assert 'SSH port' in r['error']

    @patch('subprocess.run')
    def test_exec_success(self, mock_run, fc):
        _seed_registry(fc, {'vm1': {'id': 'vm1', 'ssh_port': 2222}})
        mock_run.return_value = MagicMock(
            returncode=0, stdout='hello\n', stderr='')
        r = fc.exec('vm1', 'echo hello')
        assert r['success'] is True
        assert r['stdout'] == 'hello\n'
        assert r['returncode'] == 0

        # Verify SSH command
        cmd = mock_run.call_args[0][0]
        assert cmd[0] == 'ssh'
        assert '-p' in cmd
        assert '2222' in cmd
        assert 'root@localhost' in cmd
        assert 'echo hello' in cmd

    @patch('subprocess.run')
    def test_exec_failure(self, mock_run, fc):
        _seed_registry(fc, {'vm1': {'id': 'vm1', 'ssh_port': 2222}})
        mock_run.return_value = MagicMock(
            returncode=1, stdout='', stderr='command not found')
        r = fc.exec('vm1', 'badcmd')
        assert r['success'] is False
        assert r['returncode'] == 1

    @patch('subprocess.run')
    def test_exec_remote_mode(self, mock_run, fc_remote):
        _seed_registry(fc_remote, {'vm1': {'id': 'vm1', 'ssh_port': 2222}})
        mock_run.return_value = MagicMock(
            returncode=0, stdout='ok', stderr='')
        r = fc_remote.exec('vm1', 'uname')
        cmd = mock_run.call_args[0][0]
        assert 'root@10.0.1.5' in cmd


# ── TestLogs ─────────────────────────────────────────────────────────

class TestLogs:
    def test_logs_not_found(self, fc):
        r = fc.logs('nonexistent')
        assert 'error' in r

    def test_logs_no_file(self, fc):
        _seed_registry(fc, {'vm1': {'id': 'vm1', 'log_path': '/tmp/nope.log'}})
        r = fc.logs('vm1')
        assert r['logs'] == ''

    def test_logs_reads_file(self, fc):
        log = fc.log_dir / 'vm1.log'
        log.write_text('line1\nline2\nline3\nline4\nline5\n')
        _seed_registry(fc, {'vm1': {'id': 'vm1', 'log_path': str(log)}})
        r = fc.logs('vm1', lines=3)
        assert 'line3' in r['logs']
        assert 'line4' in r['logs']
        assert 'line5' in r['logs']


# ── TestRemoteMode ───────────────────────────────────────────────────

class TestRemoteMode:
    @patch('subprocess.run')
    def test_remote_run(self, mock_run, fc_remote):
        mock_run.return_value = MagicMock(
            returncode=0, stdout='ok', stderr='')
        r = fc_remote._remote_run(['which', 'firecracker'])
        cmd = mock_run.call_args[0][0]
        assert cmd[0] == 'ssh'
        assert cmd[1] == '10.0.1.5'
        assert cmd[2:] == ['which', 'firecracker']

    @patch('subprocess.run')
    def test_api_call_remote(self, mock_run, fc_remote):
        mock_run.return_value = MagicMock(
            returncode=0, stdout='{"success": true}', stderr='')
        r = fc_remote._api_call('/tmp/test.sock', 'GET', '/machine-config')
        cmd = mock_run.call_args[0][0]
        assert cmd[0] == 'ssh'
        assert cmd[1] == '10.0.1.5'
        assert 'curl' in cmd

    @patch('subprocess.run')
    def test_ssh_connection_ok(self, mock_run, fc_remote):
        mock_run.return_value = MagicMock(returncode=0, stdout='ok', stderr='')
        assert fc_remote._test_ssh() is True

    @patch('subprocess.run')
    def test_ssh_connection_fail(self, mock_run, fc_remote):
        mock_run.return_value = MagicMock(returncode=1, stdout='', stderr='err')
        assert fc_remote._test_ssh() is False

    def test_ssh_no_host(self, fc):
        fc.mode = 'remote'
        fc.remote_host = None
        assert fc._test_ssh() is False


# ── TestHelpers ──────────────────────────────────────────────────────

class TestHelpers:
    def test_generate_mac(self, fc):
        mac = fc._generate_mac()
        parts = mac.split(':')
        assert len(parts) == 6
        assert parts[0] == '02'  # locally administered
        assert all(len(p) == 2 for p in parts)

    def test_generate_mac_unique(self, fc):
        macs = {fc._generate_mac() for _ in range(50)}
        assert len(macs) > 1  # statistically should be all unique

    def test_wait_for_socket_exists(self, fc):
        sock = fc.sockets_dir / 'test.sock'
        sock.touch()
        assert fc._wait_for_socket(str(sock), timeout=1) is True

    def test_wait_for_socket_timeout(self, fc):
        assert fc._wait_for_socket('/tmp/noexist.sock', timeout=0.2) is False

    @patch('socket.socket')
    def test_find_free_port(self, mock_socket_cls, fc):
        mock_sock = MagicMock()
        mock_socket_cls.return_value.__enter__ = MagicMock(
            return_value=mock_sock)
        mock_socket_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_sock.bind.return_value = None

        port = fc._find_free_port(start=3000)
        assert port == 3000

    @patch('subprocess.run')
    def test_which_found(self, mock_run, fc):
        mock_run.return_value = MagicMock(
            returncode=0, stdout='/usr/bin/firecracker')
        assert fc._which('firecracker') == '/usr/bin/firecracker'

    @patch('subprocess.run')
    def test_which_not_found(self, mock_run, fc):
        mock_run.return_value = MagicMock(returncode=1, stdout='')
        assert fc._which('firecracker') is None


# ── TestAPICall ──────────────────────────────────────────────────────

class TestAPICall:
    @patch('subprocess.run')
    def test_api_call_success(self, mock_run, fc):
        mock_run.return_value = MagicMock(
            returncode=0, stdout='{"status": "ok"}', stderr='')
        r = fc._api_call('/tmp/test.sock', 'GET', '/machine-config')
        assert r == {'status': 'ok'}

    @patch('subprocess.run')
    def test_api_call_with_data(self, mock_run, fc):
        mock_run.return_value = MagicMock(
            returncode=0, stdout='', stderr='')
        r = fc._api_call('/tmp/test.sock', 'PUT', '/machine-config',
                         {'vcpu_count': 2, 'mem_size_mib': 512})
        assert r == {'success': True}
        cmd = mock_run.call_args[0][0]
        assert '-d' in cmd

    @patch('subprocess.run')
    def test_api_call_curl_error(self, mock_run, fc):
        mock_run.return_value = MagicMock(
            returncode=7, stdout='', stderr='Connection refused')
        r = fc._api_call('/tmp/test.sock', 'GET', '/machine-config')
        assert 'error' in r

    @patch('subprocess.run')
    def test_api_call_non_json(self, mock_run, fc):
        mock_run.return_value = MagicMock(
            returncode=0, stdout='not json', stderr='')
        r = fc._api_call('/tmp/test.sock', 'GET', '/something')
        assert r == {'raw': 'not json'}


# ── TestConfigureVM ──────────────────────────────────────────────────

class TestConfigureVM:
    @patch.object(Mod, '_api_call', return_value={'success': True})
    def test_configure_all_steps(self, mock_api, fc):
        r = fc._configure_vm('/tmp/test.sock', 512, 2,
                             '/tmp/kernel', '/tmp/rootfs', 2222)
        assert r == {'success': True}
        assert mock_api.call_count == 4  # machine, boot, drive, network

        calls = [c[0] for c in mock_api.call_args_list]
        assert calls[0][2] == '/machine-config'
        assert calls[1][2] == '/boot-source'
        assert calls[2][2] == '/drives/rootfs'
        assert calls[3][2] == '/network-interfaces/eth0'

    @patch.object(Mod, '_api_call')
    def test_configure_stops_on_error(self, mock_api, fc):
        mock_api.side_effect = [
            {'success': True},       # machine-config ok
            {'error': 'bad kernel'},  # boot-source fails
        ]
        r = fc._configure_vm('/tmp/test.sock', 512, 2,
                             '/tmp/kernel', '/tmp/rootfs', 2222)
        assert r == {'error': 'bad kernel'}
        assert mock_api.call_count == 2  # stopped after boot-source
