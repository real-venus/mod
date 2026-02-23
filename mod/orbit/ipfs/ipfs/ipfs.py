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

    def __init__(self, url: str = None):
        # self.ensure_ipfs_running()
        self.set_conn(url)

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
                # Try to re-establish connection
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

    def ensure_ipfs_running(self):
        """Ensure that the IPFS node is running, start it if not."""
        try:
            self.id()  # Try to get node ID to check if it's running
            print("IPFS node is running.")
        except Exception:
            print("IPFS node is not running. Attempting to start it...")
            if self.start_node():
                # Wait a moment for the node to start
                time.sleep(5)
                try:
                    self.id()
                    print("IPFS node started successfully.")
                except Exception as e:
                    print(f"Failed to connect to IPFS node after starting: {e}")
            else:
                print("Failed to start IPFS node.")

    sessions = {}

    @property
    def session(self):
        return self.sessions[self.url]
    
    def set_conn(self, url: str ,  host_options = [ '0.0.0.0', node_name], timeout=1): 
        t0 = time.time()
        for host in host_options:
            _url = str(url or f"http://{host}:5001/api/v0")
            if _url in self.sessions:
                self.url = _url
                break
        if not hasattr(self, 'url'):
            for host in host_options:
                _url = str(url or f"http://{host}:5001/api/v0")
                try:
                    self.url = _url
                    self.sessions[_url] = requests.Session()
                    self.id()
                    break
                except Exception as e: 
                    self.sessions.pop(_url, None)
                    print(f"Could not connect to IPFS node at {_url}, trying next option {m.detailed_error(e)}.")
                    pass
        t1 = time.time()
        print(f"Connection {self.url} took {t1 - t0:.2f} seconds.")

        return self.url
    
    def add_file(self, file_path: str) -> Dict[str, Any]:
        """Add a single file to IPFS.
        
        Args:
            file_path: Path to the file to add
            
        Returns:
            Dictionary with IPFS hash and other metadata
        """
        url = f"{self.url}/add"
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f)}
            response = self.session.post(url, files=files)
            response.raise_for_status()
            return response.json()

    def add(self, data: Dict[str, Any] = None, pin=True) -> Dict[str, Any]:
        """Add a JSON object to IPFS.
        
        Args:
            data: Dictionary to add as JSON
            
        Returns:
            Dictionary with IPFS hash and other metadata
        """
        url = f"{self.url}/add"
        json_str = json.dumps(data)
        files = {'file': ('data.json', json_str)}
        response = self.session.post(url, files=files)
        response.raise_for_status()
        cid =  response.json()["Hash"]
        if pin:
            self.pin_add(cid)
        return cid
    put = add
    def rm(self, cid: str) -> Dict[str, Any]:
        """Remove a JSON object from IPFS by its hash.
        
        Args:
            cid: IPFS hash of the JSON object
        Returns:
            Dictionary with removal status
        """
        try:
            self.pin_rm(cid)
        except Exception as e:
            print(f"Error unpinning {cid}: {e}")
        return {"Status": "Removed"}

    def get(self, cid: str) -> Dict[str, Any]:
        """Retrieve a JSON object from IPFS by its hash.
        
        Args:
            cid: IPFS hash of the JSON object
        Returns:
            Dictionary with the JSON content
        """
        if not isinstance(cid, str):
            return cid
        if cid.startswith(self.prefix + '/'):
            cid = cid[len(self.prefix) + 1 :]
        content = self.get_file(cid)
        return json.loads(content)

    def resolve_cid(self, ipfs_path: str) -> str:
        return ipfs_path.replace(self.prefix + '/', '')

    def get_file(self, cid: str) -> bytes:
        """Retrieve a file from IPFS by its hash.
        
        Args:
            cid: IPFS hash of the file
        Returns:
            File content as bytes
        """
        cid = self.resolve_cid(cid)
        url = f"{self.url}/cat"
        params = {'arg': cid}
        response = self.session.post(url, params=params)
        response.raise_for_status()
        return response.content

    def cid(self, data: Dict[str, Any] = None) -> str:
        """Add data to IPFS and return its CID.
        
        Args:
            data: Dictionary to add as JSON 

        """
        return self.add(data, pin=False)

    def cat(self, cid: str) -> bytes:
        """Retrieve content from IPFS by hash.
        
        Args:
            cid: IPFS hash of the content
            
        Returns:
            Content as bytes
        """
        url = f"{self.url}/cat"
        params = {'arg': cid}
        response = self.session.post(url, params=params)
        response.raise_for_status()
        return response.content
    
        
        return {'success': True, 'path': output_path}

    def pin_rm(self, cid: str) -> Dict[str, Any]:
        """Unpin content from local IPFS node.
        
        Args:
            cid: IPFS hash to unpin
        Returns:
            Dictionary with unpin status

        """
        url = f"{self.url}/pin/rm"
        params = {'arg': cid}
        response = self.session.post(url, params=params)
        response.raise_for_status()
        return response.json()
    def pinned(self, cid: str) -> bool:
        """Check if content is pinned on local IPFS node.
        
        Args:
            cid: IPFS hash to check

        Returns:
            True if pinned, False otherwise
        """
        pins = self.pins()
        return cid in pins.get('Keys', {})

    
    def pin_add(self, cid: str) -> Dict[str, Any]:
        """Pin content to local IPFS node.
        
        Args:
            cid: IPFS hash to pin
            
        Returns:
            Dictionary with pin status
        """
        url = f"{self.url}/pin/add"
        params = {'arg': cid}
        response = self.session.post(url, params=params)
        response.raise_for_status()
        return response.json()

    def pins(self, cid: str = None) -> Dict[str, Any]:
        """List pinned content on local IPFS node.
        
        Returns:
            Dictionary with pinned content
        """
        url = f"{self.url}/pin/ls"
        response = self.session.post(url)
        response.raise_for_status()
        if cid:
            pins = response.json().get('Keys', {})
            return {cid: pins.get(cid)} if cid in pins else {}
        return response.json()
    
    def pin_rm(self, cid: str) -> Dict[str, Any]:
        """Unpin content from local IPFS node.
        
        Args:
            cid: IPFS hash to unpin
            
        Returns:
            Dictionary with unpin status
        """
        url = f"{self.url}/pin/rm"
        params = {'arg': cid}
        response = self.session.post(url, params=params)
        response.raise_for_status()
        return response.json()

    def _rm_all_pins(self) -> None:
        """Unpin all content from local IPFS node."""
        pins = self.pins()
        for cid in pins.get('Keys', {}).keys():
            print( f"Unpinning CID: {cid}")
            try:
                self.pin_rm(cid)
            except Exception as e:
                print(f"Error unpinning {cid}: {e}")
    


    kubo_version = 'v0.32.1'

    def install(self):
        """Install IPFS (Kubo) if not already installed. Supports macOS, Linux, and Windows."""
        if self.ipfs_installed():
            print("IPFS is already installed.")
            return True
        print("Installing IPFS (Kubo)...")
        system = platform.system().lower()
        machine = platform.machine().lower()
        # Map architecture names
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
            # Init repo after install
            subprocess.run(['ipfs', 'init'], capture_output=True)
            print("IPFS installed and initialized.")
            return True
        except Exception as e:
            print(f"Failed to install IPFS: {e}")
            return False

    def _install_macos(self, arch):
        """Install Kubo on macOS via tarball download."""
        tarball = f'kubo_{self.kubo_version}_darwin-{arch}.tar.gz'
        url = f'https://dist.ipfs.tech/kubo/{self.kubo_version}/{tarball}'
        tmp = '/tmp/kubo_install'
        os.makedirs(tmp, exist_ok=True)
        subprocess.run(['curl', '-L', '-o', f'{tmp}/{tarball}', url], check=True)
        subprocess.run(['tar', '-xzf', f'{tmp}/{tarball}', '-C', tmp], check=True)
        subprocess.run(['sudo', 'bash', f'{tmp}/kubo/install.sh'], check=True)
        subprocess.run(['rm', '-rf', tmp])

    def _install_linux(self, arch):
        """Install Kubo on Linux via tarball download."""
        tarball = f'kubo_{self.kubo_version}_linux-{arch}.tar.gz'
        url = f'https://dist.ipfs.tech/kubo/{self.kubo_version}/{tarball}'
        tmp = '/tmp/kubo_install'
        os.makedirs(tmp, exist_ok=True)
        subprocess.run(['curl', '-L', '-o', f'{tmp}/{tarball}', url], check=True)
        subprocess.run(['tar', '-xzf', f'{tmp}/{tarball}', '-C', tmp], check=True)
        subprocess.run(['sudo', 'bash', f'{tmp}/kubo/install.sh'], check=True)
        subprocess.run(['rm', '-rf', tmp])

    def _install_windows(self, arch):
        """Install Kubo on Windows via zip download."""
        zipname = f'kubo_{self.kubo_version}_windows-{arch}.zip'
        url = f'https://dist.ipfs.tech/kubo/{self.kubo_version}/{zipname}'
        tmp = os.path.join(os.environ.get('TEMP', 'C:\\Temp'), 'kubo_install')
        os.makedirs(tmp, exist_ok=True)
        zip_path = os.path.join(tmp, zipname)
        subprocess.run(['powershell', '-Command', f"Invoke-WebRequest -Uri '{url}' -OutFile '{zip_path}'"], check=True)
        subprocess.run(['powershell', '-Command', f"Expand-Archive -Path '{zip_path}' -DestinationPath '{tmp}' -Force"], check=True)
        # Copy ipfs.exe to a directory on PATH
        install_dir = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'ipfs')
        os.makedirs(install_dir, exist_ok=True)
        src = os.path.join(tmp, 'kubo', 'ipfs.exe')
        dst = os.path.join(install_dir, 'ipfs.exe')
        subprocess.run(['copy', src, dst], shell=True, check=True)
        # Add to PATH if not already there
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
        
    def write_script(self, path: str, content: str) -> None:
        """Write a script file with the given content."""
        dirpath = os.path.dirname(__file__)
        path = os.path.join(dirpath, path)

        if isinstance(content, list):
            content = '\n'.join(content)
        with open(path, 'w') as f:
            f.write(content)
        os.chmod(path, 0o755)
        return path

    def start_node(self):
        """Install IPFS if needed and start it as a background pm2 process."""
        self.install()
        # Init repo if it doesn't exist yet
        ipfs_path = os.path.expanduser('~/.ipfs')
        if not os.path.exists(ipfs_path):
            subprocess.run(['ipfs', 'init'], capture_output=True)
        # Check if already running in pm2

        # if
        # Start ipfs daemon via pm2
        # script
        path = self.write_script('start_ipfs.sh', ['#!/bin/bash', 'ipfs daemon'])
        cmd = ['pm2', 'start', path, '--name', self.node_name, '--no-autorestart']
        print(f"Starting IPFS node via pm2: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"IPFS node '{self.node_name}' started successfully.")
            return True
        else:
            print(f"Failed to start IPFS node: {result.stderr}")
            return False

    def stop_node(self):
        """Stop the IPFS pm2 process."""
        result = subprocess.run(['pm2', 'delete', self.node_name], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"IPFS node '{self.node_name}' stopped.")
        else:
            print(f"Failed to stop IPFS node: {result.stderr}")
        return result.returncode == 0

    def node_status(self):
        """Check if the IPFS pm2 node is running."""
        try:
            result = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True)
            processes = json.loads(result.stdout) if result.returncode == 0 else []
            for p in processes:
                if p.get('name') == self.node_name:
                    return p.get('pm2_env', {}).get('status', 'unknown')
            return 'not_found'
        except Exception:
            return 'error'

    def iscid(self, text: str = 'fsd') -> bool:
        '''
        Check if the text is an ipfs hash
        '''
        return isinstance(text, str) and (text.startswith('Qm') and len(text) == 46)

    def id(self) -> Dict[str, Any]:
        """Get IPFS node identity information.
        
        Returns:
            Dictionary with node ID and addresses
        """
        response = self.session.post( f"{self.url}/id")
        response.raise_for_status()
        return response.json()
    
    def version(self) -> Dict[str, Any]:
        """Get IPFS version information.
        
        Returns:
            Dictionary with version details
        """
        url = f"{self.url}/version"
        response = self.session.post(url)
        response.raise_for_status()
        return response.json()


    def test(self) -> bool:
        """Test connection to IPFS node by adding and retrieving test data.
        
        Returns:
            True if test is successful, False otherwise
        """
        test_obj = {"test_key": "test_value"}
        print("Testing IPFS data connection...", test_obj)
        cid = self.add(test_obj)
        retrieved_obj = self.get(cid)
        return retrieved_obj == test_obj

    def __str__(self):
        return f"IpfsClient(url={self.url})"
    
    def valid_cid(self, cid: str) -> bool:
        """Validate if a string is a valid IPFS CID.
        
        Args:
            cid: String to validate

        """
        try:
            self.get(cid)
            return True
        except Exception:
            return False

    # def syncenv(self):
    #     """Ensure that the IPFS environment is set up."""
    #     m.fn('pm/up')(self.node_name)