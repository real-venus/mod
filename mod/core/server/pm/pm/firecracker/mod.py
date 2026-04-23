"""
Firecracker microVM management for the mod framework.

Full lifecycle management of Firecracker microVMs with local (Linux/KVM)
and remote (SSH) execution modes.

Local mode:  Direct Firecracker API via Unix socket + subprocess
Remote mode: All commands tunneled through SSH to a Linux host

Usage:
    m pm/firecracker                          # status
    m pm/firecracker/create name=test         # create VM
    m pm/firecracker/list                     # list VMs
    m pm/firecracker/exec vm_id=abc cmd=ls    # run command in VM
    m pm/firecracker/stop vm_id=abc           # stop VM
    m pm/firecracker/delete vm_id=abc         # delete VM
"""

import fcntl
import json
import os
import random
import signal
import socket
import subprocess
import time
from pathlib import Path


class Mod:
    """Firecracker microVM manager with local/remote mode support."""

    description = 'Firecracker microVM lifecycle management'

    # ── Init ─────────────────────────────────────────────────────────

    def __init__(self, config=None, mode=None, remote_host=None, store_dir=None):
        self.module_dir = Path(__file__).parent
        self.config = config or self._load_config()

        self.mode = mode or self.config.get('mode', 'local')
        self.remote_host = remote_host or self.config.get('remote_host')

        self.store_dir = Path(store_dir) if store_dir else Path.home() / '.firecracker'
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self.registry_path = self.store_dir / 'vms.json'
        self.sockets_dir = self.store_dir / 'sockets'
        self.sockets_dir.mkdir(exist_ok=True)
        self.log_dir = self.store_dir / 'logs'
        self.log_dir.mkdir(exist_ok=True)

        self.kernel_image = self.config.get(
            'kernel_image', '/usr/local/share/firecracker/vmlinux.bin')
        self.rootfs_image = self.config.get(
            'rootfs_image', '/usr/local/share/firecracker/rootfs.ext4')
        self.network_config = self.config.get('network', {
            'tap_prefix': 'fc-tap',
            'subnet': '172.16.0.0/24',
            'gateway': '172.16.0.1',
        })

        self.prerequisites = self._check_prerequisites()
        self.prerequisites_ok = all(self.prerequisites.values())

        if self.mode == 'local':
            self._cleanup_dead_vms()

    # ── Public API ───────────────────────────────────────────────────

    def forward(self, **kwargs):
        return self.status()

    def health(self):
        return {
            'status': 'ok' if self.prerequisites_ok else 'degraded',
            'module': 'pm/firecracker',
            'mode': self.mode,
            'prerequisites': self.prerequisites,
            'vms': len(self._load_registry()),
        }

    def status(self):
        registry = self._load_registry()
        running = sum(1 for vm in registry.values()
                      if vm.get('status') == 'running')
        return {
            'module': 'pm/firecracker',
            'total_vms': len(registry),
            'running': running,
            'stopped': len(registry) - running,
            'mode': self.mode,
            'remote_host': self.remote_host if self.mode == 'remote' else None,
            'prerequisites': self.prerequisites,
        }

    def create(self, name, memory=512, vcpus=1, kernel=None, rootfs=None,
               ssh_port=None):
        """Create and start a new Firecracker microVM."""
        if not self.prerequisites_ok:
            return {'error': 'Prerequisites not met', 'checks': self.prerequisites}

        kernel = kernel or self.kernel_image
        rootfs = rootfs or self.rootfs_image

        # Validate images
        if self.mode == 'local':
            if not Path(kernel).exists():
                return {'error': f'Kernel not found: {kernel}'}
            if not Path(rootfs).exists():
                return {'error': f'Rootfs not found: {rootfs}'}

        vm_id = f'{name}-{int(time.time())}'
        socket_path = str(self.sockets_dir / f'{vm_id}.sock')
        log_path = str(self.log_dir / f'{vm_id}.log')

        if not ssh_port:
            ssh_port = self._find_free_port(start=2222)

        # Start firecracker process
        log_file = open(log_path, 'w')
        cmd = ['firecracker', '--api-sock', socket_path]
        if self.mode == 'remote':
            cmd = ['ssh', self.remote_host] + cmd

        try:
            proc = subprocess.Popen(
                cmd, stdout=log_file, stderr=subprocess.STDOUT)
        except FileNotFoundError:
            log_file.close()
            return {'error': 'firecracker binary not found'}

        if not self._wait_for_socket(socket_path, timeout=5):
            proc.kill()
            log_file.close()
            return {'error': 'Firecracker socket did not appear'}

        # Configure VM via API
        cfg_result = self._configure_vm(
            socket_path, memory, vcpus, kernel, rootfs, ssh_port)
        if 'error' in cfg_result:
            proc.kill()
            log_file.close()
            return cfg_result

        # Start VM
        start = self._api_call(
            socket_path, 'PUT', '/actions', {'action_type': 'InstanceStart'})
        if 'error' in start:
            proc.kill()
            log_file.close()
            return {'error': f'Failed to start VM: {start["error"]}'}

        # Register
        registry = self._load_registry()
        registry[vm_id] = {
            'id': vm_id,
            'name': name,
            'pid': proc.pid,
            'socket_path': socket_path,
            'log_path': log_path,
            'status': 'running',
            'created': time.time(),
            'memory': memory,
            'vcpus': vcpus,
            'kernel': kernel,
            'rootfs': rootfs,
            'ssh_port': ssh_port,
        }
        self._save_registry(registry)

        return {
            'success': True,
            'vm_id': vm_id,
            'pid': proc.pid,
            'socket_path': socket_path,
            'ssh_port': ssh_port,
        }

    def list(self):
        registry = self._load_registry()
        return {'vms': list(registry.values()), 'count': len(registry)}

    def get(self, vm_id):
        registry = self._load_registry()
        if vm_id not in registry:
            return {'error': f'VM not found: {vm_id}'}
        return registry[vm_id]

    def stop(self, vm_id):
        registry = self._load_registry()
        if vm_id not in registry:
            return {'error': f'VM not found: {vm_id}'}

        vm = registry[vm_id]
        pid = vm.get('pid')

        if pid and vm.get('status') == 'running':
            try:
                os.kill(pid, signal.SIGTERM)
                time.sleep(0.5)
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            except ProcessLookupError:
                pass

        vm['status'] = 'stopped'
        vm['stopped_at'] = time.time()
        registry[vm_id] = vm
        self._save_registry(registry)

        return {'success': True, 'vm_id': vm_id}

    def delete(self, vm_id):
        self.stop(vm_id)

        registry = self._load_registry()
        if vm_id not in registry:
            return {'success': True, 'vm_id': vm_id}

        vm = registry[vm_id]
        sock = vm.get('socket_path')
        if sock and Path(sock).exists():
            Path(sock).unlink()
        log = vm.get('log_path')
        if log and Path(log).exists():
            Path(log).unlink()

        del registry[vm_id]
        self._save_registry(registry)

        return {'success': True, 'vm_id': vm_id}

    def exec(self, vm_id, command):
        """Execute command in VM via SSH."""
        registry = self._load_registry()
        if vm_id not in registry:
            return {'error': f'VM not found: {vm_id}'}

        vm = registry[vm_id]
        ssh_port = vm.get('ssh_port')
        if not ssh_port:
            return {'error': 'VM has no SSH port configured'}

        host = self.remote_host if self.mode == 'remote' else 'localhost'
        ssh_cmd = [
            'ssh', '-p', str(ssh_port),
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'ConnectTimeout=5',
            f'root@{host}', command,
        ]

        result = subprocess.run(ssh_cmd, capture_output=True, text=True,
                                timeout=30)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode,
        }

    def logs(self, vm_id, lines=50):
        registry = self._load_registry()
        if vm_id not in registry:
            return {'error': f'VM not found: {vm_id}'}

        log_path = registry[vm_id].get('log_path')
        if not log_path or not Path(log_path).exists():
            return {'vm_id': vm_id, 'logs': ''}

        with open(log_path) as f:
            all_lines = f.readlines()
        return {
            'vm_id': vm_id,
            'logs': ''.join(all_lines[-lines:]),
        }

    # ── Config ───────────────────────────────────────────────────────

    def _load_config(self):
        cfg = self.module_dir / 'config.json'
        if cfg.exists():
            with open(cfg) as f:
                data = json.load(f)
            return data.get('data', data) if 'data' in data else data
        return {}

    # ── Prerequisites ────────────────────────────────────────────────

    def _check_prerequisites(self):
        checks = {}
        if self.mode == 'local':
            checks['kvm'] = os.path.exists('/dev/kvm')
            checks['firecracker'] = self._which('firecracker') is not None
            checks['kernel'] = Path(self.kernel_image).exists()
            checks['rootfs'] = Path(self.rootfs_image).exists()
        else:
            checks['ssh'] = self._test_ssh()
            if checks['ssh']:
                r = self._remote_run(['which', 'firecracker'])
                checks['firecracker'] = r.returncode == 0
            else:
                checks['firecracker'] = False
        return checks

    # ── Registry ─────────────────────────────────────────────────────

    def _load_registry(self):
        if not self.registry_path.exists():
            return {}
        with open(self.registry_path, 'r') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = {}
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        return data

    def _save_registry(self, registry):
        with open(self.registry_path, 'w') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            json.dump(registry, f, indent=2, default=str)
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    def _cleanup_dead_vms(self):
        registry = self._load_registry()
        dead = []
        for vm_id, vm in registry.items():
            pid = vm.get('pid')
            if pid and vm.get('status') == 'running':
                try:
                    os.kill(pid, 0)
                except (OSError, ProcessLookupError):
                    dead.append(vm_id)
        if dead:
            for vm_id in dead:
                registry[vm_id]['status'] = 'stopped'
            self._save_registry(registry)

    # ── Execution Layer ──────────────────────────────────────────────

    def _remote_run(self, cmd, **kw):
        return subprocess.run(
            ['ssh', self.remote_host] + cmd,
            capture_output=True, text=True, **kw)

    def _api_call(self, socket_path, method, endpoint, data=None):
        """HTTP call to Firecracker API via curl over Unix socket."""
        url = f'http://localhost{endpoint}'
        cmd = ['curl', '-s', '-X', method, '--unix-socket', socket_path, url]
        if data:
            cmd += ['-H', 'Content-Type: application/json',
                    '-d', json.dumps(data)]

        if self.mode == 'remote':
            cmd = ['ssh', self.remote_host] + cmd

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return {'error': result.stderr or 'curl failed'}
        if result.stdout:
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {'raw': result.stdout}
        return {'success': True}

    def _configure_vm(self, socket_path, memory, vcpus, kernel, rootfs,
                      ssh_port):
        """Sequence Firecracker API calls to configure a VM."""
        # Machine config
        r = self._api_call(socket_path, 'PUT', '/machine-config', {
            'vcpu_count': vcpus, 'mem_size_mib': memory})
        if 'error' in r:
            return r

        # Boot source
        r = self._api_call(socket_path, 'PUT', '/boot-source', {
            'kernel_image_path': kernel,
            'boot_args': 'console=ttyS0 reboot=k panic=1 pci=off'})
        if 'error' in r:
            return r

        # Root drive
        r = self._api_call(socket_path, 'PUT', '/drives/rootfs', {
            'drive_id': 'rootfs',
            'path_on_host': rootfs,
            'is_root_device': True,
            'is_read_only': False})
        if 'error' in r:
            return r

        # Network interface
        tap = f'{self.network_config.get("tap_prefix", "fc-tap")}-{ssh_port}'
        self._api_call(socket_path, 'PUT', '/network-interfaces/eth0', {
            'iface_id': 'eth0',
            'host_dev_name': tap,
            'guest_mac': self._generate_mac()})

        return {'success': True}

    # ── Helpers ──────────────────────────────────────────────────────

    def _which(self, cmd):
        r = subprocess.run(['which', cmd], capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else None

    def _test_ssh(self):
        if not self.remote_host:
            return False
        try:
            r = subprocess.run(
                ['ssh', '-o', 'ConnectTimeout=3', self.remote_host,
                 'echo', 'ok'],
                capture_output=True, text=True, timeout=5)
            return r.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def _wait_for_socket(self, socket_path, timeout=5):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if Path(socket_path).exists():
                return True
            time.sleep(0.1)
        return False

    def _find_free_port(self, start=2222):
        for port in range(start, start + 1000):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(('', port))
                    return port
                except OSError:
                    continue
        raise RuntimeError('No free ports available')

    def _generate_mac(self):
        mac = [0x02, 0x00, 0x00,
               random.randint(0x00, 0xff),
               random.randint(0x00, 0xff),
               random.randint(0x00, 0xff)]
        return ':'.join(f'{b:02x}' for b in mac)
