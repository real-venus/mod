"""
Routy - Multi-Website Router

A Rust-based router for hosting multiple websites under a single domain
with URL-based routing and resource limits.
"""

import subprocess
import requests
import json
from pathlib import Path


class Mod:
    description = """
    Multi-website router with resource limits.

    Features:
    - Host multiple websites under one domain
    - URL-based routing (/{website}/{path})
    - CPU and memory monitoring
    - Resource limits to prevent abuse
    - Simple REST API for management
    """

    def __init__(self):
        self.base_url = "http://localhost:3000"
        self.routy_dir = Path(__file__).parent.parent

    def forward(self, **kwargs):
        """Entry point - show status or perform action"""
        action = kwargs.get('action', 'status')

        if action == 'start':
            return self.start()
        elif action == 'register':
            return self.register(**kwargs)
        elif action == 'list':
            return self.list_websites()
        elif action == 'stats':
            return self.stats()
        else:
            return self.status()

    def start(self):
        """Start the Routy server"""
        print("Starting Routy server...")
        cmd = ["cargo", "run", "--release"]
        subprocess.Popen(cmd, cwd=self.routy_dir)
        return {"status": "started", "url": self.base_url}

    def register(self, name=None, url=None, description=None, **kwargs):
        """Register a new website"""
        if not name or not url:
            return {
                "error": "name and url are required",
                "example": "m.fn('routy/register')(name='myapp', url='http://localhost:8080')"
            }

        payload = {
            "name": name,
            "target_url": url,
            "description": description
        }

        try:
            response = requests.post(
                f"{self.base_url}/_api/register",
                json=payload,
                timeout=5
            )
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def list_websites(self):
        """List all registered websites"""
        try:
            response = requests.get(f"{self.base_url}/_api/websites", timeout=5)
            websites = response.json()

            if not websites:
                return {"websites": [], "count": 0}

            print(f"\nRegistered Websites ({len(websites)}):")
            print("-" * 60)
            for w in websites:
                print(f"  {w['name']:<20} → {w['target_url']}")
                if w.get('description'):
                    print(f"    {w['description']}")
            print()

            return websites
        except Exception as e:
            return {"error": str(e)}

    def stats(self):
        """Get system statistics"""
        try:
            response = requests.get(f"{self.base_url}/_api/stats", timeout=5)
            stats = response.json()

            print(f"\nRouty Statistics:")
            print("-" * 40)
            print(f"  CPU Usage:       {stats['cpu_usage_percent']:.1f}%")
            print(f"  Websites:        {stats['website_count']} / {stats['max_websites']}")
            print(f"  CPU Limit:       {stats['cpu_limit_percent']}%")
            print()

            return stats
        except Exception as e:
            return {"error": str(e)}

    def status(self):
        """Check if Routy is running"""
        try:
            response = requests.get(f"{self.base_url}/_api/stats", timeout=2)
            if response.status_code == 200:
                return {
                    "status": "running",
                    "url": self.base_url,
                    "stats": response.json()
                }
        except:
            return {
                "status": "not running",
                "hint": "Run: m.fn('routy/start')()"
            }


# Helper functions for direct access
def start():
    """Start Routy server"""
    return Mod().start()


def register(name, url, description=None):
    """Register a website"""
    return Mod().register(name=name, url=url, description=description)


def list_websites():
    """List all websites"""
    return Mod().list_websites()


def stats():
    """Get statistics"""
    return Mod().stats()

    def serve(self, api_port=None, app_port=None):
        """Start API server and app from config."""
        import subprocess
        from pathlib import Path

        config = getattr(self, '_config', {})
        api_port = api_port or config.get('port') or None
        app_port = app_port or config.get('app_port') or None
        root = os.path.join(os.path.dirname(__file__), '..')
        log_dir = Path(f'/tmp/routy')
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

