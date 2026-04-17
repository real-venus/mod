import mod as m
import subprocess
import os

class Mod:
    """Dynamic Caddy reverse proxy manager for module apps."""

    def __init__(self, caddyfile=None):
        self.caddyfile = caddyfile or os.path.expanduser('~/mod/mod/orbit/caddy/Caddyfile')

    def _get_app_ports(self):
        """Read installed apps and resolve their ports from config."""
        ns = m.mod('server.namespace')()
        installed = ns.store.get('app_installed.json', {})
        apps = {}
        for name, info in installed.items():
            port = info.get('port', 0)
            if not port or port == 'auto':
                # Resolve from module config.json
                try:
                    config = m.config(name) or {}
                    port = config.get('app_port', 0)
                except Exception:
                    port = 0
            if port and port != 'auto':
                apps[name] = int(port)
        return apps

    def generate(self, domain='app.modc2.com', api_domain='api.modc2.com',
                 app_port=3000, api_port=8000):
        """Generate Caddyfile content from registered/installed apps.

        Returns the Caddyfile string with route blocks for each module app,
        plus catch-all for the main app and a separate API domain block.
        """
        apps = self._get_app_ports()

        lines = [f'{domain} {{']

        # Per-module handle blocks
        for name in sorted(apps):
            port = apps[name]
            lines.append(f'    handle /{name}/* {{')
            lines.append(f'        reverse_proxy localhost:{port}')
            lines.append(f'    }}')

        # Catch-all for main app
        lines.append(f'    handle /* {{')
        lines.append(f'        reverse_proxy localhost:{app_port}')
        lines.append(f'    }}')
        lines.append(f'}}')

        # API domain
        lines.append(f'')
        lines.append(f'{api_domain} {{')
        lines.append(f'    reverse_proxy localhost:{api_port}')
        lines.append(f'}}')
        lines.append('')

        content = '\n'.join(lines)
        print(content)
        return content

    def sync(self, **kwargs):
        """Generate Caddyfile, write it, and reload Caddy."""
        content = self.generate(**kwargs)
        with open(self.caddyfile, 'w') as f:
            f.write(content)
        result = subprocess.run(
            ['caddy', 'reload', '--config', self.caddyfile],
            capture_output=True, text=True
        )
        status = 'ok' if result.returncode == 0 else 'error'
        return {
            'status': status,
            'caddyfile': self.caddyfile,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
        }

    def start(self, **kwargs):
        """Start Caddy daemon with current config."""
        # Generate fresh config first
        self.sync(**kwargs)
        result = subprocess.run(
            ['caddy', 'start', '--config', self.caddyfile],
            capture_output=True, text=True
        )
        status = 'ok' if result.returncode == 0 else 'error'
        return {
            'status': status,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
        }

    def stop(self):
        """Stop Caddy daemon."""
        result = subprocess.run(
            ['caddy', 'stop'],
            capture_output=True, text=True
        )
        status = 'ok' if result.returncode == 0 else 'error'
        return {
            'status': status,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
        }
