"""
Routy - Local gateway that routes all mod apps and APIs.

Reads from the mod server namespace registry and proxies:
  /{name}/*       → app servers (keeps path prefix for Next.js basePath)
  /api/{name}/*   → API servers (strips prefix)
"""

import subprocess
import requests
import json
import os
import time
from pathlib import Path


class Mod:
    description = "Local gateway router — syncs from mod namespace, proxies apps + APIs."

    # Class-level config cache
    _config_cache = {}
    _config_cache_time = {}
    _sync_worker_running = False

    def __init__(self):
        self.port = 3000
        self.app_port = 3002
        self.base_url = f"http://localhost:{self.port}"
        self.routy_dir = Path(__file__).parent.parent
        self.app_dir = self.routy_dir / 'app'
        self.log_dir = Path('/tmp/routy')

        # Start config sync worker if not already running
        if not Mod._sync_worker_running:
            Mod._sync_worker_running = True
            import threading
            self._worker_thread = threading.Thread(target=self._sync_worker, daemon=True)
            self._worker_thread.start()

    def forward(self, **kwargs):
        action = kwargs.get('action', 'status')
        if action == 'start':
            return self.start()
        elif action == 'serve':
            return self.serve()
        elif action == 'sync':
            return self.sync()
        elif action == 'list':
            return self.list()
        elif action == 'stats':
            return self.stats()
        elif action == 'kill':
            return self.kill()
        else:
            return self.status()

    # ── Serve (background process: Rust binary + Next.js app) ──

    def serve(self):
        """Start routy as a background service: Rust proxy + Next.js dashboard."""
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Kill existing
        for p in [self.port, self.app_port]:
            subprocess.run(f'lsof -ti:{p} | xargs kill -9', shell=True, capture_output=True)
        time.sleep(0.3)

        # Build Rust binary
        print('Building routy...')
        result = subprocess.run(
            ['cargo', 'build', '--release'],
            cwd=self.routy_dir,
            capture_output=True, text=True
        )
        if result.returncode != 0:
            return {'error': 'Build failed', 'stderr': result.stderr[-500:]}

        # Start Rust binary in background
        binary = self.routy_dir / 'target' / 'release' / 'routy'
        env = os.environ.copy()
        env['ROUTY_PORT'] = str(self.port)
        subprocess.Popen(
            [str(binary)],
            env=env,
            stdout=open(self.log_dir / 'api.log', 'w'),
            stderr=subprocess.STDOUT,
        )
        print(f'Proxy started on :{self.port}')

        # Wait for Rust binary
        for _ in range(30):
            time.sleep(0.2)
            try:
                r = requests.get(f'{self.base_url}/_api/stats', timeout=1)
                if r.status_code == 200:
                    break
            except Exception:
                pass

        # Start Next.js app in background
        if (self.app_dir / 'package.json').exists():
            app_env = os.environ.copy()
            app_env['PORT'] = str(self.app_port)
            app_env['NEXT_PUBLIC_BASE_PATH'] = '/routy'
            app_env['ROUTY_API_URL'] = self.base_url
            subprocess.Popen(
                ['npx', 'next', 'dev', '-p', str(self.app_port)],
                cwd=str(self.app_dir),
                env=app_env,
                stdout=open(self.log_dir / 'app.log', 'w'),
                stderr=subprocess.STDOUT,
            )
            print(f'App started on :{self.app_port}/routy')

            # Register routy app in mod namespace so it persists across syncs
            import mod as _m
            ns = _m.mod('server.namespace')()
            ns.reg_app('routy', f'http://localhost:{self.app_port}',
                       owner='routy', api_url=self.base_url)

        # Sync from namespace (after app registration so routy itself is included)
        synced = self.sync()

        return {
            'status': 'running',
            'proxy': f'http://localhost:{self.port}',
            'app': f'http://localhost:{self.app_port}/routy',
            'synced': synced,
        }

    def start(self, build=True):
        """Alias for serve."""
        return self.serve()

    # ── Sync ──

    def sync(self, use_cache: bool = True):
        """Pull all running services from mod namespace and register them in routy.

        Args:
            use_cache: If True, use cached config data from API module scanner (faster)
        """
        import mod as m

        ns = m.mod('server.namespace')()

        # API servers: {name: "http://host:port"}
        api_registry = ns.namespace() or {}

        # App servers: read app_registry.json
        store = m.mod('store')('~/.mod/server/registry')
        app_registry = store.get('app_registry.json', {}) or {}

        sync_data = {'apps': [], 'apis': []}

        # Use config cache if available (faster than reading files)
        config_cache = {}
        if use_cache:
            try:
                # Access the class-level cache from API module
                from mod.core.api.mod import Api
                config_cache = getattr(Api, '_config_cache', {})
            except Exception:
                pass

        for name, url in api_registry.items():
            url = url.replace('0.0.0.0', '127.0.0.1')

            # Try to get config from cache first
            config_hash_key = f'{name}:hash'
            if config_hash_key in config_cache:
                # Config is cached, load it more efficiently
                try:
                    cfg = m.config(name) or {}
                except Exception:
                    cfg = {}
            else:
                # Fallback to resolve_storage
                st, cid = self._resolve_storage(m, name)
                cfg = {'storage_type': st, 'cid': cid} if (st or cid) else {}

            st = cfg.get('storage_type')
            cid = cfg.get('schema') or cfg.get('cid')

            sync_data['apis'].append({
                'name': name,
                'target_url': url,
                'description': f'API: {name}',
                'storage_type': st,
                'cid': cid,
            })

        for name, info in app_registry.items():
            if isinstance(info, dict) and 'url' in info:
                # Try cache first
                config_hash_key = f'{name}:hash'
                if config_hash_key in config_cache:
                    try:
                        cfg = m.config(name) or {}
                    except Exception:
                        cfg = {}
                else:
                    st, cid = self._resolve_storage(m, name)
                    cfg = {'storage_type': st, 'cid': cid} if (st or cid) else {}

                st = cfg.get('storage_type')
                cid = cfg.get('schema') or cfg.get('cid')

                sync_data['apps'].append({
                    'name': name,
                    'target_url': info['url'],
                    'description': f'App: {name}',
                    'storage_type': st,
                    'cid': cid,
                })

        try:
            r = requests.post(
                f'{self.base_url}/_api/sync',
                json=sync_data, timeout=5
            )
            result = r.json()
            apps = len(sync_data['apps'])
            apis = len(sync_data['apis'])
            print(f'Synced {apps} apps + {apis} apis (cached={use_cache and bool(config_cache)})')
            return result
        except Exception as e:
            return {'error': str(e)}

    # ── Storage resolution ──

    def _resolve_storage(self, m, name):
        """Resolve storage_type and cid from a module's config.json."""
        try:
            cfg = m.mod(name)().config if hasattr(m.mod(name)(), 'config') else {}
            if not isinstance(cfg, dict):
                cfg = {}
        except Exception:
            cfg = {}
        # Check for explicit storage_type, fall back to schema CID
        st = cfg.get('storage_type', None)
        cid = cfg.get('schema', cfg.get('cid', None))
        # Default storage type based on CID prefix
        if cid and not st:
            if cid.startswith('Qm'):
                st = 'ipfs'
            elif cid.startswith('hippius:'):
                st = 'hippius'
                cid = cid[len('hippius:'):]
        return st, cid

    def _sync_worker(self):
        """Background worker that scans configs every 1 second and syncs routes.

        Uses caching to avoid redundant config reads and syncs.
        """
        import hashlib
        import mod as m

        while True:
            try:
                time.sleep(1)  # Scan every 1 second

                # Check if routy is running (otherwise skip sync)
                try:
                    r = requests.get(f'{self.base_url}/_api/stats', timeout=0.5)
                    if r.status_code != 200:
                        continue
                except Exception:
                    continue  # Routy not running

                # Get namespace registries
                try:
                    ns_obj = m.mod('server.namespace')()
                    api_registry = ns_obj.namespace() or {}
                    store = m.mod('store')('~/.mod/server/registry')
                    app_registry = store.get('app_registry.json', {}) or {}
                except Exception:
                    continue

                # Check for changes using hash-based cache
                registry_data = json.dumps({
                    'apis': sorted(api_registry.items()),
                    'apps': sorted(app_registry.items())
                }, sort_keys=True)
                registry_hash = hashlib.sha256(registry_data.encode()).hexdigest()

                # Check cache
                cached_hash = Mod._config_cache.get('registry_hash')
                if cached_hash == registry_hash:
                    # No changes, skip sync
                    continue

                # Registry changed - sync to routy
                Mod._config_cache['registry_hash'] = registry_hash
                self.sync()

            except Exception as e:
                # Silent failure - don't spam logs
                pass

    # ── Management ──

    def register(self, name=None, url=None, description=None, website_type='app',
                 storage_type=None, cid=None, **kwargs):
        """Register a single service."""
        if not name or not url:
            return {'error': 'name and url required'}
        try:
            r = requests.post(
                f'{self.base_url}/_api/register',
                json={'name': name, 'target_url': url,
                      'description': description, 'website_type': website_type,
                      'storage_type': storage_type, 'cid': cid},
                timeout=5
            )
            return r.json()
        except Exception as e:
            return {'error': str(e)}

    def list(self):
        """List all registered services."""
        try:
            r = requests.get(f'{self.base_url}/_api/websites', timeout=5)
            data = r.json()
            apps = data.get('apps', [])
            apis = data.get('apis', [])

            if apps:
                print(f'\nApps ({len(apps)}):')
                for w in apps:
                    st = w.get('storage_type') or '-'
                    cid = w.get('cid', '')
                    cid_short = cid[:12] + '...' if cid and len(cid) > 12 else (cid or '-')
                    print(f"  /{w['name']:<20} -> {w['target_url']:<32} [{st}] {cid_short}")

            if apis:
                print(f'\nAPIs ({len(apis)}):')
                for w in apis:
                    st = w.get('storage_type') or '-'
                    cid = w.get('cid', '')
                    cid_short = cid[:12] + '...' if cid and len(cid) > 12 else (cid or '-')
                    print(f"  /api/{w['name']:<16} -> {w['target_url']:<32} [{st}] {cid_short}")

            if not apps and not apis:
                print('No services registered. Run: m routy/sync')

            return data
        except Exception as e:
            return {'error': str(e), 'hint': 'Is routy running? m routy/serve'}

    def stats(self):
        """Get routy stats."""
        try:
            r = requests.get(f'{self.base_url}/_api/stats', timeout=5)
            return r.json()
        except Exception as e:
            return {'error': str(e)}

    def status(self):
        """Check if routy is running."""
        try:
            r = requests.get(f'{self.base_url}/_api/stats', timeout=2)
            if r.status_code == 200:
                return {'status': 'running', 'url': self.base_url, **r.json()}
        except Exception:
            pass
        return {'status': 'not running', 'hint': 'm routy/serve'}

    def kill(self):
        """Stop routy (proxy + app)."""
        for p in [self.port, self.app_port]:
            subprocess.run(f'lsof -ti:{p} | xargs kill -9', shell=True, capture_output=True)
        return {'status': 'killed'}
