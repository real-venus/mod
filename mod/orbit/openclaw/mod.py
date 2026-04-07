"""
openclaw - OpenClaw agent platform interface

Import, load, and manage OpenClaw AI agents inside Docker containers.

Usage:
    import mod as m
    oc = m.mod('openclaw')()
    oc.setup()                          # build & start container
    oc.agents()                         # list agents
    oc.agent('mybot', model='claude')   # create/load agent
    oc.send('hello', agent='mybot')     # talk to agent
    oc.kill()                           # stop everything
"""

import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
from typing import Any, Dict, List, Optional

import mod as m


class Auth:
    """Token auth for OpenClaw gateway communication."""

    features = ['data', 'time', 'key', 'signature']
    sig_features = ['data', 'time']

    def __init__(self, key=None, crypto_type='ecdsa', max_age=3_600):
        self.set_key(key=key, crypto_type=crypto_type)
        self.max_age = max_age

    def infer_crypto_type(self, key):
        from mod.core.key.key.utils import is_ethereum_address, is_substrate_ss58_address
        if is_ethereum_address(key):
            return 'ecdsa'
        if is_substrate_ss58_address(key):
            return 'sr25519'
        try:
            import base58
            from scalecodec.utils.ss58 import is_valid_ss58_address
            decoded = base58.b58decode(key)
            if len(decoded) == 32 and not is_valid_ss58_address(key):
                return 'solana'
        except Exception:
            pass
        return 'ed25519'

    def set_key(self, key, crypto_type=None):
        self.key = m.key(key=key, crypto_type=crypto_type)
        self.crypto_type = crypto_type or self.key.crypto_type_name

    def key_address(self, key=None) -> str:
        return self.get_key(key).address

    def token_data(self, data, key=None) -> dict:
        return {
            'data': data,
            'time': str(time.time()),
            'key': key.address if key else self.key.address,
        }

    def token(self, data: dict = {}, key=None, mod='str') -> dict:
        key = self.get_key(key)
        result = self.token_data(data)
        result['signature'] = key.sign(self.sig_data(result), mode='str')
        if mod == 'dict':
            return result
        elif mod == 'str':
            return self._base64url_encode(result)
        else:
            raise ValueError(f'Invalid mod {mod}')

    def headers(self, data: dict, key=None) -> dict:
        return {'token': self.token(data=data, key=key)}

    generate = forward = headers

    def set_crypto_type(self, crypto_type):
        self.crypto_type = crypto_type
        self.key = m.key(key=self.key, crypto_type=crypto_type)

    def verify(self, headers: str, crypto_type=None) -> dict:
        self.crypto_type = crypto_type or self.crypto_type
        if isinstance(headers, str):
            headers = json.loads(self._base64url_decode(headers))
        if 'Token' in headers:
            headers['token'] = headers.pop('Token')
        if 'token' in headers:
            token = headers['token']
            headers = json.loads(self._base64url_decode(token))

        crypto_type = self.infer_crypto_type(headers['key'])
        sig = headers['signature']
        sig_hex = sig[2:] if sig.startswith('0x') else sig
        if len(sig_hex) == 130:
            r, s, v_hex = sig_hex[:64], sig_hex[64:128], sig_hex[128:130]
            v = int(v_hex, 16)
            if v in (27, 28):
                headers['signature'] = '0x' + r + s + f'{v - 27:02x}'

        sig_data = self.sig_data(headers)
        age = abs(time.time() - float(headers['time']))
        assert age < self.max_age, f'Token is stale {age} > {self.max_age}'
        assert self.key.verify(
            sig_data,
            signature=headers['signature'],
            address=headers['key'],
            crypto_type=crypto_type
        ), f'Invalid signature'
        return headers

    def get_key(self, key=None):
        if key is None:
            key = self.key
        else:
            key = m.key(key, crypto_type=self.crypto_type)
        assert hasattr(key, 'address'), f'Invalid key {key}'
        return key

    def hash(self, data: Any) -> str:
        if isinstance(data, dict):
            data = json.dumps(data, separators=(',', ':'))
        if isinstance(data, str):
            data = data.encode('utf-8')
        return hashlib.sha256(data).hexdigest()

    def sig_data(self, headers: Dict[str, str]) -> str:
        return json.dumps({k: headers[k] for k in self.sig_features}, separators=(',', ':'))

    def _base64url_encode(self, data):
        if isinstance(data, str):
            data = data.encode('utf-8')
        elif isinstance(data, dict):
            data = json.dumps(data, separators=(',', ':')).encode('utf-8')
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

    def _base64url_decode(self, data):
        padding = b'=' * (4 - (len(data) % 4))
        return base64.urlsafe_b64decode(data.encode('utf-8') + padding)


