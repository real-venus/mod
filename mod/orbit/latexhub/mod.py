import os
import subprocess
import mod as m
from latexhub.latexhub import LatexHub


class Mod(LatexHub):
    description = "LaTeX document storage, compilation, and management hub"
    fns = ['save', 'load', 'ls', 'rm', 'compile', 'search', 'serve', 'kill', 'status']
    api_port = 50200
    app_port = 3200

    def __init__(self, **kwargs):
        self._dir = os.path.dirname(__file__)
        super().__init__()

    def serve(self, port=None, dev=True):
        """Start the latexhub API server and Next.js app via pm2."""
        results = {}
        results['api'] = self._start_api(port or self.api_port, dev=dev)
        results['app'] = self._start_app(self.app_port, dev=dev)
        return results

    def _start_api(self, port, dev=True):
        cwd = self._dir
        cmd = f'uvicorn api.api:app --host 0.0.0.0 --port {port}'
        if dev:
            cmd += ' --reload'

        script = os.path.join(self._dir, 'api', '_serve.sh')
        os.makedirs(os.path.dirname(script), exist_ok=True)
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod('pm.pm2')()
            name = 'latexhub-api'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'url': f'http://localhost:{port}'}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid}

    def _start_app(self, port, dev=True):
        cwd = os.path.join(self._dir, 'app')
        if not os.path.exists(os.path.join(cwd, 'node_modules')):
            subprocess.run(['npm', 'install'], cwd=cwd, timeout=120)

        cmd = f'npm run dev -- -p {port}' if dev else f'npm run start -- -p {port}'
        script = os.path.join(cwd, '_serve.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod('pm.pm2')()
            name = 'latexhub-app'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'url': f'http://localhost:{port}'}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid}

    def kill(self, service=None):
        """Stop running services. service: 'api', 'app', or None (both)."""
        results = {}
        try:
            pm2 = m.mod('pm.pm2')()
            if service in (None, 'api') and pm2.exists('latexhub-api'):
                pm2.kill('latexhub-api')
                results['api'] = 'killed'
            if service in (None, 'app') and pm2.exists('latexhub-app'):
                pm2.kill('latexhub-app')
                results['app'] = 'killed'
        except Exception as e:
            results['error'] = str(e)
        return results or {'status': 'nothing running'}

    def status(self):
        """Check status of latexhub services."""
        results = {'module': 'latexhub'}
        try:
            pm2 = m.mod('pm.pm2')()
            results['api'] = 'running' if pm2.exists('latexhub-api') else 'stopped'
            results['app'] = 'running' if pm2.exists('latexhub-app') else 'stopped'
        except Exception:
            results['api'] = 'unknown'
            results['app'] = 'unknown'
        docs = self.ls()
        results['doc_count'] = len(docs)
        return results
