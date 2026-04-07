import os
import json
import subprocess
import time
import requests
from typing import Any, Dict, List, Optional
import mod as m

class Mod:
    description = "Polaris GPU cloud - rent, manage, and monitor GPU instances"
    fns = ['gpus', 'instances', 'create', 'terminate', 'credits', 'status', 'ssh_cmd', 'serve', 'app']
    api_base = "https://api.polaris.computer/api"
    api_port = 8917
    app_port = 3917

    def __init__(self, api_key=None, **kwargs):
        self._dir = os.path.dirname(__file__)
        self._load_env()
        self.api_key = api_key or os.environ.get('POLARIS_KEY', self._load_key())
        self.auth = None

    def _load_env(self):
        """Load .env file from module directory"""
        env_path = os.path.join(self._dir, '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        os.environ.setdefault(k.strip(), v.strip())

    def _load_key(self):
        """Load API key from .mod config fallback"""
        key_path = os.path.join(self._dir, '.mod', 'api_key')
        if os.path.exists(key_path):
            return open(key_path).read().strip()
        return None

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def _get(self, path):
        r = requests.get(f"{self.api_base}{path}", headers=self._headers())
        r.raise_for_status()
        return r.json()

    def _post(self, path, data=None):
        r = requests.post(f"{self.api_base}{path}", headers=self._headers(), json=data or {})
        r.raise_for_status()
        return r.json()

    def _delete(self, path):
        r = requests.delete(f"{self.api_base}{path}", headers=self._headers())
        r.raise_for_status()
        return r.json()

    # ── Core API ──

    def gpus(self) -> list:
        """List available GPU types and pricing"""
        return self._get("/compute/gpus")

    def instances(self) -> list:
        """List all active instances"""
        return self._get("/compute/instances")

    def create(self, name: str = "mod-gpu", gpu_type: str = "H100 SXM5 80GB",
               ssh_public_key: str = None, use_spot: bool = True, **kwargs) -> dict:
        """Provision a new GPU instance"""
        if ssh_public_key is None:
            ssh_key_path = os.path.expanduser("~/.ssh/id_ed25519.pub")
            if not os.path.exists(ssh_key_path):
                ssh_key_path = os.path.expanduser("~/.ssh/id_rsa.pub")
            if os.path.exists(ssh_key_path):
                ssh_public_key = open(ssh_key_path).read().strip()
            else:
                return {"error": "No SSH public key found. Pass ssh_public_key= or add ~/.ssh/id_ed25519.pub"}

        payload = {
            "name": name,
            "gpu_type": gpu_type,
            "ssh_public_key": ssh_public_key,
            "use_spot": use_spot,
            **kwargs
        }
        return self._post("/compute/instances", payload)

    def terminate(self, instance_id: str) -> dict:
        """Terminate a running instance (stops billing)"""
        return self._delete(f"/compute/instances/{instance_id}")

    def credits(self) -> dict:
        """Check remaining credits/balance"""
        return self._get("/billing/credits")

    def status(self, instance_id: str = None) -> dict:
        """Get status of instance(s)"""
        instances = self.instances()
        if instance_id:
            for inst in (instances if isinstance(instances, list) else [instances]):
                if inst.get('id') == instance_id:
                    return inst
            return {"error": f"Instance {instance_id} not found"}
        return {"instances": instances, "credits": self.credits()}

    def ssh_cmd(self, instance_id: str = None) -> str:
        """Get SSH command for an instance"""
        instances = self.instances()
        if not isinstance(instances, list):
            instances = [instances]
        for inst in instances:
            if instance_id and inst.get('id') != instance_id:
                continue
            ip = inst.get('ip') or inst.get('public_ip')
            if ip:
                return f"ssh root@{ip}"
        return "No instance with IP found. Instance may still be provisioning."

    # ── Auth ──

    def get_auth(self, key=None, crypto_type='ecdsa'):
        """Get an Auth instance for token signing"""
        from .auth import Auth
        if self.auth is None:
            self.auth = Auth(key=key, crypto_type=crypto_type)
        return self.auth

    def verify(self, headers, crypto_type=None):
        """Verify an auth token"""
        return self.get_auth().verify(headers, crypto_type=crypto_type)

    # ── Serve & App ──

    def serve(self, port=None, dev=True):
        """Start the Polaris FastAPI server"""
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
            name = 'polaris-api'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'url': f'http://localhost:{port}'}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid, 'url': f'http://localhost:{port}'}

    def app(self, port=None, dev=True):
        """Start the Polaris web dashboard"""
        port = port or self.app_port
        cwd = os.path.join(self._dir, 'app')
        if not os.path.exists(cwd):
            return {"error": "App directory not found. Run setup first."}

        cmd = f'npm run dev -- -p {port}' if dev else f'npm run start -- -p {port}'
        script = os.path.join(self._dir, '_app.sh')
        with open(script, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\n{cmd}\n')
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod('pm.pm2')()
            name = 'polaris-app'
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=cwd, interpreter='bash')
            return {'status': 'running', 'port': port, 'manager': 'pm2', 'url': f'http://localhost:{port}'}
        except Exception:
            proc = subprocess.Popen(['bash', script], cwd=cwd)
            return {'status': 'running', 'port': port, 'manager': 'subprocess', 'pid': proc.pid, 'url': f'http://localhost:{port}'}

    def test(self):
        """Test Polaris API connectivity"""
        results = {}
        try:
            results['gpus'] = self.gpus()
            results['credits'] = self.credits()
            results['status'] = 'ok'
        except Exception as e:
            results['status'] = 'error'
            results['error'] = str(e)
        return results
