"""
hyperliquid — copy-trading + indexes on Hyperliquid

High-level manager:
    - builds the Rust API (cargo build --release)
    - serves the Rust API on `api_port`
    - serves the Next.js app on `app_port`
    - exposes a `forward(fn=..., **kwargs)` dispatch that mirrors the
      Rust /forward endpoint for mod-protocol callers

Layout:
    src/
      mod.py           # this file
      api/             # Rust API (axum)
        Cargo.toml
        src/...
      app/             # Next.js app
        package.json
        app/...
"""

import json
import os
import shutil
import subprocess
import time
from typing import Any, Dict, List, Optional

import requests

import mod as m

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SRC_DIR)
API_DIR = os.path.join(SRC_DIR, "api")
APP_DIR = os.path.join(SRC_DIR, "app")


class Hyperliquid(m.Mod):
    """Hyperliquid copy-trading + indexes orchestrator."""

    name = "hyperliquid"
    description = (
        "Hyperliquid DEX — copy traders by N-day performance, build "
        "weighted indexes, and back them with private vaults"
    )
    fns = [
        "forward", "serve", "app", "api", "kill", "status",
        "build", "logs",
        # data passthroughs
        "top_traders", "analyze_trader", "leaderboard",
        # indexes
        "list_indexes", "get_index", "create_index", "update_index",
        "delete_index", "index_perf", "auto_index",
        # follows
        "list_follows", "create_follow", "update_follow", "delete_follow",
        "pause_follow", "resume_follow", "list_signals",
        # vaults
        "list_vaults", "vault_details", "vault_perf", "vault_intent",
    ]

    api_port = 8919
    app_port = 3919

    def __init__(self, testnet: bool = False, api_url: Optional[str] = None, **kwargs):
        self.testnet = testnet or os.environ.get("HYPERLIQUID_TESTNET", "").lower() == "true"
        self.api_url = api_url or os.environ.get(
            "HL_API_URL", f"http://localhost:{self.api_port}"
        )

    # ── lifecycle ────────────────────────────────────────────────────

    def build(self, release: bool = True) -> Dict[str, Any]:
        """Compile the Rust API. Idempotent — `cargo` skips work if up to date."""
        if not shutil.which("cargo"):
            return {"ok": False, "error": "cargo not on PATH — install rust toolchain"}
        cmd = ["cargo", "build"]
        if release:
            cmd.append("--release")
        proc = subprocess.run(cmd, cwd=API_DIR, capture_output=True, text=True)
        return {
            "ok": proc.returncode == 0,
            "release": release,
            "stdout_tail": proc.stdout[-2000:],
            "stderr_tail": proc.stderr[-2000:],
        }

    def _api_binary(self) -> str:
        rel = os.path.join(API_DIR, "target", "release", "hyperliquid-api")
        dbg = os.path.join(API_DIR, "target", "debug", "hyperliquid-api")
        if os.path.exists(rel): return rel
        if os.path.exists(dbg): return dbg
        return ""

    def api(self, port: Optional[int] = None, build: bool = True) -> Dict[str, Any]:
        """Start the Rust API under pm2."""
        port = port or self.api_port
        if build:
            r = self.build(release=True)
            if not r["ok"]:
                return {"ok": False, "stage": "build", **r}
        bin_path = self._api_binary()
        if not bin_path:
            return {"ok": False, "error": "binary not found after build"}

        script = os.path.join(SRC_DIR, "_api.sh")
        env_lines = [
            f"export PORT={port}",
            f'export HYPERLIQUID_TESTNET={"true" if self.testnet else "false"}',
        ]
        with open(script, "w") as f:
            f.write("#!/bin/bash\n" + "\n".join(env_lines) + f"\nexec {bin_path}\n")
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod("pm.pm2")()
            name = "hyperliquid-api"
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=SRC_DIR, interpreter="bash")
            return {"ok": True, "manager": "pm2", "name": name, "port": port,
                    "url": f"http://localhost:{port}"}
        except Exception as e:
            proc = subprocess.Popen(["bash", script], cwd=SRC_DIR)
            return {"ok": True, "manager": "subprocess", "pid": proc.pid,
                    "port": port, "url": f"http://localhost:{port}",
                    "warn": f"pm2 unavailable ({e}); using subprocess"}

    def app(self, port: Optional[int] = None, dev: bool = True,
            install: bool = True) -> Dict[str, Any]:
        """Start the Next.js app under pm2."""
        port = port or self.app_port
        if install and not os.path.isdir(os.path.join(APP_DIR, "node_modules")):
            r = subprocess.run(["npm", "install", "--no-audit", "--no-fund"],
                               cwd=APP_DIR, capture_output=True, text=True)
            if r.returncode != 0:
                return {"ok": False, "stage": "install", "stderr": r.stderr[-2000:]}

        cmd = (
            f"npm run dev -- -p {port}" if dev
            else f"npm run build && npm run start -- -p {port}"
        )
        script = os.path.join(SRC_DIR, "_app.sh")
        with open(script, "w") as f:
            f.write(
                "#!/bin/bash\n"
                f"export HL_API_URL={self.api_url}\n"
                f"cd {APP_DIR}\n"
                f"{cmd}\n"
            )
        os.chmod(script, 0o755)

        try:
            pm2 = m.mod("pm.pm2")()
            name = "hyperliquid-app"
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start_script(name=name, script_path=script, cwd=APP_DIR, interpreter="bash")
            return {"ok": True, "manager": "pm2", "name": name, "port": port,
                    "url": f"http://localhost:{port}"}
        except Exception as e:
            proc = subprocess.Popen(["bash", script], cwd=APP_DIR)
            return {"ok": True, "manager": "subprocess", "pid": proc.pid,
                    "port": port, "url": f"http://localhost:{port}",
                    "warn": f"pm2 unavailable ({e}); using subprocess"}

    def serve(self, api_port: Optional[int] = None, app_port: Optional[int] = None,
              dev: bool = True, build: bool = True, **kwargs) -> Dict[str, Any]:
        """Start both api + app."""
        a = self.api(port=api_port, build=build)
        if not a.get("ok"):
            return {"ok": False, "api": a}
        # let the API come up before the Next dev server tries to proxy
        time.sleep(1.0)
        b = self.app(port=app_port, dev=dev)
        return {"ok": a.get("ok") and b.get("ok"), "api": a, "app": b}

    def kill(self, target: str = "all") -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        try:
            pm2 = m.mod("pm.pm2")()
            if target in ("api", "all") and pm2.exists("hyperliquid-api"):
                pm2.kill("hyperliquid-api"); out["api"] = "stopped"
            if target in ("app", "all") and pm2.exists("hyperliquid-app"):
                pm2.kill("hyperliquid-app"); out["app"] = "stopped"
        except Exception as e:
            out["error"] = str(e)
        return out

    def status(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {"module": "hyperliquid", "testnet": self.testnet,
                               "api_url": self.api_url}
        try:
            pm2 = m.mod("pm.pm2")()
            out["api"] = "running" if pm2.exists("hyperliquid-api") else "stopped"
            out["app"] = "running" if pm2.exists("hyperliquid-app") else "stopped"
        except Exception:
            out["api"] = out["app"] = "unknown"
        try:
            r = requests.get(f"{self.api_url}/status", timeout=2)
            out["api_status"] = r.json() if r.ok else {"http": r.status_code}
        except Exception as e:
            out["api_status"] = {"error": str(e)}
        return out

    def logs(self, target: str = "api", lines: int = 100) -> str:
        try:
            pm2 = m.mod("pm.pm2")()
            return pm2.logs(f"hyperliquid-{target}", lines=lines)
        except Exception as e:
            return f"<no pm2 logs: {e}>"

    # ── data passthroughs (use the Rust API) ──────────────────────

    def _get(self, path: str, **params) -> Any:
        r = requests.get(f"{self.api_url}{path}", params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: Any) -> Any:
        r = requests.post(f"{self.api_url}{path}", json=body, timeout=60)
        r.raise_for_status()
        return r.json()

    def _patch(self, path: str, body: Any) -> Any:
        r = requests.patch(f"{self.api_url}{path}", json=body, timeout=30)
        r.raise_for_status()
        return r.json()

    def _delete(self, path: str) -> Any:
        r = requests.delete(f"{self.api_url}{path}", timeout=15)
        r.raise_for_status()
        return r.json()

    def top_traders(self, days: int = 7, min_per_day: float = 1.0,
                    pool: int = 150, seed: Optional[List[str]] = None) -> Any:
        params = {"days": days, "min_per_day": min_per_day, "pool": pool}
        if seed: params["seed"] = ",".join(seed)
        return self._get("/traders/top", **params)

    def analyze_trader(self, address: str, days: int = 7) -> Any:
        return self._get(f"/trader/{address}/analyze", days=days)

    def leaderboard(self) -> Any: return self._get("/leaderboard")

    # indexes
    def list_indexes(self) -> Any: return self._get("/indexes")
    def get_index(self, id: str) -> Any: return self._get(f"/indexes/{id}")
    def create_index(self, **body) -> Any: return self._post("/indexes", body)
    def update_index(self, id: str, **body) -> Any: return self._patch(f"/indexes/{id}", body)
    def delete_index(self, id: str) -> Any: return self._delete(f"/indexes/{id}")
    def index_perf(self, id: str, days: Optional[int] = None) -> Any:
        return self._get(f"/indexes/{id}/perf", **({"days": days} if days else {}))
    def auto_index(self, **body) -> Any: return self._post("/indexes/auto", body)

    # follows
    def list_follows(self, follower: Optional[str] = None) -> Any:
        return self._get("/follows", **({"follower": follower} if follower else {}))
    def create_follow(self, **body) -> Any: return self._post("/follows", body)
    def update_follow(self, id: str, **body) -> Any: return self._patch(f"/follows/{id}", body)
    def delete_follow(self, id: str) -> Any: return self._delete(f"/follows/{id}")
    def pause_follow(self, id: str) -> Any: return self._post(f"/follows/{id}/pause", {})
    def resume_follow(self, id: str) -> Any: return self._post(f"/follows/{id}/resume", {})
    def list_signals(self, follower: Optional[str] = None, limit: int = 100) -> Any:
        params: Dict[str, Any] = {"limit": limit}
        if follower: params["follower"] = follower
        return self._get("/signals", **params)

    # vaults
    def list_vaults(self) -> Any: return self._get("/vaults")
    def vault_details(self, address: str) -> Any: return self._get(f"/vaults/{address}")
    def vault_perf(self, address: str) -> Any: return self._get(f"/vaults/{address}/perf")
    def vault_intent(self, index_id: str, initial_usd: float, nonce: Optional[int] = None) -> Any:
        body: Dict[str, Any] = {"initial_usd": initial_usd}
        if nonce is not None: body["nonce"] = nonce
        return self._post(f"/indexes/{index_id}/vault/intent", body)

    # ── mod-protocol forward ──

    def forward(self, fn: Optional[str] = None, **kwargs) -> Any:
        """Dispatch any whitelisted method by name (mod-protocol entry)."""
        if fn is None:
            return {"module": self.name, "fns": self.fns,
                    "api": self.api_url, "testnet": self.testnet}
        if fn.startswith("_") or fn not in self.fns:
            raise ValueError(f"unknown fn: {fn}")
        return getattr(self, fn)(**kwargs)


# Class alias kept for compatibility with `m.mod('hyperliquid')` lookups
Mod = Hyperliquid
