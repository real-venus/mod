import subprocess
import os
import json
import socket
from urllib.parse import urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
MOD_ROOT = os.path.expanduser('~/mod/mod')
CADDYFILE = os.path.join(BASE, 'Caddyfile')
PM2_NAME = 'caddy'


class Mod:
    """Dynamic Caddy reverse proxy manager for mod modules."""

    def __init__(self, caddyfile=None):
        self.caddyfile = caddyfile or CADDYFILE

    def _port(self, url):
        try:
            return urlparse(url).port
        except Exception:
            return None

    def _live(self, port):
        if not port:
            return False
        try:
            with socket.create_connection(('localhost', port), timeout=0.3):
                return True
        except (ConnectionRefusedError, OSError, socket.timeout):
            return False

    def _scan(self):
        """Scan orbit/ and core/ config.json files for urls.app and urls.api."""
        modules = {}
        for d in ['orbit', 'core']:
            search = os.path.join(MOD_ROOT, d)
            if not os.path.isdir(search):
                continue
            for name in sorted(os.listdir(search)):
                cfg_path = os.path.join(search, name, 'config.json')
                if not os.path.isfile(cfg_path):
                    continue
                try:
                    with open(cfg_path) as f:
                        cfg = json.load(f)
                except Exception:
                    continue
                # config may be wrapped in a 'data' key
                if 'data' in cfg and isinstance(cfg['data'], dict):
                    cfg = cfg['data']
                urls = cfg.get('urls') or cfg.get('url') or {}
                app_url, api_url = urls.get('app'), urls.get('api')
                if not app_url and not api_url:
                    continue
                modules[name] = {
                    'app_port': self._port(app_url),
                    'api_port': self._port(api_url),
                }
        return modules

    def _filter_live(self, modules):
        """Remove modules with no live ports, null out dead individual ports."""
        dead = []
        for name, ports in modules.items():
            app_live = self._live(ports.get('app_port'))
            api_live = self._live(ports.get('api_port'))
            if not app_live and not api_live:
                dead.append(name)
            else:
                if not app_live:
                    ports['app_port'] = None
                if not api_live:
                    ports['api_port'] = None
        for name in dead:
            del modules[name]
        if dead:
            print(f'Skipped (not live): {", ".join(sorted(dead))}')
        return modules

    def _module_routes(self, modules, proxy_prefix):
        """Build /proxy/{mod}/app and /proxy/{mod}/api handle blocks."""
        lines = []
        for name in sorted(modules):
            app_port = modules[name].get('app_port')
            api_port = modules[name].get('api_port')
            if app_port:
                path = f'/{proxy_prefix}/{name}/app'
                lines.append(f'    handle {path}/* {{')
                lines.append(f'        uri strip_prefix {path}')
                lines.append(f'        reverse_proxy localhost:{app_port}')
                lines.append(f'    }}')
            if api_port:
                path = f'/{proxy_prefix}/{name}/api'
                lines.append(f'    handle {path}/* {{')
                lines.append(f'        uri strip_prefix {path}')
                lines.append(f'        reverse_proxy localhost:{api_port}')
                lines.append(f'    }}')
        return lines

    def generate(self, domain='modc2.com', app_port=3000, api_port=8000,
                 admin_port=2099, proxy_prefix='proxy', check_ports=True):
        """Generate Caddyfile from module config.json urls.

        All routing lives under a single domain:
          domain/proxy/api          → main API (localhost:api_port)
          domain/proxy/{mod}/app    → module app port
          domain/proxy/{mod}/api    → module api port
          domain/*                  → main app (localhost:app_port)
        """
        modules = self._scan()
        if check_ports:
            modules = self._filter_live(modules)

        api_prefix = f'/{proxy_prefix}/api'

        lines = [
            '{',
            f'    admin localhost:{admin_port}',
            '}',
            '',
            f'{domain} {{',
            # Main API: /proxy/api/* → localhost:api_port
            f'    handle {api_prefix}/* {{',
            f'        uri strip_prefix {api_prefix}',
            f'        reverse_proxy localhost:{api_port}',
            f'    }}',
            # Module routes: /proxy/{mod}/app/*, /proxy/{mod}/api/*
            *self._module_routes(modules, proxy_prefix),
            # Default fallback: main app
            f'    handle /* {{',
            f'        reverse_proxy localhost:{app_port}',
            f'    }}',
            '}',
            '',
        ]

        content = '\n'.join(lines)
        print(content)
        return content

    def _write(self, content):
        with open(self.caddyfile, 'w') as f:
            f.write(content)

    def _run(self, cmd, **kw):
        return subprocess.run(cmd, capture_output=True, text=True, **kw)

    def _pm2_start(self, cmd):
        self._run(['pm2', 'delete', PM2_NAME])
        result = self._run(['pm2', 'start', cmd[0], '--name', PM2_NAME, '--'] + cmd[1:])
        return result.returncode == 0

    def _stop_stale(self):
        try:
            self._run(['caddy', 'stop'], timeout=3)
        except subprocess.TimeoutExpired:
            self._run(['pkill', '-f', 'caddy run'])
            self._run(['pkill', 'caddy'])

    def sync(self, **kwargs):
        """Generate Caddyfile, write it, reload if running."""
        self._write(self.generate(**kwargs))
        try:
            result = self._run(['caddy', 'reload', '--config', self.caddyfile], timeout=5)
            reloaded = result.returncode == 0
        except subprocess.TimeoutExpired:
            reloaded = False
        return {'status': 'ok', 'caddyfile': self.caddyfile, 'reloaded': reloaded}

    def serve(self, **kwargs):
        """Generate Caddyfile and start Caddy via PM2."""
        self._write(self.generate(**kwargs))
        self._stop_stale()
        ok = self._pm2_start(['caddy', 'run', '--config', self.caddyfile])
        return {'status': 'ok' if ok else 'error', 'pm2': PM2_NAME, 'caddyfile': self.caddyfile}

    def kill(self):
        """Stop Caddy PM2 process and any stale daemon."""
        result = self._run(['pm2', 'delete', PM2_NAME])
        self._stop_stale()
        return {'status': 'killed' if result.returncode == 0 else 'error', 'pm2': PM2_NAME}

    def restart(self, **kwargs):
        """Kill and re-serve."""
        self.kill()
        return self.serve(**kwargs)

    def status(self):
        """Check if Caddy is running via PM2."""
        try:
            result = self._run(['pm2', 'jlist'], timeout=10)
            for p in json.loads(result.stdout or '[]'):
                if p.get('name') == PM2_NAME:
                    env = p.get('pm2_env', {})
                    return {
                        'running': env.get('status') == 'online',
                        'status': env.get('status'),
                        'pid': p.get('pid'),
                    }
        except Exception:
            pass
        return {'running': False}

    def logs(self, lines=50):
        """Show recent PM2 logs."""
        result = self._run(['pm2', 'logs', PM2_NAME, '--nostream', '--lines', str(lines)])
        return result.stdout + result.stderr
