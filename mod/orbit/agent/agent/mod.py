"""
agent - autonomous coding agent with 21 skills

Usage:
    import mod as m
    agent = m.mod('agent')()
    agent.forward('run', query='fix the bug in main.py')
    agent.forward('skills')
    agent.forward('serve')
    agent.forward('status')
"""
import os
import json
import subprocess
import signal
from pathlib import Path

try:
    import mod as m
except ImportError:
    m = None

from .agent import Agent
from .skills.mod import Skills


class Mod(Agent):
    description = "Autonomous coding agent. 21 skills for software engineering."

    def __init__(self, key=None, **kwargs):
        super().__init__(**kwargs)
        self.module_dir = Path(__file__).parent.parent

        # load ports from config.json
        config_path = self.module_dir / 'config.json'
        svc_config = {}
        if config_path.exists():
            with open(config_path) as f:
                svc_config = json.load(f)
        api_cfg = svc_config.get('api', {})
        app_cfg = svc_config.get('app', {})
        self.api_port = api_cfg.get('port', 50117)
        self.app_port = app_cfg.get('port', 3117)

        # ── permissions (Claude module pattern) ──
        self.key = m.key(key) if m else None
        self.auth = m.mod('auth.base')() if m else None
        self._owner = (self.key.address.lower() if self.key else
                       svc_config.get('owner'))
        self._portal_root = (m.paths['orbit']['portal']
                             if m and hasattr(m, 'paths') else
                             str(self.module_dir.parent.parent / 'portal'))

    # ── permissions (Claude module interface) ────────────────────────────

    def _resolve_address(self, key=None) -> str:
        """Resolve a key/address/token to a verified address string."""
        if key is None:
            return self.key.address if self.key else ''
        if hasattr(key, 'address'):
            return key.address
        key_str = str(key)
        if key_str.startswith('0x') and len(key_str) in (42, 66):
            return key_str
        if self.auth:
            try:
                verified = self.auth.verify(key_str)
                return verified['key']
            except Exception:
                pass
        return key_str

    def is_owner(self, key=None) -> bool:
        """Check if key/address/token belongs to the module owner."""
        if not self._owner:
            return True
        addr = self._resolve_address(key)
        if not addr:
            return False
        return addr.lower() == self._owner.lower()

    def require_owner(self, key=None, operation: str = "this operation"):
        """Raise PermissionError if caller is not the owner."""
        if not self.is_owner(key):
            raise PermissionError(
                f"Permission denied: '{operation}' is owner-only."
            )

    def allowed_paths_for(self, key=None):
        """Return allowed write paths for the caller.

        Owner: None (unrestricted)
        Others: [portal/{address}/]
        """
        if self.is_owner(key):
            return None
        addr = self._resolve_address(key).lower()
        portal_dir = os.path.join(self._portal_root, addr)
        os.makedirs(portal_dir, exist_ok=True)
        return [portal_dir]

    # ── mod protocol entry point ──────────────────────────────────────

    def forward(self, action=None, key=None, **kwargs):
        """CLI entry point: agent <action> [args]

        Actions:
            run         - Run the agent loop (query=, model=, steps=, skills=)
            plan        - Parse and execute a single LLM output
            skills      - List available skills
            skill       - Run a single skill (name=, **params)
            schema      - Get skill schemas for LLM
            serve       - Start API + app
            kill        - Stop services
            status      - Check services and skills
            health      - Health check
            test        - Run tests
        """
        kwargs['key'] = key
        actions = {
            'run': lambda: self._run(**kwargs),
            'plan': lambda: super(Mod, self).plan(kwargs.get('output', ''), safety=kwargs.get('safety', False)),
            'skills': lambda: self.skills.ls(),
            'skill': lambda: self.run_skill(kwargs.get('name', ''), **{k: v for k, v in kwargs.items() if k not in ('name', 'key')}),
            'schema': lambda: self.skill_schema(kwargs.get('names')),
            'serve': lambda: self.serve(kwargs.get('api_port'), kwargs.get('app_port'), kwargs.get('dev', True)),
            'kill': lambda: self.kill(kwargs.get('service')),
            'status': lambda: self.status(),
            'health': lambda: self.health(),
            'test': lambda: self.test(),
        }

        if not action or action not in actions:
            return {
                'module': 'agent',
                'description': self.description,
                'actions': list(actions.keys()),
                'owner': self._owner,
                'status': self.status(),
            }

        return actions[action]()

    def _run(self, **kwargs):
        """Run the agent loop (delegates to Agent.forward)"""
        key = kwargs.get('key')
        allowed_paths = self.allowed_paths_for(key)
        return super().forward(
            query=kwargs.get('query', 'help me with this'),
            model=kwargs.get('model', 'anthropic/claude-sonnet-4-5-20250929'),
            path=kwargs.get('path'),
            temperature=kwargs.get('temperature', 0.0),
            max_tokens=kwargs.get('max_tokens', 100000),
            steps=kwargs.get('steps', 25),
            skills=kwargs.get('skills'),
            mod=kwargs.get('mod'),
            safety=kwargs.get('safety', False),
            save=kwargs.get('save', False),
            key=kwargs.get('key'),
            allowed_paths=allowed_paths,
        )

    # ── serve ────────────────────────────────────────────────────────

    def serve(self, api_port=None, app_port=None, dev=True):
        """Start the FastAPI server and Next.js app."""
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port
        results = {}
        log_dir = Path('/tmp/agent')
        log_dir.mkdir(parents=True, exist_ok=True)

        self.kill()

        # ── start API (server/server.py) ──
        server_dir = self.module_dir / 'server'
        server_path = server_dir / 'server.py'
        if server_path.exists():
            env = os.environ.copy()
            env['PORT'] = str(api_port)
            env['PYTHONPATH'] = str(self.module_dir)

            api_log = open(log_dir / 'api.log', 'w')
            if dev:
                subprocess.Popen(
                    ['python3', '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0',
                     '--port', str(api_port), '--reload'],
                    cwd=str(server_dir),
                    env=env,
                    stdout=api_log,
                    stderr=subprocess.STDOUT,
                )
            else:
                subprocess.Popen(
                    ['python3', '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0',
                     '--port', str(api_port)],
                    cwd=str(server_dir),
                    env=env,
                    stdout=api_log,
                    stderr=subprocess.STDOUT,
                )
            results['api'] = f'http://localhost:{api_port}'
            results['api_log'] = str(log_dir / 'api.log')

        # ── start app (app/) ──
        app_dir = self.module_dir / 'app'
        if app_dir.exists():
            if not (app_dir / 'node_modules').exists():
                subprocess.run(['npm', 'install'], cwd=str(app_dir), capture_output=True)

            env = os.environ.copy()
            env['NEXT_PUBLIC_API_URL'] = f'http://localhost:{api_port}'
            env['PORT'] = str(app_port)

            app_log = open(log_dir / 'app.log', 'w')
            if dev:
                subprocess.Popen(
                    ['npx', 'next', 'dev', '-p', str(app_port)],
                    cwd=str(app_dir),
                    env=env,
                    stdout=app_log,
                    stderr=subprocess.STDOUT,
                )
            else:
                subprocess.Popen(
                    ['npx', 'next', 'start', '-p', str(app_port)],
                    cwd=str(app_dir),
                    env=env,
                    stdout=app_log,
                    stderr=subprocess.STDOUT,
                )
            results['app'] = f'http://localhost:{app_port}'
            results['app_log'] = str(log_dir / 'app.log')

        results['dev'] = dev
        results['logs'] = str(log_dir)
        return results

    def kill(self, service=None):
        """Stop running services. service: 'api', 'app', or None (both)"""
        killed = []
        patterns = []
        if service in (None, 'api'):
            patterns.append(f'uvicorn.*server:app.*{self.api_port}')
        if service in (None, 'app'):
            patterns.append(f'next.*dev.*{self.app_port}')
            patterns.append(f'next.*start.*{self.app_port}')

        for pattern in patterns:
            try:
                result = subprocess.run(
                    ['pgrep', '-f', pattern],
                    capture_output=True, text=True
                )
                for pid in result.stdout.strip().split('\n'):
                    if pid:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(f'{pattern.split(".*")[0]}:{pid}')
            except Exception:
                pass
        return {'killed': killed}

    def health(self):
        """Check if services are running."""
        result = {}
        try:
            import requests as req
            r = req.get(f'http://localhost:{self.api_port}/health', timeout=2)
            result['api'] = r.json()
        except Exception:
            result['api'] = {'status': 'down'}
        try:
            import requests as req
            r = req.get(f'http://localhost:{self.app_port}/', timeout=2)
            result['app'] = {'status': 'up' if r.status_code == 200 else 'down'}
        except Exception:
            result['app'] = {'status': 'down'}
        return result

    def status(self):
        """Get agent status"""
        return {
            'module': 'agent',
            'skills': self.skills.ls(),
            'skill_count': len(self.skills.ls()),
            'model': self.model is not None,
            'memory_keys': self.memory.keys(),
            'ports': {
                'api': self.api_port,
                'app': self.app_port,
            },
        }

    def test(self):
        """Test the agent module"""
        results = {'passed': 0, 'failed': 0, 'tests': []}

        # test skills loaded
        try:
            skills = self.skills.ls()
            assert len(skills) > 0, "should have skills"
            results['tests'].append({'name': 'skills_loaded', 'passed': True, 'count': len(skills)})
            results['passed'] += 1
        except Exception as e:
            results['tests'].append({'name': 'skills_loaded', 'passed': False, 'error': str(e)})
            results['failed'] += 1

        # test schema generation
        try:
            schema = self.skill_schema()
            assert 'bash' in schema, "should have bash skill"
            assert 'read' in schema, "should have read skill"
            results['tests'].append({'name': 'schema', 'passed': True, 'keys': list(schema.keys())})
            results['passed'] += 1
        except Exception as e:
            results['tests'].append({'name': 'schema', 'passed': False, 'error': str(e)})
            results['failed'] += 1

        # test bash skill
        try:
            r = self.run_skill('bash', command='echo hello')
            assert r['success'] and 'hello' in r['stdout']
            results['tests'].append({'name': 'bash_skill', 'passed': True})
            results['passed'] += 1
        except Exception as e:
            results['tests'].append({'name': 'bash_skill', 'passed': False, 'error': str(e)})
            results['failed'] += 1

        # test forward dispatch
        try:
            info = self.forward()
            assert info['module'] == 'agent'
            assert 'actions' in info
            results['tests'].append({'name': 'forward_dispatch', 'passed': True, 'actions': info['actions']})
            results['passed'] += 1
        except Exception as e:
            results['tests'].append({'name': 'forward_dispatch', 'passed': False, 'error': str(e)})
            results['failed'] += 1

        return results
