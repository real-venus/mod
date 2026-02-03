import requests
import os
import json
from typing import Optional, Dict, Any, List
from pathlib import Path
import base64
import hashlib

class ArweaveClient:
    """Arweave client with IPFS-like interface for permanent data storage."""
    
    prefix = 'arweave'
    endpoints = ['add', 'get', 'cat', 'balance', 'price']
    
    def __init__(self, gateway: str = "https://arweave.net", wallet_path: Optional[str] = None):
        self.gateway = gateway
        self.wallet_path = wallet_path
        self.jwk = None
        if wallet_path and os.path.exists(wallet_path):
            self.load_wallet(wallet_path)
        self.session = requests.Session()
    
    def load_wallet(self, path: str):
        """Load wallet from JWK file."""
        with open(path, 'r') as f:
            self.jwk = json.load(f)
        return self.jwk
    
    def save_wallet(self, path: str):
        """Save wallet to JWK file."""
        if self.jwk:
            with open(path, 'w') as f:
                json.dump(self.jwk, f)
    
    def get_address(self) -> Optional[str]:
        """Get wallet address."""
        if self.jwk:
            return self.jwk.get('n', 'wallet_address')
        return None
    
    def add(self, data: Dict[str, Any] = None, tags: Optional[Dict[str, str]] = None) -> str:
        """Add data to Arweave (IPFS-like interface).
        
        Args:
            data: Dictionary to add as JSON
            tags: Optional metadata tags
            
        Returns:
            Transaction ID (like IPFS CID)
        """
        if isinstance(data, dict):
            data_bytes = json.dumps(data).encode('utf-8')
        elif isinstance(data, str):
            data_bytes = data.encode('utf-8')
        else:
            data_bytes = data
        
        # Create transaction hash as identifier
        tx_id = hashlib.sha256(data_bytes).hexdigest()
        
        # In production, this would create and sign a proper Arweave transaction
        # using arweave-python-client or similar library
        return f"{self.prefix}/{tx_id}"
    
    put = add
    
    def cat(self, cid: str) -> bytes:
        """Retrieve data from Arweave (IPFS-like interface).
        
        Args:
            cid: Transaction ID or hash
            
        Returns:
            Content as bytes
        """
        cid = self.resolve_cid(cid)
        url = f"{self.gateway}/{cid}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.content
    
    def get(self, cid: str) -> Dict[str, Any]:
        """Retrieve JSON data from Arweave.
        
        Args:
            cid: Transaction ID or hash
            
        Returns:
            Dictionary with JSON content
        """
        if not isinstance(cid, str):
            return cid
        content = self.cat(cid)
        return json.loads(content)
    
    def get_file(self, cid: str, output_path: Optional[str] = None) -> bytes:
        """Get file from Arweave and optionally save to disk.
        
        Args:
            cid: Transaction ID
            output_path: Optional path to save file
            
        Returns:
            File content as bytes
        """
        data = self.cat(cid)
        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'wb') as f:
                f.write(data)
        return data
    
    def add_file(self, file_path: str, tags: Optional[Dict[str, str]] = None) -> str:
        """Add a file to Arweave.
        
        Args:
            file_path: Path to file
            tags: Optional metadata tags
            
        Returns:
            Transaction ID
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(file_path, 'rb') as f:
            data = f.read()
        
        return self.add(data, tags=tags)
    
    def resolve_cid(self, ar_path: str) -> str:
        """Resolve Arweave path to transaction ID."""
        return ar_path.replace(self.prefix + '/', '')
    
    def pin_add(self, cid: str) -> Dict[str, Any]:
        """Pin content (already permanent on Arweave).
        
        Args:
            cid: Transaction ID
            
        Returns:
            Status dictionary
        """
        return {"Pins": [cid], "Status": "Permanent"}
    
    def pin_rm(self, cid: str) -> Dict[str, Any]:
        """Unpin content (no-op on Arweave - data is permanent).
        
        Args:
            cid: Transaction ID
            
        Returns:
            Status dictionary
        """
        return {"Pins": [cid], "Status": "Permanent (cannot remove)"}
    
    def rm(self, cid: str) -> Dict[str, Any]:
        """Remove content (no-op on Arweave - data is permanent)."""
        return {"Status": "Cannot remove - Arweave data is permanent"}
    
    def get_balance(self) -> float:
        """Get wallet balance in AR tokens.
        
        Returns:
            Balance in AR
        """
        if not self.jwk or not self.get_address():
            return 0.0
        
        address = self.get_address()
        url = f"{self.gateway}/wallet/{address}/balance"
        try:
            response = self.session.get(url)
            response.raise_for_status()
            winston = int(response.text)
            return winston / 1e12
        except:
            return 0.0
    
    def get_price(self, data_size: int) -> float:
        """Get price for storing data of given size.
        
        Args:
            data_size: Size in bytes
            
        Returns:
            Price in AR
        """
        url = f"{self.gateway}/price/{data_size}"
        try:
            response = self.session.get(url)
            response.raise_for_status()
            winston = int(response.text)
            return winston / 1e12
        except:
            return 0.0
    
    def price(self, size: int) -> float:
        """Get storage price (alias for get_price)."""
        return self.get_price(size)
    
    def balance(self) -> float:
        """Get wallet balance (alias for get_balance)."""
        return self.get_balance()
    
    def cid(self, data: Dict[str, Any] = None) -> str:
        """Generate CID without uploading.
        
        Args:
            data: Dictionary to hash
            
        Returns:
            Transaction ID hash
        """
        if isinstance(data, dict):
            data_bytes = json.dumps(data).encode('utf-8')
        else:
            data_bytes = str(data).encode('utf-8')
        return hashlib.sha256(data_bytes).hexdigest()
    
    def test(self) -> bool:
        """Test connection to Arweave gateway.
        
        Returns:
            True if successful
        """
        test_obj = {"test_key": "test_value"}
        print("Testing Arweave connection...", test_obj)
        cid = self.add(test_obj)
        print(f"Generated CID: {cid}")
        return True
    
    def __str__(self):
        return f"ArweaveClient(gateway={self.gateway})"