# ─── Main Module ──────────────────────────────────────────────────────────────

CONTAINER = 'openclaw'
GATEWAY_PORT = 18789
API_PORT = 50120


class Mod:
    """OpenClaw agent platform — import, load, and run agents in Docker."""

    description = "OpenClaw agent platform interface. Manage AI agents in Docker containers."
    api_port = API_PORT
    gateway_port = GATEWAY_PORT

    def __init__(self, **kwargs):
        self._dir = os.path.dirname(__file__)
        self._compose = os.path.join(self._dir, 'docker-compose.yml')
        self._container = CONTAINER
        self._agents_cache = {}

    # ── docker helpers ────────────────────────────────────────────────────

    def _docker(self, *args, check=True, capture=True) -> subprocess.CompletedProcess:
        cmd = ['docker'] + list(args)
        return subprocess.run(cmd, capture_output=capture, text=True, check=check)

    def _compose_cmd(self, *args, check=True) -> subprocess.CompletedProcess:
        cmd = ['docker', 'compose', '-f', self._compose] + list(args)
        return subprocess.run(cmd, capture_output=True, text=True, check=check, cwd=self._dir)

    def _exec(self, *args, check=True) -> subprocess.CompletedProcess:
        cmd = ['docker', 'exec', self._container] + list(args)
        return subprocess.run(cmd, capture_output=True, text=True, check=check)

    def _is_running(self) -> bool:
        try:
            r = self._docker('inspect', '-f', '{{.State.Running}}', self._container, check=False)
            return r.stdout.strip() == 'true'
        except Exception:
            return False

    # ── lifecycle ─────────────────────────────────────────────────────────

    def setup(self, build=True):
        """Build the OpenClaw Docker image and start the container.

        Args:
            build: if True, rebuild the image before starting
        """
        if build:
            print(f'[openclaw] building image...')
            self._compose_cmd('build')

        print(f'[openclaw] starting container...')
        self._compose_cmd('up', '-d')

        # wait for gateway to be ready
        for i in range(30):
            if self._is_running():
                r = self._exec('openclaw', 'doctor', check=False)
                if r.returncode == 0:
                    print(f'[openclaw] gateway ready on port {self.gateway_port}')
                    return {'status': 'running', 'gateway_port': self.gateway_port}
            time.sleep(2)

        return {'status': 'starting', 'note': 'container up but gateway may still be initializing'}

    def kill(self, remove=False):
        """Stop the OpenClaw container.

        Args:
            remove: also remove the container and volumes
        """
        if remove:
            self._compose_cmd('down', '-v', check=False)
        else:
            self._compose_cmd('down', check=False)
        return {'status': 'stopped'}

    def restart(self):
        """Restart the OpenClaw container."""
        self._compose_cmd('restart')
        return {'status': 'restarted'}

    def status(self) -> dict:
        """Check container and gateway status."""
        running = self._is_running()
        result = {
            'container': 'running' if running else 'stopped',
            'gateway_port': self.gateway_port,
            'api_port': self.api_port,
        }
        if running:
            r = self._exec('openclaw', 'doctor', check=False)
            result['doctor'] = r.stdout.strip() if r.returncode == 0 else r.stderr.strip()
            result['agents'] = self.agents()
        return result

    # ── agent management ──────────────────────────────────────────────────

    def agents(self) -> list:
        """List all available agents/sessions in the container."""
        if not self._is_running():
            return []
        r = self._exec('openclaw', 'sessions', 'list', '--json', check=False)
        if r.returncode != 0:
            # fallback: try parsing non-json output
            r2 = self._exec('openclaw', 'sessions', 'list', check=False)
            return r2.stdout.strip().splitlines() if r2.returncode == 0 else []
        try:
            return json.loads(r.stdout)
        except json.JSONDecodeError:
            return r.stdout.strip().splitlines()

    def agent(self, name: str, model: str = 'claude', thinking: str = 'medium', **config) -> dict:
        """Create or load an agent session.

        Args:
            name:     agent session name
            model:    LLM model to use (claude, deepseek, gpt-4o, etc.)
            thinking: thinking level (low, medium, high)
            **config: additional openclaw config overrides

        Returns:
            dict with agent session info
        """
        if not self._is_running():
            raise RuntimeError('OpenClaw container not running. Call setup() first.')

        # build config args
        cfg_args = []
        for k, v in config.items():
            cfg_args += ['--config', f'{k}={v}']

        # create session
        r = self._exec(
            'openclaw', 'sessions', 'create',
            '--name', name,
            '--model', model,
            '--thinking', thinking,
            *cfg_args,
            check=False
        )

        agent_info = {
            'name': name,
            'model': model,
            'thinking': thinking,
            'status': 'created' if r.returncode == 0 else 'error',
            'output': r.stdout.strip(),
        }
        if r.returncode != 0:
            agent_info['error'] = r.stderr.strip()

        self._agents_cache[name] = agent_info
        return agent_info

    def import_agent(self, source: str, name: str = None) -> dict:
        """Import an agent config into the container.

        Args:
            source: path to agent config file (YAML/JSON) or URL
            name:   optional name override for the imported agent

        Returns:
            dict with import result
        """
        if not self._is_running():
            raise RuntimeError('OpenClaw container not running. Call setup() first.')

        # if source is a local file, copy it into the container
        if os.path.isfile(source):
            dest = f'/tmp/agent_import_{int(time.time())}.yml'
            self._docker('cp', source, f'{self._container}:{dest}')
            args = ['openclaw', 'config', 'import', dest]
        else:
            # treat as URL or inline config name
            args = ['openclaw', 'config', 'import', source]

        if name:
            args += ['--name', name]

        r = self._exec(*args, check=False)
        return {
            'status': 'imported' if r.returncode == 0 else 'error',
            'source': source,
            'name': name,
            'output': r.stdout.strip(),
            'error': r.stderr.strip() if r.returncode != 0 else None,
        }

    def export_agent(self, name: str, dest: str = None) -> dict:
        """Export an agent config from the container.

        Args:
            name: agent name to export
            dest: local destination path (default: ./<name>.yml)

        Returns:
            dict with export result
        """
        if not self._is_running():
            raise RuntimeError('OpenClaw container not running. Call setup() first.')

        container_path = f'/tmp/agent_export_{name}.yml'
        r = self._exec('openclaw', 'config', 'export', '--name', name, '--output', container_path, check=False)
        if r.returncode != 0:
            return {'status': 'error', 'error': r.stderr.strip()}

        dest = dest or os.path.join(self._dir, f'{name}.yml')
        self._docker('cp', f'{self._container}:{container_path}', dest)
        return {'status': 'exported', 'name': name, 'path': dest}

    # ── communication ─────────────────────────────────────────────────────

    def send(self, message: str, agent: str = None, **kwargs) -> dict:
        """Send a message to an OpenClaw agent.

        Args:
            message: the message to send
            agent:   agent/session name (uses default if None)
            **kwargs: extra flags (e.g. thinking='high')

        Returns:
            dict with agent response
        """
        if not self._is_running():
            raise RuntimeError('OpenClaw container not running. Call setup() first.')

        args = ['openclaw', 'agent', '--message', message]
        if agent:
            args += ['--session', agent]
        if 'thinking' in kwargs:
            args += ['--thinking', kwargs['thinking']]
        if 'model' in kwargs:
            args += ['--model', kwargs['model']]

        r = self._exec(*args, check=False)
        return {
            'agent': agent,
            'message': message,
            'response': r.stdout.strip(),
            'status': 'ok' if r.returncode == 0 else 'error',
            'error': r.stderr.strip() if r.returncode != 0 else None,
        }

    def forward(self, query: str, agent: str = None, **kwargs) -> dict:
        """Main entry point — alias for send()."""
        return self.send(query, agent=agent, **kwargs)

    # ── gateway ───────────────────────────────────────────────────────────

    def gateway(self, action: str = 'status', port: int = None) -> dict:
        """Manage the OpenClaw gateway inside the container.

        Args:
            action: 'status', 'restart', or 'logs'
            port:   gateway port override
        """
        port = port or self.gateway_port
        if not self._is_running():
            return {'status': 'container not running'}

        if action == 'restart':
            self._exec('bash', '-c', 'pkill -f "openclaw gateway" || true', check=False)
            self._exec('bash', '-c',
                f'nohup openclaw gateway --port {port} > /var/log/openclaw-gateway.log 2>&1 &',
                check=False)
            return {'status': 'restarted', 'port': port}
        elif action == 'logs':
            r = self._exec('tail', '-100', '/var/log/openclaw-gateway.log', check=False)
            return {'logs': r.stdout.strip()}
        else:
            r = self._exec('openclaw', 'doctor', check=False)
            return {'status': 'ok' if r.returncode == 0 else 'error', 'output': r.stdout.strip()}

    # ── serve (mod API) ───────────────────────────────────────────────────

    def serve(self, port: int = None, dev: bool = True):
        """Start a FastAPI server exposing openclaw methods.

        Args:
            port: API port (default 50120)
            dev:  run with --reload
        """
        port = port or self.api_port
        cwd = self._dir

        cmd = f'uvicorn api:app --host 0.0.0.0 --port {port}'
        if dev:
            cmd += ' --reload'

        script = os.path.join(self._dir, '_serve.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod('pm.pm2')()
            name = 'openclaw-api'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2'}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid}

    # ── config ────────────────────────────────────────────────────────────

    def config(self, key: str = None, value: str = None) -> dict:
        """Get or set OpenClaw config inside the container.

        Args:
            key:   config key (e.g. 'gateway.port', 'sessions.model')
            value: if provided, set the key to this value

        Returns:
            current config dict or set result
        """
        if not self._is_running():
            return {'error': 'container not running'}

        if key and value:
            r = self._exec('openclaw', 'config', 'set', f'{key}={value}', check=False)
            return {'status': 'set' if r.returncode == 0 else 'error', 'key': key, 'value': value}
        elif key:
            r = self._exec('openclaw', 'config', 'get', key, check=False)
            return {'key': key, 'value': r.stdout.strip()}
        else:
            r = self._exec('openclaw', 'config', 'list', check=False)
            return {'config': r.stdout.strip()}

    # ── logs ──────────────────────────────────────────────────────────────

    def logs(self, lines: int = 100) -> str:
        """Get container logs."""
        r = self._docker('logs', '--tail', str(lines), self._container, check=False)
        return r.stdout + r.stderr

    # ── test ──────────────────────────────────────────────────────────────

    def test(self):
        """Self-test: verify container can start and gateway responds."""
        results = {}

        # check docker available
        r = self._docker('version', check=False)
        results['docker'] = 'ok' if r.returncode == 0 else 'not found'

        # check compose file exists
        results['compose_file'] = os.path.exists(self._compose)

        # check container status
        results['container'] = 'running' if self._is_running() else 'stopped'

        if self._is_running():
            r = self._exec('openclaw', '--version', check=False)
            results['openclaw_version'] = r.stdout.strip() if r.returncode == 0 else 'error'
            results['agents'] = self.agents()

        return results
