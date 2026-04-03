"""
App module template — a self-contained Next.js app with ownership.

Usage:
    import mod as m
    m.new_app('mymod')  # Creates, configures, installs, and serves
"""

import os
import json
import subprocess


class Mod:
    description = "App module with Next.js frontend and ownership"

    def __init__(self, **kwargs):
        import mod
        self.m = mod.Mod()
        self._dir = os.path.dirname(os.path.dirname(__file__))
        self._app_dir = os.path.join(self._dir, 'app')
        self._config = None

    @property
    def config(self):
        if self._config is None:
            path = os.path.join(self._app_dir, 'mod.json')
            if os.path.exists(path):
                with open(path) as f:
                    self._config = json.load(f)
            else:
                self._config = {}
        return self._config

    @property
    def name(self):
        return self.config.get('name', os.path.basename(self._dir))

    @property
    def owner(self):
        return self.config.get('owner', '')

    @property
    def port(self):
        return self.config.get('port', 3100)

    def is_owner(self, address=None):
        address = address or self.m.owner()
        return address.lower() == self.owner.lower()

    def serve(self, port=None, dev=True):
        """Start the Next.js app server via PM2."""
        port = port or self.port
        ns = self.m.mod('server.namespace')()
        ns.reg_app(self.name, f'http://0.0.0.0:{port}', owner=self.owner)

        cwd = self._app_dir
        cmd = f'npm run {"dev" if dev else "start"} -- -p {port}'
        script_path = os.path.join(cwd, '_serve.sh')
        with open(script_path, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script_path, 0o755)

        pm2 = self.m.mod('pm.pm2')()
        name = self.name
        if pm2.exists(name):
            pm2.kill(name, remove_script=False)
        return pm2.start_script(name=name, script_path=script_path, cwd=cwd, interpreter='bash')

    def kill(self, key=None):
        """Stop the app server. Owner only."""
        address = self.m.key_address(key) if key else self.m.owner()
        if not self.is_owner(address):
            return {'error': f'Not owner. Owner is {self.owner}'}
        pm2 = self.m.mod('pm.pm2')()
        pm2.kill(self.name)
        ns = self.m.mod('server.namespace')()
        ns.dereg_app(self.name)
        return {'status': 'killed', 'name': self.name}

    def edit(self, query='', key=None, **kwargs):
        """Edit the module. Owner only."""
        address = self.m.key_address(key) if key else self.m.owner()
        if not self.is_owner(address):
            return {'error': f'Not owner. Owner is {self.owner}'}
        return self.m.edit(self.name, query, **kwargs)

    def forward(self, **kwargs):
        """Default entry — return module info."""
        return {
            'name': self.name,
            'owner': self.owner,
            'port': self.port,
            'app_dir': self._app_dir,
        }
