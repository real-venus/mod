"""Multi-chain module registry — Base (EVM), Solana, NEAR, and off-chain."""

import json
import os

# Supported storage providers for data CIDs
STORAGE_PROVIDERS = ('ipfs', 'lighthouse', 'filecoin')


def parse_data_uri(uri: str) -> tuple:
    """Parse a prefixed data URI like 'ipfs/{cid}' into (provider, cid).

    Returns (None, uri) if no known prefix found.
    """
    for p in STORAGE_PROVIDERS:
        prefix = f'{p}/'
        if uri.startswith(prefix):
            return p, uri[len(prefix):]
    return None, uri


def make_data_uri(provider: str, cid: str) -> str:
    """Build a prefixed data URI like 'ipfs/{cid}'."""
    if provider not in STORAGE_PROVIDERS:
        raise ValueError(f'Unknown storage provider: {provider}. Use one of {STORAGE_PROVIDERS}')
    return f'{provider}/{cid}'


class Mod:
    description = """
    Multi-chain module registry (Base, Solana, NEAR, off-chain).
    Register, query, update, and manage modules across backends.
    Data is stored as JSON on IPFS/Lighthouse/Filecoin, referenced by prefixed CID.
    Auth-gated registration via oath module token verification.
    Usage: m.mod('registry')(name='mymod', data={'version': '1.0'}, storage='ipfs')
    """

    def __init__(self, backend='offchain', network='testnet', storage='ipfs',
                 auth=None, require_auth=False, **kw):
        """
        Args:
            backend: Registry backend ('offchain', 'evm', 'solana', 'near').
            network: Network name ('testnet', 'mainnet', 'devnet').
            storage: Default storage provider ('ipfs', 'lighthouse', 'filecoin').
            auth: Auth instance (oath.Auth) for token verification. If None, loaded lazily.
            require_auth: If True, register/update/remove require valid auth headers.
        """
        self.default_backend = backend
        self.network = network
        self.default_storage = storage
        self.require_auth = require_auth
        self._auth = auth
        self._backends = {}
        self._storage_clients = {}
        self._config = self._load_config()
        # Eagerly init the default backend
        self._get_backend(self.default_backend)

    def _load_config(self):
        config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}

    def _get_backend(self, name=None):
        name = name or self.default_backend
        if name in self._backends:
            return self._backends[name]

        if name == 'offchain':
            from .offchain import OffchainRegistry
            cfg = self._config.get('offchain', {})
            backend = OffchainRegistry(storage_path=cfg.get('storage_path'))

        elif name == 'evm':
            from .evm import EVMRegistry
            cfg = self._config.get('evm', {}).get(self.network, {})
            backend = EVMRegistry(
                rpc_url=cfg.get('rpc'),
                chain_id=cfg.get('chain_id'),
                registry_address=cfg.get('registry'),
                network=self.network,
            )

        elif name == 'solana':
            from .solana import SolanaRegistry
            cfg = self._config.get('solana', {}).get(self.network, {})
            backend = SolanaRegistry(
                rpc_url=cfg.get('rpc'),
                program_id=cfg.get('program_id'),
                network=self.network,
            )

        elif name == 'near':
            from .near import NearRegistry
            cfg = self._config.get('near', {}).get(self.network, {})
            backend = NearRegistry(
                rpc_url=cfg.get('rpc'),
                account=cfg.get('account'),
                network=self.network,
            )

        else:
            raise ValueError(f'Unknown backend: {name}')

        self._backends[name] = backend
        return backend

    # ── Auth ─────────────────────────────────────────────────────────────────

    def _get_auth(self):
        """Lazy-load the oath Auth module."""
        if self._auth is not None:
            return self._auth
        try:
            import mod as m
            self._auth = m.mod('oath')()
        except Exception as e:
            raise RuntimeError(f'Cannot load oath auth module: {e}')
        return self._auth

    def _verify_auth(self, headers, data=None):
        """Verify auth headers. Raises on failure."""
        if not headers:
            raise PermissionError('Auth headers required for this operation')
        auth = self._get_auth()
        try:
            auth.verify(headers, data=data)
        except (AssertionError, Exception) as e:
            raise PermissionError(f'Auth verification failed: {e}')
        return headers.get('key')  # Return the signer's address

    def _check_auth(self, headers=None, data=None):
        """Check auth if require_auth is enabled. Returns signer address or None."""
        if not self.require_auth:
            return None
        return self._verify_auth(headers, data=data)

    # ── Storage ──────────────────────────────────────────────────────────────

    def _get_storage_client(self, provider=None):
        """Get or create a storage client for the given provider."""
        provider = provider or self.default_storage
        if provider in self._storage_clients:
            return self._storage_clients[provider]

        try:
            import mod as m
            if provider in ('ipfs', 'filecoin'):
                client = m.mod('ipfs')()
            elif provider == 'lighthouse':
                client = m.mod('lighthouse')()
            else:
                raise ValueError(f'Unknown storage provider: {provider}')
            self._storage_clients[provider] = client
            return client
        except Exception as e:
            raise RuntimeError(f'Cannot load storage provider "{provider}": {e}')

    def _upload_json(self, data, storage=None) -> str:
        """Upload JSON data to storage provider. Returns prefixed URI like 'ipfs/{cid}'."""
        storage = storage or self.default_storage
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                raise ValueError('Data must be a JSON object (dict) or valid JSON string')
        if not isinstance(data, dict):
            raise ValueError('Data must be a JSON object (dict)')

        client = self._get_storage_client(storage)
        cid = client.put(data)
        return make_data_uri(storage, cid)

    def resolve(self, data_uri: str) -> dict:
        """Resolve a prefixed data URI (e.g. 'ipfs/{cid}') to its JSON content."""
        provider, cid = parse_data_uri(data_uri)
        if not provider:
            raise ValueError(f'Invalid data URI: {data_uri}. Expected format: ipfs/{{cid}}, lighthouse/{{cid}}, or filecoin/{{cid}}')
        client = self._get_storage_client(provider)
        return client.get(cid)

    # ── CRUD ─────────────────────────────────────────────────────────────────

    def forward(self, name=None, data=None, backend=None, storage=None, headers=None, **kw):
        """Default action: register a mod, or list all if no args."""
        if name and data:
            return self.register(name, data, backend=backend, storage=storage, headers=headers, **kw)
        return self.list_all(backend=backend, **kw)

    def register(self, name: str, data, backend=None, storage=None, headers=None, **kw) -> str:
        """Register a new mod. Data must be a JSON dict — uploaded to storage provider.

        Args:
            name: Module name.
            data: JSON dict, JSON string, or pre-formatted URI ('ipfs/{cid}').
            backend: Registry backend ('offchain', 'evm', 'solana', 'near').
            storage: Storage provider ('ipfs', 'lighthouse', 'filecoin').
            headers: Auth headers from oath module (required if require_auth=True).

        Returns:
            Mod ID string.
        """
        signer = self._check_auth(headers, data={'name': name, 'action': 'register'})
        if signer and 'owner' not in kw:
            kw['owner'] = signer

        if isinstance(data, str) and parse_data_uri(data)[0]:
            data_uri = data
        else:
            data_uri = self._upload_json(data, storage=storage)
        return self._get_backend(backend).register(name, data_uri, **kw)

    def update(self, mod_id: str, data, backend=None, storage=None, headers=None, **kw) -> bool:
        """Update mod data. Data must be a JSON dict — uploaded to storage provider."""
        signer = self._check_auth(headers, data={'mod_id': mod_id, 'action': 'update'})
        if signer and 'owner' not in kw:
            kw['owner'] = signer

        if isinstance(data, str) and parse_data_uri(data)[0]:
            data_uri = data
        else:
            data_uri = self._upload_json(data, storage=storage)
        return self._get_backend(backend).update(mod_id, data_uri, **kw)

    def remove(self, mod_id: str, backend=None, headers=None, **kw) -> bool:
        """Remove a mod."""
        signer = self._check_auth(headers, data={'mod_id': mod_id, 'action': 'remove'})
        if signer and 'owner' not in kw:
            kw['owner'] = signer

        return self._get_backend(backend).remove(mod_id, **kw)

    def get(self, mod_id: str, backend=None, resolve=False, **kw) -> dict:
        """Get mod by ID. If resolve=True, also fetches JSON from storage."""
        mod = self._get_backend(backend).get(mod_id, **kw)
        if mod and resolve:
            provider, cid = parse_data_uri(mod.get('data', ''))
            if provider:
                mod = dict(mod)
                mod['resolved'] = self.resolve(mod['data'])
        return mod

    def list(self, owner: str = None, backend=None, **kw) -> list:
        """List mods for an owner."""
        if owner:
            return self._get_backend(backend).get_user_mods(owner, **kw)
        return self.list_all(backend=backend, **kw)

    def list_all(self, backend=None, **kw) -> list:
        """List all mods."""
        return self._get_backend(backend).list_all(**kw)

    def transfer(self, mod_id: str, new_owner: str, backend=None, headers=None, **kw) -> bool:
        """Transfer mod ownership."""
        signer = self._check_auth(headers, data={'mod_id': mod_id, 'action': 'transfer'})
        if signer and 'owner' not in kw:
            kw['owner'] = signer

        return self._get_backend(backend).transfer(mod_id, new_owner, **kw)

    def is_name_taken(self, owner: str, name: str, backend=None, **kw) -> bool:
        """Check if name is taken for owner."""
        return self._get_backend(backend).is_name_taken(owner, name, **kw)

    def sync(self, source='offchain', target='evm', owner: str = None, **kw):
        """Sync mods from one backend to another."""
        src = self._get_backend(source)
        dst = self._get_backend(target)

        if owner:
            mods = src.get_user_mods(owner)
        else:
            mods = src.list_all()

        synced = []
        for mod in mods:
            if not dst.is_name_taken(mod.get('owner', owner or 'local'), mod['name']):
                new_id = dst.register(
                    mod['name'],
                    mod['data'],
                    owner=mod.get('owner', owner),
                )
                synced.append({'source_id': mod.get('id'), 'target_id': new_id, 'name': mod['name']})
        return synced

    def backends(self):
        """List available backends."""
        return ['offchain', 'evm', 'solana', 'near']

    def storage_providers(self):
        """List available storage providers."""
        return list(STORAGE_PROVIDERS)

    def serve(self, api_port=None, app_port=None):
        """Start API server and app from config."""
        import subprocess
        from pathlib import Path

        config = getattr(self, '_config', {})
        api_port = api_port or config.get('port') or None
        app_port = app_port or config.get('app_port') or None
        root = os.path.join(os.path.dirname(__file__), '..')
        log_dir = Path(f'/tmp/registry')
        log_dir.mkdir(parents=True, exist_ok=True)

        for p in [api_port, app_port]:
            if p:
                subprocess.run(f'lsof -ti:{p} | xargs kill -9', shell=True, capture_output=True)

        results = {}

        server_dir = os.path.join(root, 'server')
        if os.path.exists(os.path.join(server_dir, 'server.py')) and api_port:
            env = os.environ.copy()
            env['PYTHONPATH'] = os.path.join(root, '..', '..', '..')
            subprocess.Popen(
                ['python3', '-m', 'uvicorn', 'server:app',
                 '--host', '0.0.0.0', '--port', str(api_port), '--reload'],
                cwd=server_dir, env=env,
                stdout=open(log_dir / 'api.log', 'w'),
                stderr=subprocess.STDOUT,
            )
            results['api'] = f'http://localhost:{api_port}'

        app_dir = os.path.join(root, 'app')
        if os.path.exists(os.path.join(app_dir, 'package.json')) and app_port:
            subprocess.Popen(
                ['npx', 'next', 'dev', '-p', str(app_port)],
                cwd=app_dir,
                stdout=open(log_dir / 'app.log', 'w'),
                stderr=subprocess.STDOUT,
            )
            results['app'] = f'http://localhost:{app_port}'

        return results

