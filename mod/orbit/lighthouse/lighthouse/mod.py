import os
import io
import json
import tempfile
import requests
from typing import Optional, Dict, Any, List
import mod as m


class LighthouseClient:
    """Lighthouse decentralized storage adapter (IPFS + Filecoin).

    Usage:
        lh = LighthouseClient()                    # uses LIGHTHOUSE_TOKEN env var
        lh = LighthouseClient(token='xxx')         # explicit token

        # Upload
        cid = lh.upload('/path/to/file')            # upload file
        cid = lh.upload('/path/to/dir')             # upload directory
        cid = lh.put({'key': 'value'})              # upload JSON data
        cid = lh.put_text('hello world')            # upload text

        # Download
        data = lh.get(cid)                          # download as JSON
        raw = lh.cat(cid)                           # download raw bytes
        lh.download(cid, '/path/to/output')         # download to file

        # Info
        lh.uploads()                                # list your uploads
        lh.info(cid)                                # file info
        lh.deal_status(cid)                         # Filecoin deal status
        lh.balance()                                # storage balance

        # Tags
        cid = lh.upload('/path/to/file', tag='my-tag')
        files = lh.tagged('my-tag')

        # IPNS
        key = lh.ipns_keygen()                      # generate IPNS key
        lh.ipns_publish(cid, key_name)              # publish CID to IPNS
        lh.ipns_keys()                              # list IPNS keys
        lh.ipns_remove(key_name)                    # remove IPNS key
    """

    prefix = 'lighthouse'
    endpoints = ['upload', 'put', 'get', 'cat', 'uploads', 'deal_status', 'info', 'balance']
    gateway = 'https://gateway.lighthouse.storage/ipfs'

    def __init__(self, token: str = None):
        self.token = token or os.environ.get('LIGHTHOUSE_TOKEN', '')
        self.session = requests.Session()
        self._lh = None

    @property
    def lh(self):
        """Lazy-load the lighthouseweb3 SDK."""
        if self._lh is None:
            from lighthouseweb3 import Lighthouse
            self._lh = Lighthouse(token=self.token)
        return self._lh

    # ── Upload ──────────────────────────────────────────────────────

    def upload(self, source: str, tag: str = '') -> str:
        """Upload a file or directory to Lighthouse.

        Args:
            source: Path to file or directory
            tag: Optional tag for organizing uploads

        Returns:
            CID string
        """
        result = self.lh.upload(source, tag=tag)
        return self._extract_cid(result)

    def upload_blob(self, data: bytes, filename: str = 'data.bin', tag: str = '') -> str:
        """Upload raw bytes to Lighthouse.

        Args:
            data: Bytes to upload
            filename: Name for the uploaded file
            tag: Optional tag

        Returns:
            CID string
        """
        buf = io.BytesIO(data)
        result = self.lh.uploadBlob(buf, filename, tag=tag)
        return self._extract_cid(result)

    def put(self, data: Any, tag: str = '') -> str:
        """Upload JSON-serializable data to Lighthouse.

        Args:
            data: Any JSON-serializable object
            tag: Optional tag

        Returns:
            CID string
        """
        json_bytes = json.dumps(data).encode('utf-8')
        return self.upload_blob(json_bytes, filename='data.json', tag=tag)

    add = put

    def put_text(self, text: str, filename: str = 'data.txt', tag: str = '') -> str:
        """Upload text content to Lighthouse.

        Args:
            text: Text string to upload
            filename: Name for the file
            tag: Optional tag

        Returns:
            CID string
        """
        return self.upload_blob(text.encode('utf-8'), filename=filename, tag=tag)

    # ── Download ────────────────────────────────────────────────────

    def cat(self, cid: str) -> bytes:
        """Download raw content by CID.

        Args:
            cid: Content identifier

        Returns:
            Raw bytes
        """
        cid = self._resolve_cid(cid)
        result = self.lh.download(cid)
        if isinstance(result, tuple):
            return result[0] if isinstance(result[0], bytes) else result[0].encode('utf-8')
        if isinstance(result, bytes):
            return result
        return str(result).encode('utf-8')

    def get(self, cid: str) -> Any:
        """Download and parse JSON content by CID.

        Args:
            cid: Content identifier

        Returns:
            Parsed JSON object
        """
        raw = self.cat(cid)
        return json.loads(raw)

    def download(self, cid: str, output_path: str) -> str:
        """Download content to a local file.

        Args:
            cid: Content identifier
            output_path: Path to write the file

        Returns:
            Output file path
        """
        cid = self._resolve_cid(cid)
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        with open(output_path, 'wb') as f:
            self.lh.downloadBlob(f, cid)
        return output_path

    def get_url(self, cid: str) -> str:
        """Get the gateway URL for a CID.

        Args:
            cid: Content identifier

        Returns:
            Gateway URL string
        """
        cid = self._resolve_cid(cid)
        return f'{self.gateway}/{cid}'

    # ── Info & Status ───────────────────────────────────────────────

    def info(self, cid: str) -> Dict[str, Any]:
        """Get file info for a CID.

        Args:
            cid: Content identifier

        Returns:
            File info dict
        """
        cid = self._resolve_cid(cid)
        return self.lh.getFileInfo(cid)

    def deal_status(self, cid: str) -> Any:
        """Get Filecoin deal status for a CID.

        Args:
            cid: Content identifier

        Returns:
            Deal status info
        """
        cid = self._resolve_cid(cid)
        return self.lh.getDealStatus(cid)

    def uploads(self, last_key: str = None) -> Any:
        """List your uploads.

        Args:
            last_key: Pagination key for next page

        Returns:
            List of upload records
        """
        return self.lh.getUploads(lastKey=last_key)

    def balance(self) -> Dict[str, Any]:
        """Get storage balance info.

        Returns:
            Balance dict with usage and limits
        """
        return self.lh.getBalance()

    # ── Tags ────────────────────────────────────────────────────────

    def tagged(self, tag: str) -> Any:
        """Get all uploads with a specific tag.

        Args:
            tag: Tag to search for

        Returns:
            List of tagged uploads
        """
        return self.lh.getTagged(tag)

    # ── IPNS ────────────────────────────────────────────────────────

    def ipns_keygen(self) -> Dict[str, Any]:
        """Generate a new IPNS key.

        Returns:
            Key info dict
        """
        return self.lh.generateKey()

    def ipns_publish(self, cid: str, key_name: str) -> Dict[str, Any]:
        """Publish a CID to an IPNS key.

        Args:
            cid: Content identifier to publish
            key_name: IPNS key name to publish under

        Returns:
            Publish result
        """
        cid = self._resolve_cid(cid)
        return self.lh.publishRecord(cid, key_name)

    def ipns_keys(self) -> List[Dict[str, Any]]:
        """List all IPNS keys.

        Returns:
            List of IPNS key records
        """
        return self.lh.getAllKeys()

    def ipns_remove(self, key_name: str) -> Dict[str, Any]:
        """Remove an IPNS key.

        Args:
            key_name: Name of the IPNS key to remove

        Returns:
            Removal result
        """
        return self.lh.removeKey(key_name)

    # ── Wallet ──────────────────────────────────────────────────────

    @staticmethod
    def create_wallet(password: str) -> Dict[str, Any]:
        """Create a new Lighthouse wallet.

        Args:
            password: Password to encrypt the wallet

        Returns:
            Wallet info dict
        """
        from lighthouseweb3 import Lighthouse
        return Lighthouse.createWallet(password)

    @staticmethod
    def get_api_key(public_key: str, signed_message: str) -> Dict[str, Any]:
        """Get an API key using a signed message.

        Args:
            public_key: Wallet public key
            signed_message: Signed authentication message

        Returns:
            API key dict
        """
        from lighthouseweb3 import Lighthouse
        return Lighthouse.getApiKey(public_key, signed_message)

    # ── Helpers ─────────────────────────────────────────────────────

    def _resolve_cid(self, cid: str) -> str:
        """Strip prefix from CID if present."""
        if isinstance(cid, str) and cid.startswith(self.prefix + '/'):
            return cid[len(self.prefix) + 1:]
        return cid

    def _extract_cid(self, result) -> str:
        """Extract CID string from SDK upload result."""
        if isinstance(result, dict):
            return result.get('Hash') or result.get('cid') or result.get('data', {}).get('Hash', str(result))
        if isinstance(result, (list, tuple)) and len(result) > 0:
            return self._extract_cid(result[0])
        if hasattr(result, 'Hash'):
            return result.Hash
        if hasattr(result, 'data'):
            return self._extract_cid(result.data)
        return str(result)

    def test(self) -> bool:
        """Test round-trip: upload JSON, download, verify."""
        test_data = {'test': True, 'msg': 'lighthouse roundtrip'}
        print(f'[lighthouse] uploading test data: {test_data}')
        cid = self.put(test_data)
        print(f'[lighthouse] uploaded, CID: {cid}')
        retrieved = self.get(cid)
        print(f'[lighthouse] retrieved: {retrieved}')
        ok = retrieved == test_data
        print(f'[lighthouse] test {"passed" if ok else "FAILED"}')
        return ok

    def __str__(self):
        return f'LighthouseClient(gateway={self.gateway})'

    def __repr__(self):
        return self.__str__()
