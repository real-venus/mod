"""
copytensor — Bittensor dTAO copy trading (FastAPI + Next.js)

Layout:
    src/
      mod.py       # this file (orchestrator + mod-protocol surface)
      api/         # FastAPI app
      chain/       # SubtensorClient with round-robin RPC failover
      engine/      # leaderboard, pnl, copier, safety
      app/         # Next.js frontend
"""

import json
import logging
import os
import subprocess
import time
from typing import Any, Dict, List, Optional

import requests
import mod as m

log = logging.getLogger("copytensor.mod")

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SRC_DIR)
API_DIR = os.path.join(SRC_DIR, "api")
APP_DIR = os.path.join(SRC_DIR, "app")


def _has_docker() -> bool:
    try:
        subprocess.run(
            ["docker", "compose", "version"],
            capture_output=True, timeout=5,
        )
        return True
    except Exception:
        return False


class Copytensor(m.Mod):
    """Bittensor dTAO copy trading — mirror subnet allocations of top performers.

    All read paths (leaderboard, subnets, account, trader, PnL) work without
    any wallet against a rotating pool of public Bittensor RPC endpoints.
    Only stake/unstake operations require a wallet (set via `set_wallet`).
    """

    name = "copytensor"
    description = (
        "Bittensor dTAO copy trading — mirror subnet allocations of top "
        "performers (round-robin public RPCs, no third-party APIs)"
    )
    fns = [
        # lifecycle
        "serve", "kill", "status", "logs", "test",
        # public-read passthroughs (no wallet needed)
        "subnets", "leaderboard", "account", "account_pnl",
        "trader", "trades", "rpc_pool",
        # watchlist
        "watch", "unwatch", "watches",
        # copy management (needs wallet)
        "create_copy", "list_copies", "pause_copy", "resume_copy",
        "delete_copy", "sync_copy",
        # wallet
        "set_wallet", "wallet_balance",
        # default
        "forward",
    ]

    api_port = 50150
    app_port = 3150

    def __init__(self, **kwargs):
        self.api_url = os.environ.get(
            "COPYTENSOR_API_URL", f"http://localhost:{self.api_port}",
        )
        self._mode: Optional[str] = None

    # ── docker lifecycle ──────────────────────────────────────────

    def _docker_serve(self, build: bool = True) -> Dict[str, Any]:
        cmd = ["docker", "compose", "up", "-d"]
        if build:
            cmd.append("--build")
        proc = subprocess.run(
            cmd, cwd=ROOT_DIR, capture_output=True, text=True,
        )
        ok = proc.returncode == 0
        self._mode = "docker" if ok else None
        return {
            "ok": ok,
            "mode": "docker",
            "api": self.api_url,
            "app": f"http://localhost:{self.app_port}/copytensor",
            "stderr_tail": proc.stderr[-2000:] if not ok else "",
        }

    def _docker_kill(self) -> Dict[str, Any]:
        proc = subprocess.run(
            ["docker", "compose", "down"],
            cwd=ROOT_DIR, capture_output=True, text=True,
        )
        return {"ok": proc.returncode == 0, "mode": "docker", "action": "stopped"}

    def _docker_status(self) -> Dict[str, Any]:
        proc = subprocess.run(
            ["docker", "compose", "ps", "--format", "json"],
            cwd=ROOT_DIR, capture_output=True, text=True,
        )
        container = "stopped"
        if proc.returncode == 0 and proc.stdout.strip():
            try:
                info = json.loads(proc.stdout.strip())
                if isinstance(info, list):
                    info = info[0] if info else {}
                container = info.get("State", info.get("status", "unknown"))
            except json.JSONDecodeError:
                container = "running"
        out = {"module": self.name, "mode": "docker", "container": container}
        try:
            r = requests.get(f"{self.api_url}/health", timeout=2)
            out["health"] = r.json() if r.ok else {"http": r.status_code}
        except Exception as e:
            out["health"] = {"error": str(e)}
        return out

    def _docker_logs(self, lines: int = 50) -> str:
        proc = subprocess.run(
            ["docker", "compose", "logs", "--tail", str(lines)],
            cwd=ROOT_DIR, capture_output=True, text=True,
        )
        return proc.stdout or proc.stderr or "<no output>"

    # ── local lifecycle ───────────────────────────────────────────

    def _local_api(self, port: Optional[int] = None) -> Dict[str, Any]:
        port = port or self.api_port
        name = "copytensor-api"
        env = {"PORT": str(port), "PYTHONPATH": SRC_DIR}
        cmd = [
            "uvicorn", "api.app:app",
            "--host", "0.0.0.0", "--port", str(port),
        ]
        try:
            pm2 = m.mod("pm.pm2")()
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start(name=name, cmd=" ".join(cmd), cwd=SRC_DIR, env=env)
            return {"ok": True, "name": name, "port": port}
        except Exception as e:
            proc = subprocess.Popen(
                cmd, cwd=SRC_DIR,
                env={**os.environ, **env},
            )
            return {"ok": True, "pid": proc.pid, "port": port, "warn": str(e)}

    def _local_app(self, port: Optional[int] = None,
                   api_port: Optional[int] = None) -> Dict[str, Any]:
        port = port or self.app_port
        api_port = api_port or self.api_port
        if not os.path.isdir(os.path.join(APP_DIR, "node_modules")):
            subprocess.run(
                ["npm", "install", "--no-audit", "--no-fund"],
                cwd=APP_DIR, capture_output=True,
            )
        name = "copytensor-app"
        env = {
            "PORT": str(port),
            "NEXT_PUBLIC_API_URL": f"http://localhost:{api_port}",
        }
        try:
            pm2 = m.mod("pm.pm2")()
            if pm2.exists(name):
                pm2.kill(name, remove_script=False)
            pm2.start(name=name, cmd=f"npm run dev -- -p {port}",
                      cwd=APP_DIR, env=env)
            return {"ok": True, "name": name, "port": port}
        except Exception as e:
            proc = subprocess.Popen(
                ["npm", "run", "dev", "--", "-p", str(port)],
                cwd=APP_DIR,
                env={**os.environ, **env},
            )
            return {"ok": True, "pid": proc.pid, "port": port, "warn": str(e)}

    # ── unified serve / kill / status / logs ──────────────────────

    def serve(self, mode: Optional[str] = None, api_port: Optional[int] = None,
              app_port: Optional[int] = None, build: bool = True, **kw) -> Dict[str, Any]:
        """Start copytensor. mode='docker' (default if available) or 'local'."""
        if mode is None:
            mode = "docker" if _has_docker() else "local"

        if mode == "docker":
            result = self._docker_serve(build=build)
            if result["ok"]:
                self._register_gateway(self.api_port, self.app_port)
            return result

        self._mode = "local"
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port

        a = self._local_api(port=api_port)
        if not a.get("ok"):
            return {"ok": False, "mode": "local", "api": a}
        time.sleep(1)
        b = self._local_app(port=app_port, api_port=api_port)

        self._register_gateway(api_port, app_port)
        return {"ok": a.get("ok") and b.get("ok"), "mode": "local",
                "api": a, "app": b}

    def _register_gateway(self, api_port: int, app_port: int):
        """Persist URLs to config.json + sync with routy gateway (best-effort)."""
        cfg_path = os.path.join(ROOT_DIR, "config.json")
        try:
            with open(cfg_path) as f:
                cfg = json.load(f)
            cfg["urls"] = {
                "api": f"http://localhost:{api_port}",
                "app": f"http://localhost:{app_port}/copytensor",
            }
            cfg["port"] = api_port
            cfg["app_port"] = app_port
            with open(cfg_path, "w") as f:
                json.dump(cfg, f, indent=4)
                f.write("\n")
        except Exception:
            pass

        import threading
        def _sync():
            for port in (3001, 3000):
                try:
                    requests.post(f"http://localhost:{port}/_api/register", json={
                        "name": "copytensor",
                        "target_url": f"http://127.0.0.1:{api_port}",
                        "website_type": "api",
                    }, timeout=3)
                    requests.post(f"http://localhost:{port}/_api/register", json={
                        "name": "copytensor",
                        "target_url": f"http://127.0.0.1:{app_port}",
                        "website_type": "app",
                    }, timeout=3)
                    break
                except Exception:
                    continue
        threading.Thread(target=_sync, daemon=True).start()

    def kill(self, target: str = "all", mode: Optional[str] = None) -> Dict[str, Any]:
        """Stop services. mode='docker' (default) or 'local'."""
        if mode is None:
            mode = self._mode or ("docker" if _has_docker() else "local")

        if mode == "docker":
            return self._docker_kill()

        out: Dict[str, Any] = {}
        try:
            pm2 = m.mod("pm.pm2")()
            if target in ("api", "all") and pm2.exists("copytensor-api"):
                pm2.kill("copytensor-api"); out["api"] = "stopped"
            if target in ("app", "all") and pm2.exists("copytensor-app"):
                pm2.kill("copytensor-app"); out["app"] = "stopped"
        except Exception as e:
            out["error"] = str(e)
        out["mode"] = "local"
        return out

    def status(self, mode: Optional[str] = None) -> Dict[str, Any]:
        """Service status. mode='docker' (default) or 'local'."""
        if mode is None:
            mode = self._mode or ("docker" if _has_docker() else "local")

        if mode == "docker":
            return self._docker_status()

        out = {"module": self.name, "mode": "local", "api_url": self.api_url}
        try:
            pm2 = m.mod("pm.pm2")()
            out["api"] = "running" if pm2.exists("copytensor-api") else "stopped"
            out["app"] = "running" if pm2.exists("copytensor-app") else "stopped"
        except Exception:
            out["api"] = out["app"] = "unknown"
        try:
            r = requests.get(f"{self.api_url}/health", timeout=2)
            out["health"] = r.json() if r.ok else {"http": r.status_code}
        except Exception as e:
            out["health"] = {"error": str(e)}
        return out

    def logs(self, target: str = "api", lines: int = 50,
             mode: Optional[str] = None) -> str:
        """Fetch logs. mode='docker' (default) or 'local'."""
        if mode is None:
            mode = self._mode or ("docker" if _has_docker() else "local")

        if mode == "docker":
            return self._docker_logs(lines=lines)

        try:
            pm2 = m.mod("pm.pm2")()
            return pm2.logs(f"copytensor-{target}", lines=lines)
        except Exception as e:
            return f"<no logs: {e}>"

    # ── data passthroughs (call live API) ─────────────────────────

    def _get(self, path: str, **params) -> Any:
        r = requests.get(f"{self.api_url}{path}", params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: Optional[Dict] = None) -> Any:
        r = requests.post(f"{self.api_url}{path}", json=body or {}, timeout=30)
        r.raise_for_status()
        return r.json()

    def _delete(self, path: str) -> Any:
        r = requests.delete(f"{self.api_url}{path}", timeout=30)
        r.raise_for_status()
        return r.json()

    # public reads (no wallet needed)
    def subnets(self) -> Any:
        return self._get("/subnets")

    def leaderboard(self, days: int = 7, top: int = 50) -> Any:
        return self._get("/leaderboard", days=str(days), top=str(top))

    def account(self, ss58: str, days: int = 7) -> Any:
        return self._get(f"/account/{ss58}", days=str(days))

    def account_pnl(self, ss58: str, days: int = 7) -> Any:
        return self._get(f"/account/{ss58}/pnl", days=str(days))

    def trader(self, ss58: str) -> Any:
        return self._get(f"/trader/{ss58}")

    def trades(self, limit: int = 50, copy_id: Optional[str] = None) -> Any:
        params: Dict[str, str] = {"limit": str(limit)}
        if copy_id:
            params["copy_id"] = copy_id
        return self._get("/trades", **params)

    def rpc_pool(self) -> Any:
        """Show the active Bittensor RPC pool + which endpoint is primary."""
        return self._get("/health")

    # watchlist
    def watch(self, ss58: str, label: Optional[str] = None) -> Any:
        return self._post("/watch", {"ss58": ss58, "label": label})

    def unwatch(self, ss58: str) -> Any:
        return self._delete(f"/watch/{ss58}")

    def watches(self) -> Any:
        return self._get("/watches")

    # copies
    def create_copy(self, target_ss58: str, our_hotkey: str,
                    label: Optional[str] = None,
                    max_tao_per_tx: Optional[float] = None,
                    daily_limit_tao: Optional[float] = None,
                    rebalance_threshold_pct: Optional[float] = None) -> Any:
        body = {
            "target_ss58": target_ss58,
            "our_hotkey": our_hotkey,
            "label": label,
            "max_tao_per_tx": max_tao_per_tx,
            "daily_limit_tao": daily_limit_tao,
            "rebalance_threshold_pct": rebalance_threshold_pct,
        }
        return self._post("/copy", {k: v for k, v in body.items() if v is not None})

    def list_copies(self) -> Any:
        return self._get("/copies")

    def pause_copy(self, copy_id: str) -> Any:
        return self._post(f"/copy/{copy_id}/pause")

    def resume_copy(self, copy_id: str) -> Any:
        return self._post(f"/copy/{copy_id}/resume")

    def delete_copy(self, copy_id: str) -> Any:
        return self._delete(f"/copy/{copy_id}")

    def sync_copy(self, copy_id: str) -> Any:
        return self._post(f"/copy/{copy_id}/sync")

    # wallet
    def set_wallet(self, mnemonic: Optional[str] = None,
                   seed_hex: Optional[str] = None) -> Any:
        body = {k: v for k, v in {"mnemonic": mnemonic, "seed_hex": seed_hex}.items() if v}
        return self._post("/wallet/set", body)

    def wallet_balance(self) -> Any:
        return self._get("/wallet/balance")

    # ── test ──────────────────────────────────────────────────────

    def test(self) -> Dict[str, Any]:
        """Hit every public read endpoint + show the RPC pool."""
        results: Dict[str, Any] = {}
        for name, fn in [
            ("health", lambda: self._get("/health")),
            ("subnets", lambda: self._get("/subnets")),
            ("leaderboard", lambda: self._get("/leaderboard", days="7", top="10")),
            ("status", lambda: self._get("/status")),
        ]:
            try:
                data = fn()
                results[name] = {"ok": True, "preview": str(data)[:200]}
            except Exception as e:
                results[name] = {"ok": False, "error": str(e)}
        passed = sum(1 for v in results.values() if v.get("ok"))
        total = len(results)
        results["summary"] = f"{passed}/{total} passed"
        results["ok"] = passed == total
        return results

    # ── forward ──────────────────────────────────────────────────

    def forward(self, fn: Optional[str] = None, **kwargs) -> Any:
        if fn is None:
            return {
                "module": self.name,
                "description": self.description,
                "fns": self.fns,
                "api": self.api_url,
                "app": f"http://localhost:{self.app_port}/copytensor",
            }
        if fn.startswith("_") or fn not in self.fns:
            raise ValueError(f"unknown fn: {fn}")
        return getattr(self, fn)(**kwargs)


Mod = Copytensor
