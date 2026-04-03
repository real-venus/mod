import subprocess
import time
import os
import shutil
import platform
from pathlib import Path
from typing import Optional, Dict, Any
import requests
import json
import mod as m

class IpfsNodeManager:
    """
    Manages a native (non-Docker) IPFS node (Kubo) running in the background via PM2.
    Installs everything automatically if missing (assumes npm is already installed).
    """

    PM2_NAME = "ipfs-daemon"
    IPFS_VERSION = "v0.32.1"
    DATA_DIR = Path.home() / ".ipfs"
    API_PORT = 5001
    GATEWAY_PORT = 8080

    def __init__(self,
                 data_dir: Optional[str] = None,
                 api_port: int = 5001,
                 gateway_port: int = 8080):
        self.data_dir = Path(data_dir) if data_dir else self.DATA_DIR
        self.api_port = api_port
        self.gateway_port = gateway_port
        self.data_dir.mkdir(parents=True, exist_ok=True)
        os.environ["IPFS_PATH"] = str(self.data_dir)

    def install_ipfs(self):
        """Download and install latest Kubo IPFS binary if not present."""
        ipfs_bin = shutil.which("ipfs")
        if ipfs_bin:
            print(f"IPFS already installed at: {ipfs_bin}")
            return

        print("Installing IPFS (Kubo)...")

        system = platform.system().lower()
        machine = platform.machine().lower()

        if "arm" in machine or "aarch64" in machine:
            arch = "arm64"
        elif "x86_64" in machine or "amd64" in machine:
            arch = "amd64"
        else:
            raise OSError(f"Unsupported architecture: {machine}")

        if system == "darwin":
            os_name = "darwin"
        elif system == "linux":
            os_name = "linux"
        elif system == "windows":
            os_name = "windows"
            raise NotImplementedError("Windows install not implemented yet")
        else:
            raise OSError(f"Unsupported OS: {system}")

        url = f"https://dist.ipfs.tech/kubo/{self.IPFS_VERSION}/kubo_{self.IPFS_VERSION}_{os_name}-{arch}.tar.gz"
        tar_path = Path("/tmp") / f"kubo_{self.IPFS_VERSION}.tar.gz"

        print(f"Downloading from: {url}")
        response = requests.get(url, stream=True)
        response.raise_for_status()

        with open(tar_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print("Extracting...")
        subprocess.run(["tar", "-xzf", str(tar_path), "-C", "/tmp"], check=True)

        ipfs_bin_src = Path("/tmp") / "kubo" / "ipfs"
        ipfs_bin_dest = Path("/usr/local/bin") / "ipfs"

        print(f"Moving binary to {ipfs_bin_dest} (may need sudo)...")
        subprocess.run(["sudo", "mv", str(ipfs_bin_src), str(ipfs_bin_dest)], check=True)
        subprocess.run(["sudo", "chmod", "+x", str(ipfs_bin_dest)], check=True)

        tar_path.unlink()
        shutil.rmtree("/tmp/kubo", ignore_errors=True)

        print("IPFS installed successfully.")

    def init_ipfs(self):
        """Initialize IPFS repo if not already done."""
        if (self.data_dir / "config").exists():
            print("IPFS repo already initialized.")
            return

        print("Initializing IPFS repo...")
        subprocess.run(["ipfs", "init", "--empty-repo"], check=True)
        print("IPFS repo initialized.")

    def ensure_pm2(self):
        """Make sure PM2 is installed globally."""
        if shutil.which("pm2"):
            print("PM2 already installed.")
            return

        print("Installing PM2 globally via npm...")
        subprocess.run(["npm", "install", "-g", "pm2"], check=True)
        print("PM2 installed.")

    def start(self, rebuild: bool = False):
        """Start IPFS daemon via PM2."""
        self.ensure_pm2()
        self.install_ipfs()
        self.init_ipfs()

        # Stop any old process
        self.stop()

        print(f"Starting IPFS daemon via PM2 (API: localhost:{self.api_port})...")

        # Build the command - PM2 needs the daemon command as separate arguments
        cmd = [
            "pm2", "start",
            "ipfs",
            "--name", self.PM2_NAME,
            "--",
            "daemon"
        ]

        subprocess.run(cmd, check=True, env=os.environ.copy())

        # Wait for API to be ready
        self.wait_for_api_ready(timeout=60)

        print("IPFS node started and ready.")

    def stop(self):
        """Stop the PM2-managed IPFS daemon."""
        print("Stopping IPFS daemon...")
        subprocess.run(["pm2", "stop", self.PM2_NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["pm2", "delete", self.PM2_NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("Stopped.")

    def status(self) -> Dict[str, Any]:
        """Get PM2 process status."""
        result = subprocess.run(["pm2", "jlist"], capture_output=True, text=True)
        if result.returncode != 0:
            return {"running": False, "status": "Not running"}

        try:
            processes = json.loads(result.stdout)
            for proc in processes:
                if proc["name"] == self.PM2_NAME:
                    return {
                        "running": proc["pm2_env"]["status"] == "online",
                        "status": proc["pm2_env"]["status"],
                        "restarts": proc["pm2_env"]["restart_time"],
                        "uptime": proc.get("pm_uptime", 0)
                    }
        except:
            pass

        return {"running": False, "status": "Not found"}

    def wait_for_api_ready(self, timeout: int = 60):
        """Wait until IPFS API responds."""
        start = time.time()
        url = f"http://localhost:{self.api_port}/api/v0/id"
        while time.time() - start < timeout:
            try:
                resp = requests.post(url, timeout=3)
                if resp.status_code == 200:
                    print("IPFS API ready!")
                    return
            except:
                pass
            time.sleep(2)
        raise TimeoutError(f"IPFS API did not become ready after {timeout}s")

    def __del__(self):
        pass  # Don't auto-stop on deletion


# Example usage
if __name__ == "__main__":
    manager = IpfsNodeManager()
    manager.start()
    print(manager.status())
