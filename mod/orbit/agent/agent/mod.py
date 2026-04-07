"""
agent - simplest agentic framework

Usage:
    import mod as m
    agent = m.mod('agent')()
    agent.forward("find all python files")
    agent.serve()                         # start API + app
    agent.serve(api_only=True)            # API only
    agent.serve(app_only=True)            # Next.js only
"""
import os
import subprocess

from .agent import Agent
from .skills.mod import Skills


class Mod(Agent):
    description = "Simplest agentic framework. Skills-based autonomous agent."

    api_port = 50117
    app_port = 3117

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._dir = os.path.dirname(os.path.dirname(__file__))
        self._api_dir = os.path.join(self._dir, 'api')
        self._app_dir = os.path.join(self._dir, 'app')

    # ── serve ────────────────────────────────────────────────────────

    def serve(self, api_port=None, app_port=None, dev=True, api_only=False, app_only=False):
        """
        Start the agent API server (FastAPI) and/or the Next.js app.

        Args:
            api_port:  API server port (default 50117)
            app_port:  Next.js app port (default 3117)
            dev:       run in dev mode (default True)
            api_only:  only start the API server
            app_only:  only start the Next.js app
        """
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port
        results = {}

        if not app_only:
            results['api'] = self._serve_api(api_port, dev=dev)

        if not api_only:
            results['app'] = self._serve_app(app_port, dev=dev)

        return results

    def _serve_api(self, port=None, dev=True):
        """Start the FastAPI server from api/api.py"""
        port = port or self.api_port
        cwd = self._dir  # run from agent root so `api.api:app` resolves

        if dev:
            cmd = f'uvicorn api.api:app --host 0.0.0.0 --port {port} --reload'
        else:
            cmd = f'uvicorn api.api:app --host 0.0.0.0 --port {port}'

        script = os.path.join(self._api_dir, '_serve.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            import mod as m
            pm2 = m.mod('pm.pm2')()
            name = 'agent-api'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'name': name}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid}

    def _serve_app(self, port=None, dev=True):
        """Start the Next.js app"""
        port = port or self.app_port
        cwd = self._app_dir

        if not os.path.exists(os.path.join(cwd, 'node_modules')):
            subprocess.run(['npm', 'install'], cwd=cwd, capture_output=True)

        cmd = f'npm run {"dev" if dev else "start"} -- -p {port}'

        script = os.path.join(cwd, '_serve.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\nexport NEXT_PUBLIC_API_URL=http://localhost:{self.api_port}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            import mod as m
            pm2 = m.mod('pm.pm2')()
            name = 'agent-app'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'name': name}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid}

    def kill(self, service=None):
        """Stop running services. service: 'api', 'app', or None (both)"""
        results = {}
        try:
            import mod as m
            pm2 = m.mod('pm.pm2')()
            if service in (None, 'api') and pm2.exists('agent-api'):
                pm2.kill('agent-api')
                results['api'] = 'killed'
            if service in (None, 'app') and pm2.exists('agent-app'):
                pm2.kill('agent-app')
                results['app'] = 'killed'
        except Exception as e:
            results['error'] = str(e)
        return results

    def status(self):
        """Check if services are running"""
        results = {'api_port': self.api_port, 'app_port': self.app_port}
        try:
            import mod as m
            pm2 = m.mod('pm.pm2')()
            results['api'] = 'running' if pm2.exists('agent-api') else 'stopped'
            results['app'] = 'running' if pm2.exists('agent-app') else 'stopped'
        except Exception:
            results['api'] = 'unknown'
            results['app'] = 'unknown'
        results['skills'] = self.skills.ls()
        return results

    def test(self):
        """Test the agent module"""
        assert len(self.skills.ls()) > 0, "should have skills"
        schema = self.skill_schema()
        assert 'bash' in schema, "should have bash skill"
        assert 'read' in schema, "should have read skill"
        r = self.run_skill('bash', command='echo hello')
        assert r['success'] and 'hello' in r['stdout']
        return {'success': True, 'skills': self.skills.ls(), 'schema_keys': list(schema.keys())}
