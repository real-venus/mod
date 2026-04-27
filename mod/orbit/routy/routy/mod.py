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

    def __init__(self):
        self.base_url = "http://localhost:3001"
        self.routy_dir = Path(__file__).parent.parent

    def forward(self, **kwargs):
        action = kwargs.get('action', 'status')
        if action == 'start':
            return self.start()
        elif action == 'sync':
            return self.sync()
        elif action == 'list':
            return self.list()
        elif action == 'stats':
            return self.stats()
        else:
            return self.status()

    # ── Core ──

    def start(self, build=True):
        """Build and start the Routy binary, then sync from namespace."""
        if build:
            print("Building routy...")
            result = subprocess.run(
                ["cargo", "build", "--release"],
                cwd=self.routy_dir,
                capture_output=True, text=True
            )
            if result.returncode != 0:
                return {"error": "Build failed", "stderr": result.stderr}

        # Kill existing
        subprocess.run("lsof -ti:3001 | xargs kill -9", shell=True, capture_output=True)
        time.sleep(0.3)

        log_dir = Path("/tmp/routy")
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = open(log_dir / "routy.log", "w")

        print("Starting routy on :3000...")
        subprocess.Popen(
            ["cargo", "run", "--release"],
            cwd=self.routy_dir,
            stdout=log_file, stderr=subprocess.STDOUT
        )

        # Wait for it to come up
        for _ in range(20):
            time.sleep(0.3)
            try:
                r = requests.get(f"{self.base_url}/_api/stats", timeout=1)
                if r.status_code == 200:
                    break
            except Exception:
                pass

        # Auto-sync from namespace
        synced = self.sync()
        return {"status": "running", "url": self.base_url, "synced": synced}

    def sync(self):
        """Pull all running services from mod namespace and register them in routy."""
        import mod as m

        ns = m.mod('server.namespace')()

        # API servers: {name: "http://host:port"}
        api_registry = ns.namespace() or {}

        # App servers: read app_registry.json
        store = m.mod('store')('~/.mod/server/registry')
        app_registry = store.get('app_registry.json', {}) or {}

        sync_data = {"apps": [], "apis": []}

        for name, url in api_registry.items():
            url = url.replace("0.0.0.0", "127.0.0.1")
            sync_data["apis"].append({
                "name": name,
                "target_url": url,
                "description": f"API: {name}"
            })

        for name, info in app_registry.items():
            if isinstance(info, dict) and "url" in info:
                sync_data["apps"].append({
                    "name": name,
                    "target_url": info["url"],
                    "description": f"App: {name}"
                })

        try:
            r = requests.post(
                f"{self.base_url}/_api/sync",
                json=sync_data, timeout=5
            )
            result = r.json()
            apps = len(sync_data["apps"])
            apis = len(sync_data["apis"])
            print(f"Synced {apps} apps + {apis} apis")
            return result
        except Exception as e:
            return {"error": str(e)}

    def register(self, name=None, url=None, description=None, website_type="app", **kwargs):
        """Register a single service."""
        if not name or not url:
            return {"error": "name and url required"}
        try:
            r = requests.post(
                f"{self.base_url}/_api/register",
                json={"name": name, "target_url": url,
                      "description": description, "website_type": website_type},
                timeout=5
            )
            return r.json()
        except Exception as e:
            return {"error": str(e)}

    def list(self):
        """List all registered services."""
        try:
            r = requests.get(f"{self.base_url}/_api/websites", timeout=5)
            data = r.json()
            apps = data.get("apps", [])
            apis = data.get("apis", [])

            if apps:
                print(f"\nApps ({len(apps)}):")
                for w in apps:
                    print(f"  /{w['name']:<20} -> {w['target_url']}")

            if apis:
                print(f"\nAPIs ({len(apis)}):")
                for w in apis:
                    print(f"  /api/{w['name']:<16} -> {w['target_url']}")

            if not apps and not apis:
                print("No services registered. Run: m routy/sync")

            return data
        except Exception as e:
            return {"error": str(e), "hint": "Is routy running? m routy/start"}

    def stats(self):
        """Get routy stats."""
        try:
            r = requests.get(f"{self.base_url}/_api/stats", timeout=5)
            return r.json()
        except Exception as e:
            return {"error": str(e)}

    def status(self):
        """Check if routy is running."""
        try:
            r = requests.get(f"{self.base_url}/_api/stats", timeout=2)
            if r.status_code == 200:
                return {"status": "running", "url": self.base_url, **r.json()}
        except Exception:
            pass
        return {"status": "not running", "hint": "m routy/start"}

    def kill(self):
        """Stop routy."""
        subprocess.run("lsof -ti:3001 | xargs kill -9", shell=True, capture_output=True)
        return {"status": "killed"}
