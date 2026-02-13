import subprocess
import time
import json
from typing import Optional, Dict, Any, List
import os
import mod as m


class Ganache:
    """Ganache blockchain manager for local Ethereum development."""
    
    def __init__(
        self,
        port: int = 8545,
        network_id: int = 1337,
        mnemonic: Optional[str] = None,
        fund_accounts: Optional[List[str]] = None,
        default_balance: int = 100
    ):
        """Initialize Ganache instance.
        
        Args:
            port: Port to run Ganache on
            network_id: Network ID for the blockchain
            mnemonic: Mnemonic phrase for account generation
            fund_accounts: List of accounts to fund with ETH
            default_balance: Default balance in ETH for accounts
        """
        self.port = port
        self.network_id = network_id
        self.process: Optional[subprocess.Popen] = None
        self.accounts = []
        self.private_keys = []
        self.fund_accounts = fund_accounts or []
        self.default_balance = default_balance
        self.background_thread = m.thread(self.setup)
        
    def setup(self) -> Dict[str, Any]:
        """Start Ganache instance.
        
        Returns:
            Dictionary with status and process information
        """
        cmd = [
            "ganache",
            "--port", str(self.port),
            "--networkId", str(self.network_id),
            "--defaultBalanceEther", str(self.default_balance),
        ]
        
        # Add accounts to fund if provided
        if self.fund_accounts:
            for account in self.fund_accounts:
                cmd.extend(["--account", f"{account},100000000000000000000"])
        
        try:
            cmd_str = " ".join(cmd)
            print(f"Starting Ganache: {cmd_str}")
            result = os.system(cmd_str)
            return {
                "status": "success" if result == 0 else "failed",
                "port": self.port,
                "network_id": self.network_id,
                "command": cmd_str
            }
        except Exception as e:
            return {"status": "failed", "error": str(e)}
    
    def teardown(self) -> Dict[str, Any]:
        """Stop Ganache instance.
        
        Returns:
            Dictionary with teardown status
        """
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None
            return {"status": "stopped", "message": "Ganache instance terminated successfully"}
        return {"status": "not_running", "message": "No Ganache instance was running"}
    
    def get_info(self) -> Dict[str, Any]:
        """Get all Ganache instance information.
        
        Returns:
            Dictionary with complete instance information
        """
        return {
            "port": self.port,
            "network_id": self.network_id,
            "rpc_url": f"http://localhost:{self.port}",
            "status": "running" if self.process and self.process.poll() is None else "stopped",
            "process_id": self.process.pid if self.process else None,
            "funded_accounts": self.fund_accounts,
            "default_balance": self.default_balance
        }
    
    def is_running(self) -> bool:
        """Check if Ganache instance is running.
        
        Returns:
            True if running, False otherwise
        """
        return self.process is not None and self.process.poll() is None
    
    def __enter__(self):
        """Context manager entry."""
        self.setup()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.teardown()
        self.background_thread.stop()
    
    def __repr__(self) -> str:
        """String representation of Ganache instance."""
        status = "running" if self.is_running() else "stopped"
        return f"Ganache(port={self.port}, network_id={self.network_id}, status={status})"
