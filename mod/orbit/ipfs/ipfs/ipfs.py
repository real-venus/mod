import requests
import os
import json
import subprocess
import platform
import sys
from typing import Optional, Dict, Any, List
from pathlib import Path
import time
import threading
import mod as m

class  IpfsClient:

    prefix = 'ipfs'
    endpoints = ['pin', 'add_mod', 'reg', 'mod', 'pins']
    """Simple IPFS client using requests library only."""
    node_name = 'ipfs.node'
    connected = False
    _health_thread = None
    _stop_health = False
    _daemon_proc = None
    _pidfile = os.path.expanduser('~/.ipfs/daemon.pid')
    _timeout = 10
    _shared_url = None  # class-level connection cache

    def __init__(self, url: str = None, autostart: bool = True):
        cls = type(self)
        if not url and cls._shared_url:
            self.url = cls._shared_url
            self.connected = True
            return
        if autostart:
            self.ensure_ipfs_running()
        self.set_conn(url)
        cls._shared_url = self.url

    def _post(self, path: str, **kwargs):
        """Make a POST request to the IPFS API with timeout."""
        kwargs.setdefault('timeout', self._timeout)
        return requests.post(f"{self.url}{path}", **kwargs)

    def _post_stream_json(self, path: str, **kwargs):
        """POST to IPFS streaming endpoint, read first JSON line and close."""
        kwargs.setdefault('timeout', self._timeout)
        kwargs['stream'] = True
        resp = requests.post(f"{self.url}{path}", **kwargs)
        resp.raise_for_status()
        # Read first line (IPFS streams newline-delimited JSON)
        for line in resp.iter_lines():
            if line:
                resp.close()
                return json.loads(line)
        resp.close()
        raise ValueError("Empty response from IPFS")

    def _background_connect(self, url: str = None):
        """Try to establish the initial connection in the background."""
        try:
            self.set_conn(url)
            id = self.id()
            self.connected = True
            print(f"[ipfs] connected {id}")
        except Exception as e:
            self.connected = False
            print(f"[ipfs] background connect failed: {e}")

    def _start_health_check(self, interval: int = 30):
        """Start a daemon thread that periodically checks IPFS connectivity."""
        if self._health_thread and self._health_thread.is_alive():
            return
        self._stop_health = False
        self._health_thread = threading.Thread(
            target=self._health_loop, args=(interval,), daemon=True
        )
        self._health_thread.start()

    def _health_loop(self, interval: int):
        """Periodically ping the IPFS node; reconnect if down."""
        while not self._stop_health:
            try:
                self.id()
                if not self.connected:
                    print("[ipfs] reconnected")
                self.connected = True
            except Exception:
                if self.connected:
                    print("[ipfs] connection lost, will retry...")
                self.connected = False
                try:
                    self.set_conn(None)
                    self.id()
                    self.connected = True
                    print("[ipfs] reconnected")
                except Exception:
                    pass
            time.sleep(interval)

    def stop_health_check(self):
        """Stop the background health-check thread."""
        self._stop_health = True

    def _is_api_up(self, host='127.0.0.1', timeout=2):
        """Check if the IPFS API is responding."""
        try:
            r = requests.post(f'http://{host}:5001/api/v0/id', timeout=timeout)
            r.raise_for_status()
            return True
        except Exception:
            return False

    def ensure_ipfs_running(self):
        """Ensure that the IPFS daemon is running, start it if not."""
        if self._is_api_up():
            return True
        print("[ipfs] node not running, starting daemon...")
        if self.start_node():
            for _ in range(10):
                time.sleep(1)
                if self._is_api_up():
                    print("[ipfs] node is ready")
                    return True
            print("[ipfs] daemon started but API not responding yet")
            return False
        print("[ipfs] failed to start daemon")
        return False

    def set_conn(self, url: str = None, host_options=None, timeout=3):
        if host_options is None:
            host_options = ['127.0.0.1', '0.0.0.0']
        for host in host_options:
            _url = str(url or f"http://{host}:5001/api/v0")
            try:
                resp = requests.post(f"{_url}/id", timeout=timeout)
                resp.raise_for_status()
                self.url = _url
                self.connected = True
                print(f"[ipfs] connected to {self.url}")
                return self.url
            except Exception as e:
                pass
        raise ConnectionError("[ipfs] failed to connect to any IPFS node")

    def add_file(self, file_path: str) -> Dict[str, Any]:
        """Add a single file to IPFS."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f)}
            return self._post_stream_json('/add', files=files)

    def put(self, data: Dict[str, Any] = None, pin=True) -> Dict[str, Any]:
        """Add a JSON object to IPFS and return its CID."""
        json_str = json.dumps(data)
        files = {'file': ('data.json', json_str)}
        # IPFS /add pins by default; pass pin=false to skip
        params = {} if pin else {'pin': 'false'}
        result = self._post_stream_json('/add', files=files, params=params)
        return result["Hash"]
    add = put

    def rm(self, cid: str) -> Dict[str, Any]:
        """Remove (unpin) content from IPFS by its hash."""
        try:
            self.pin_rm(cid)
        except Exception as e:
            print(f"Error unpinning {cid}: {e}")
        return {"Status": "Removed"}

    def get(self, cid: str) -> Dict[str, Any]:
        """Retrieve a JSON object from IPFS by its hash."""
        if not isinstance(cid, str):
            return cid
        if cid.startswith(self.prefix + '/'):
            cid = cid[len(self.prefix) + 1:]
        content = self.get_file(cid)
        return json.loads(content)

    def resolve_cid(self, ipfs_path: str) -> str:
        return ipfs_path.replace(self.prefix + '/', '')

    def get_file(self, cid: str) -> bytes:
        """Retrieve a file from IPFS by its hash."""
        cid = self.resolve_cid(cid)
        response = self._post('/cat', params={'arg': cid})
        response.raise_for_status()
        return response.content

    def cid(self, data: Dict[str, Any] = None) -> str:
        """Add data to IPFS and return its CID (without pinning)."""
        return self.add(data, pin=False)

    def cat(self, cid: str) -> bytes:
        """Retrieve content from IPFS by hash."""
        response = self._post('/cat', params={'arg': cid})
        response.raise_for_status()
        return response.content

    def pin_add(self, cid: str) -> Dict[str, Any]:
        """Pin content to local IPFS node."""
        response = self._post('/pin/add', params={'arg': cid}, timeout=60)
        response.raise_for_status()
        return response.json()

    def pin_rm(self, cid: str) -> Dict[str, Any]:
        """Unpin content from local IPFS node."""
        response = self._post('/pin/rm', params={'arg': cid}, timeout=30)
        response.raise_for_status()
        return response.json()

    def pinned(self, cid: str) -> bool:
        """Check if content is pinned on local IPFS node."""
        pins = self.pins()
        return cid in pins.get('Keys', {})

    def pins(self, cid: str = None) -> Dict[str, Any]:
        """List pinned content on local IPFS node."""
        params = {}
        if cid:
            params['arg'] = cid
        response = self._post('/pin/ls', params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        if cid:
            keys = data.get('Keys', {})
            return {cid: keys.get(cid)} if cid in keys else {}
        return data

    def _rm_all_pins(self) -> None:
        """Unpin all content from local IPFS node."""
        pins = self.pins()
        for cid in pins.get('Keys', {}).keys():
            print(f"Unpinning CID: {cid}")
            try:
                self.pin_rm(cid)
            except Exception as e:
                print(f"Error unpinning {cid}: {e}")

    # --- Node management (subprocess, no Docker/pm2) ---

    kubo_version = 'v0.40.1'

    def _read_pid(self):
        """Read the daemon PID from the pidfile."""
        try:
            with open(self._pidfile) as f:
                return int(f.read().strip())
        except Exception:
            return None

    def _write_pid(self, pid):
        os.makedirs(os.path.dirname(self._pidfile), exist_ok=True)
        with open(self._pidfile, 'w') as f:
            f.write(str(pid))

    def _is_pid_alive(self, pid):
        if pid is None:
            return False
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

    def start_node(self):
        """Install IPFS if needed and start ipfs daemon as a background process."""
        # Check if already running
        pid = self._read_pid()
        if self._is_pid_alive(pid):
            print(f"[ipfs] daemon already running (pid {pid})")
            return True
        self.install()
        ipfs_path = os.path.expanduser('~/.ipfs')
        if not os.path.exists(ipfs_path):
            subprocess.run(['ipfs', 'init'], capture_output=True)
        # Start daemon as detached subprocess
        log = open(os.path.expanduser('~/.ipfs/daemon.log'), 'a')
        env = os.environ.copy()
        env['IPFS_PATH'] = ipfs_path
        proc = subprocess.Popen(
            ['ipfs', 'daemon'],
            stdout=log, stderr=log,
            env=env,
            start_new_session=True,
        )
        self._daemon_proc = proc
        self._write_pid(proc.pid)
        print(f"[ipfs] daemon started (pid {proc.pid})")
        return True

    def stop_node(self):
        """Stop the IPFS daemon."""
        pid = self._read_pid()
        if pid and self._is_pid_alive(pid):
            import signal
            os.kill(pid, signal.SIGTERM)
            print(f"[ipfs] daemon stopped (pid {pid})")
            try:
                os.remove(self._pidfile)
            except OSError:
                pass
            return True
        # Fallback: kill any ipfs daemon
        subprocess.run(['pkill', '-f', 'ipfs daemon'], capture_output=True)
        print("[ipfs] daemon stopped (pkill)")
        return True

    def restart_node(self):
        """Restart the IPFS daemon."""
        self.stop_node()
        time.sleep(1)
        return self.start_node()

    def node_status(self):
        """Check if the IPFS daemon is running."""
        pid = self._read_pid()
        if self._is_pid_alive(pid):
            return 'online'
        return 'offline'

    def install(self):
        """Install IPFS (Kubo) if not already installed."""
        if self.ipfs_installed():
            return True
        print("Installing IPFS (Kubo)...")
        system = platform.system().lower()
        machine = platform.machine().lower()
        arch_map = {
            'x86_64': 'amd64', 'amd64': 'amd64',
            'aarch64': 'arm64', 'arm64': 'arm64',
        }
        arch = arch_map.get(machine, machine)
        try:
            if system == 'darwin':
                self._install_macos(arch)
            elif system == 'linux':
                self._install_linux(arch)
            elif system == 'windows':
                self._install_windows(arch)
            else:
                print(f"Unsupported platform: {system}")
                return False
            subprocess.run(['ipfs', 'init'], capture_output=True)
            print("IPFS installed and initialized.")
            return True
        except Exception as e:
            print(f"Failed to install IPFS: {e}")
            return False

    def _install_macos(self, arch):
        tarball = f'kubo_{self.kubo_version}_darwin-{arch}.tar.gz'
        url = f'https://dist.ipfs.tech/kubo/{self.kubo_version}/{tarball}'
        tmp = '/tmp/kubo_install'
        os.makedirs(tmp, exist_ok=True)
        subprocess.run(['curl', '-L', '-o', f'{tmp}/{tarball}', url], check=True)
        subprocess.run(['tar', '-xzf', f'{tmp}/{tarball}', '-C', tmp], check=True)
        subprocess.run(['sudo', 'bash', f'{tmp}/kubo/install.sh'], check=True)
        subprocess.run(['rm', '-rf', tmp])

    def _install_linux(self, arch):
        tarball = f'kubo_{self.kubo_version}_linux-{arch}.tar.gz'
        url = f'https://dist.ipfs.tech/kubo/{self.kubo_version}/{tarball}'
        tmp = '/tmp/kubo_install'
        os.makedirs(tmp, exist_ok=True)
        subprocess.run(['curl', '-L', '-o', f'{tmp}/{tarball}', url], check=True)
        subprocess.run(['tar', '-xzf', f'{tmp}/{tarball}', '-C', tmp], check=True)
        subprocess.run(['sudo', 'bash', f'{tmp}/kubo/install.sh'], check=True)
        subprocess.run(['rm', '-rf', tmp])

    def _install_windows(self, arch):
        zipname = f'kubo_{self.kubo_version}_windows-{arch}.zip'
        url = f'https://dist.ipfs.tech/kubo/{self.kubo_version}/{zipname}'
        tmp = os.path.join(os.environ.get('TEMP', 'C:\\Temp'), 'kubo_install')
        os.makedirs(tmp, exist_ok=True)
        zip_path = os.path.join(tmp, zipname)
        subprocess.run(['powershell', '-Command', f"Invoke-WebRequest -Uri '{url}' -OutFile '{zip_path}'"], check=True)
        subprocess.run(['powershell', '-Command', f"Expand-Archive -Path '{zip_path}' -DestinationPath '{tmp}' -Force"], check=True)
        install_dir = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'ipfs')
        os.makedirs(install_dir, exist_ok=True)
        src = os.path.join(tmp, 'kubo', 'ipfs.exe')
        dst = os.path.join(install_dir, 'ipfs.exe')
        subprocess.run(['copy', src, dst], shell=True, check=True)
        current_path = os.environ.get('PATH', '')
        if install_dir not in current_path:
            subprocess.run(['setx', 'PATH', f'{current_path};{install_dir}'], check=True)
            os.environ['PATH'] = f'{current_path};{install_dir}'
        subprocess.run(['rmdir', '/s', '/q', tmp], shell=True)

    def ipfs_installed(self):
        """Check if the ipfs binary is available."""
        try:
            subprocess.run(['ipfs', '--version'], capture_output=True, check=True)
            return True
        except Exception:
            return False

    def iscid(self, text: str = 'fsd') -> bool:
        """Check if the text is an IPFS hash."""
        return isinstance(text, str) and (text.startswith('Qm') and len(text) == 46)

    def id(self) -> Dict[str, Any]:
        """Get IPFS node identity information."""
        response = self._post('/id')
        response.raise_for_status()
        return response.json()

    def version(self) -> Dict[str, Any]:
        """Get IPFS version information."""
        response = self._post('/version')
        response.raise_for_status()
        return response.json()

    def test(self) -> bool:
        """Test connection to IPFS node by adding and retrieving test data."""
        test_obj = {"test_key": "test_value"}
        print("Testing IPFS data connection...", test_obj)
        cid = self.add(test_obj)
        retrieved_obj = self.get(cid)
        return retrieved_obj == test_obj

    def __str__(self):
        return f"IpfsClient(url={self.url})"

    def valid_cid(self, cid: str) -> bool:
        """Validate if a string is a valid IPFS CID."""
        try:
            self.get(cid)
            return True
        except Exception:
            return False
