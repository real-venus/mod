"""
dev — unified developer console orchestrator.

Loads config.json, exposes the list of providers (claude, codex), and provides
a bundle()/register() pair that snapshots the dev+claude+codex trees to localfs
and registers the resulting CID on the mod protocol on-chain registry.

The Next.js frontend (src/app) talks to claude/codex backends through a thin
FastAPI proxy (src/api) that enforces the owner gate and resolves API keys
from the wallet-signature ciphertext store.
"""

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Optional

import mod as m


class Mod:
    description = "Unified dev console for claude + codex orchestrators"
    path = r"/Users/broski/mod/mod/orbit/dev"

    def __init__(self):
        self._cfg_path = os.path.join(self.path, "config.json")
        self._cfg = self._load_config()

    def _load_config(self) -> dict:
        if not os.path.exists(self._cfg_path):
            return {}
        with open(self._cfg_path) as f:
            return json.load(f)

    def _save_config(self, cfg: dict):
        with open(self._cfg_path, "w") as f:
            json.dump(cfg, f, indent=4)
        self._cfg = cfg

    # ── Public API ────────────────────────────────────────────────────

    def forward(self, **kwargs):
        return self.info()

    def info(self) -> dict:
        return {
            "name": self._cfg.get("name", "dev"),
            "version": self._cfg.get("version"),
            "description": self.description,
            "path": self.path,
            "providers": list(self._cfg.get("providers", {}).keys()),
            "ports": {
                "api": self._cfg.get("port"),
                "app": self._cfg.get("app_port"),
            },
            "schema": self._cfg.get("schema") or None,
            "owner": self._cfg.get("owner"),
        }

    def providers(self) -> Dict[str, dict]:
        return self._cfg.get("providers", {})

    def health(self) -> dict:
        result = {"dev": "ok", "providers": {}}
        for name, p in self.providers().items():
            api = p.get("api")
            try:
                import urllib.request as r
                with r.urlopen(f"{api}/health", timeout=2) as resp:
                    result["providers"][name] = "ok" if resp.status == 200 else f"status {resp.status}"
            except Exception as e:
                result["providers"][name] = f"unreachable: {type(e).__name__}"
        return result

    # ── Bundle + Registry ─────────────────────────────────────────────

    def _orbit_dir(self) -> Path:
        return Path(self.path).parent

    def _bundle_paths(self) -> List[Path]:
        orbit = self._orbit_dir()
        return [orbit / "dev", orbit / "claude", orbit / "codex", orbit / "localfs"]

    def bundle(self, key: Optional[str] = None) -> dict:
        """Snapshot dev+claude+codex trees to localfs and return per-module CIDs.

        Owner-only. Each module's content tree is put to localfs via m.cid().
        A combined manifest (per-module CIDs) is itself put as a single root
        CID that gets persisted to dev/config.json:schema.
        """
        self._require_owner(key, "bundle")
        modules = {}
        for base in self._bundle_paths():
            if not base.exists():
                continue
            modules[base.name] = m.cid(base.name)

        manifest = {
            "kind": "mod-protocol-bundle",
            "version": 1,
            "created_at": int(time.time()),
            "modules": modules,
            "owner": self._cfg.get("owner"),
        }
        root_cid = m.fn("api/put")(json.dumps(manifest, separators=(",", ":")))
        cfg = self._load_config()
        cfg["schema"] = root_cid
        cfg["bundled_at"] = manifest["created_at"]
        cfg["bundle_modules"] = modules
        self._save_config(cfg)
        return {"cid": root_cid, "modules": modules}

    def register(self, name: str = "dev", cid: Optional[str] = None, key: Optional[str] = None) -> dict:
        """Register a module bundle CID on the mod protocol on-chain registry.

        Owner-only. Calls registry.registerMod(name, cid) on Base Sepolia.
        For `name='dev'`, defaults to the bundle root CID at config.json:schema.
        For sub-modules (e.g. 'codex', 'claude'), pass their own CID or omit
        to use the per-module CID captured by the last bundle().
        """
        self._require_owner(key, "register")
        if cid is None:
            if name == "dev":
                cid = self._cfg.get("schema")
            else:
                cid = (self._cfg.get("bundle_modules") or {}).get(name)
        if not cid:
            return {"error": f"no CID for {name!r} — run dev.bundle() first or pass cid="}

        chain = m.mod("chain")()
        result = chain.reg(name, cid)
        return {"ok": True, "name": name, "cid": cid, "tx": result}

    def register_all(self, key: Optional[str] = None) -> dict:
        """Register dev + every sub-module in the last bundle. Owner-only."""
        self._require_owner(key, "register_all")
        results = {"dev": self.register(name="dev", key=key)}
        for mod_name in (self._cfg.get("bundle_modules") or {}).keys():
            if mod_name == "dev":
                continue
            results[mod_name] = self.register(name=mod_name, key=key)
        return results

    # ── Serve ─────────────────────────────────────────────────────────

    # ── Serve / Gateway orchestration ─────────────────────────────────

    PIDFILE = "/tmp/mod-dev-served.json"
    DEFAULT_GATEWAY_PORT = 8888
    DEFAULT_MODULES = ("claude", "codex", "dev", "localfs")

    def _read_pidfile(self) -> dict:
        p = Path(self.PIDFILE)
        return json.loads(p.read_text()) if p.exists() else {"gateway": None, "modules": {}}

    def _write_pidfile(self, data: dict):
        Path(self.PIDFILE).write_text(json.dumps(data, indent=2))

    def _pid_alive(self, pid: Optional[int]) -> bool:
        if not pid:
            return False
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False

    def _start_module(self, name: str) -> dict:
        """Start a single module's backend. Idempotent — returns existing record if alive."""
        state = self._read_pidfile()
        existing = state["modules"].get(name)
        if existing and self._pid_alive(existing.get("pid")):
            return {**existing, "already_running": True}

        if name == "dev":
            api_port = self._cfg.get("port", 8870)
            api_dir = os.path.join(self.path, "src", "api")
            env = os.environ.copy()
            env.setdefault("DEV_KEY_DIR", os.path.expanduser("~/.mod/dev"))
            for prov in self.providers():
                env.setdefault(f"{prov.upper()}_API", f"http://127.0.0.1:{self._provider_port(prov)}")
            proc = subprocess.Popen(
                ["uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(api_port)],
                cwd=api_dir, env=env,
                stdout=open(f"/tmp/mod-{name}.log", "ab"),
                stderr=subprocess.STDOUT,
            )
            return {"pid": proc.pid, "port": api_port, "kind": "fastapi", "url": f"http://127.0.0.1:{api_port}"}

        # claude / codex / generic Rust backend
        mod_path = self._orbit_dir() / name
        cfg_path = mod_path / "config.json"
        if not cfg_path.exists():
            raise FileNotFoundError(f"{name}: config.json missing at {cfg_path}")
        cfg = json.loads(cfg_path.read_text())
        port = cfg.get("port")
        binary = mod_path / "src" / "api" / "target" / "release" / f"{name}-jobs"
        if not binary.exists():
            raise FileNotFoundError(f"{name}: binary missing — run `cargo build --release` in {binary.parent.parent}")
        env = os.environ.copy()
        env["BIND_HOST"] = "127.0.0.1"
        proc = subprocess.Popen(
            [str(binary), str(port)],
            env=env,
            stdout=open(f"/tmp/mod-{name}.log", "ab"),
            stderr=subprocess.STDOUT,
        )
        return {"pid": proc.pid, "port": port, "kind": "rust", "url": f"http://127.0.0.1:{port}"}

    def _provider_port(self, name: str) -> int:
        cfg_path = self._orbit_dir() / name / "config.json"
        if cfg_path.exists():
            return json.loads(cfg_path.read_text()).get("port", 0)
        return 0

    def _module_route_entry(self, name: str, port: int, app_port: Optional[int] = None) -> str:
        app_port = app_port or port
        return f"""    @{name}_api path /api/{name} /api/{name}/*
    handle @{name}_api {{
        uri strip_prefix /api/{name}
        reverse_proxy 127.0.0.1:{port}
    }}
    @{name}_app path /{name} /{name}/*
    handle @{name}_app {{
        reverse_proxy 127.0.0.1:{app_port}
    }}
"""

    def _render_caddyfile(self, served: Dict[str, dict], gateway_port: int) -> str:
        routes = "\n".join(self._module_route_entry(n, r["port"]) for n, r in served.items())
        landing = "dev" if "dev" in served else next(iter(served), "")
        return f"""{{
    admin off
    auto_https off
}}

# auto-generated by dev.serve() — DO NOT hand-edit; regenerated each run.
:{gateway_port} {{
{routes}
    handle / {{
        redir /{landing} permanent
    }}
    handle /* {{
        respond "mod gateway — served: {', '.join(served)}" 200
    }}
}}
"""

    def _start_caddy(self, caddyfile: str, gateway_port: int) -> dict:
        state = self._read_pidfile()
        cf_path = Path(self.path) / ".gateway.Caddyfile"
        cf_path.write_text(caddyfile)
        # stop existing caddy if running
        if state.get("gateway") and self._pid_alive(state["gateway"].get("pid")):
            try:
                os.kill(state["gateway"]["pid"], 15)
                time.sleep(0.5)
            except ProcessLookupError:
                pass
        proc = subprocess.Popen(
            ["caddy", "run", "--config", str(cf_path), "--adapter", "caddyfile"],
            stdout=open("/tmp/mod-caddy.log", "ab"),
            stderr=subprocess.STDOUT,
        )
        return {"pid": proc.pid, "port": gateway_port, "config": str(cf_path)}

    def _wait_healthy(self, url: str, timeout: float = 5.0) -> bool:
        import urllib.request
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"{url}/health", timeout=1) as r:
                    if r.status == 200:
                        return True
            except Exception:
                time.sleep(0.2)
        return False

    def serve(self, port: int = None, push_chain: bool = False, key=None) -> dict:
        """Serve the dev FastAPI from the local filesystem and wire it into
        the main caddy gateway at http://localhost:3000/dev.

        Uvicorn binds to 0.0.0.0 so the caddy container can reach the host
        via `host.docker.internal`. The main Caddyfile already routes both
        `/dev` and `/api/dev` to that host. Reloads caddy so edits take effect.
        Idempotent — if uvicorn is already alive on the port, reuses it.
        """
        api_port = port or self._cfg.get("port", 8870)
        api_dir = Path(self.path) / "src" / "api"
        if not (api_dir / "main.py").exists():
            raise FileNotFoundError(f"dev: missing FastAPI entry at {api_dir / 'main.py'}")

        served = self._start_local_api(api_port, api_dir)
        ready_local = self._wait_healthy_url(f"http://127.0.0.1:{api_port}/health", timeout=10.0)
        caddy_reload = self._reload_main_caddy()
        gateway_url = "http://localhost:3000"
        ready_gw = self._wait_healthy_url(f"{gateway_url}/api/dev/health", timeout=10.0)

        merkle = self.merkle(modules=["dev"])
        result = {
            "gateway": gateway_url,
            "url": f"{gateway_url}/dev",
            "api": f"{gateway_url}/api/dev",
            "local_api": f"http://127.0.0.1:{api_port}",
            "served": served,
            "ready_local": ready_local,
            "ready_gateway": ready_gw,
            "caddy_reload": caddy_reload,
            "merkle_root": merkle["root"],
            "merkle_leaves": merkle["leaves"],
        }
        if push_chain:
            result["chain"] = self.sync(push=True, key=key)
        return result

    def _start_local_api(self, api_port: int, api_dir: Path) -> dict:
        """Run uvicorn on 0.0.0.0:api_port from the local filesystem. Idempotent."""
        state = self._read_pidfile()
        existing = (state.get("modules") or {}).get("dev")
        if existing and self._pid_alive(existing.get("pid")):
            # Verify it's actually answering on the expected port.
            if self._wait_healthy_url(f"http://127.0.0.1:{api_port}/health", timeout=2.0):
                return {**existing, "already_running": True}

        env = os.environ.copy()
        env.setdefault("DEV_KEY_DIR", os.path.expanduser("~/.mod/dev"))
        for prov in self.providers():
            env.setdefault(f"{prov.upper()}_API",
                           f"http://host.docker.internal:{self._provider_port(prov)}")
        proc = subprocess.Popen(
            ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(api_port)],
            cwd=str(api_dir), env=env,
            stdout=open("/tmp/mod-dev.log", "ab"),
            stderr=subprocess.STDOUT,
        )
        record = {"pid": proc.pid, "port": api_port, "kind": "fastapi",
                  "url": f"http://0.0.0.0:{api_port}"}
        state = self._read_pidfile()
        state.setdefault("modules", {})["dev"] = record
        state["started_at"] = int(time.time())
        self._write_pidfile(state)
        return record

    def _reload_main_caddy(self) -> dict:
        proc = subprocess.run(
            ["docker", "exec", "caddy", "caddy", "reload", "--config", "/etc/caddy/Caddyfile"],
            capture_output=True, text=True,
        )
        return {"ok": proc.returncode == 0, "stderr": proc.stderr.strip()}

    def _wait_healthy_url(self, url: str, timeout: float = 10.0) -> bool:
        import urllib.request
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(url, timeout=1) as r:
                    if r.status == 200:
                        return True
            except Exception:
                time.sleep(0.3)
        return False


    def unserve(self) -> dict:
        """Kill the local uvicorn started by serve()."""
        state = self._read_pidfile()
        killed = []
        for name, info in (state.get("modules") or {}).items():
            pid = info.get("pid")
            if pid and self._pid_alive(pid):
                try:
                    os.kill(pid, 15)
                    killed.append({"name": name, "pid": pid})
                except ProcessLookupError:
                    pass
        if Path(self.PIDFILE).exists():
            Path(self.PIDFILE).unlink()
        return {"killed": killed}

    def status(self) -> dict:
        """Report what's currently served + gateway state."""
        state = self._read_pidfile()
        result = {"gateway": None, "modules": {}}
        gw = state.get("gateway") or {}
        if gw.get("pid"):
            result["gateway"] = {**gw, "alive": self._pid_alive(gw["pid"])}
        for name, info in (state.get("modules") or {}).items():
            result["modules"][name] = {**info, "alive": self._pid_alive(info.get("pid"))}
        return result

    # ── Merkle root + chain sync ──────────────────────────────────────

    def _module_content_hash(self, name: str) -> str:
        """Deterministic sha3-256 over a module's tree contents.

        Walks the module dir, sorts paths, hashes a canonical JSON of
        {relpath: file_content}. Skips build/cache dirs. Returns hex digest.
        """
        from hashlib import sha3_256
        base = self._orbit_dir() / name
        if not base.exists():
            return ""
        excluded = {"target", "node_modules", "__pycache__", ".next", ".git",
                    ".history", ".logs", ".pytest_cache", ".gateway.Caddyfile"}
        entries = {}
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in excluded and not d.startswith(".")]
            for fn in files:
                if fn in excluded:
                    continue
                fp = Path(root) / fn
                try:
                    rel = str(fp.relative_to(base))
                    entries[rel] = fp.read_text(encoding="utf-8")
                except (UnicodeDecodeError, OSError):
                    continue
        canonical = json.dumps(entries, sort_keys=True, separators=(",", ":"))
        return sha3_256(canonical.encode()).hexdigest()

    def merkle(self, modules=None, include_communes: bool = True) -> dict:
        """Compute a deterministic merkle root over the named modules AND
        any registered communes (subregistries owned by individual wallets).

        Each module leaf  = sha3-256("module:{name}:{content_hash}")
        Each commune leaf = sha3-256("commune:{name}:{root}")

        Leaves are sorted alphabetically by their typed key so the root is
        reproducible regardless of insertion order. Pairs are hashed bottom-up;
        odd nodes are paired with themselves.

        This is the key scaling primitive: each commune compresses an
        arbitrary number of user-owned sub-modules into one 32-byte leaf,
        so the on-chain footprint stays constant (one root) while the number
        of users under the system grows without bound.
        """
        from hashlib import sha3_256
        if modules is None:
            modules = list(self.DEFAULT_MODULES)
        elif isinstance(modules, str):
            modules = [m.strip() for m in modules.split(",") if m.strip()]
        leaves: List[dict] = []
        for name in sorted(modules):
            content_hash = self._module_content_hash(name)
            key = f"module:{name}"
            leaf_hex = sha3_256(f"{key}:{content_hash}".encode()).hexdigest()
            leaves.append({"kind": "module", "name": name, "content_hash": content_hash,
                           "leaf": leaf_hex, "_sort": key})
        if include_communes:
            for c in sorted(self._read_communes(), key=lambda x: x["name"]):
                key = f"commune:{c['name']}"
                leaf_hex = sha3_256(f"{key}:{c['root']}".encode()).hexdigest()
                leaves.append({"kind": "commune", "name": c["name"], "root": c["root"],
                               "owner": c.get("owner"), "member_count": len(c.get("modules", [])),
                               "leaf": leaf_hex, "_sort": key})
        leaves.sort(key=lambda x: x["_sort"])
        for leaf in leaves:
            leaf.pop("_sort", None)
        if not leaves:
            return {"root": None, "leaves": []}
        layer = [bytes.fromhex(l["leaf"]) for l in leaves]
        while len(layer) > 1:
            nxt = []
            for i in range(0, len(layer), 2):
                a = layer[i]
                b = layer[i + 1] if i + 1 < len(layer) else a
                nxt.append(sha3_256(a + b).digest())
            layer = nxt
        return {"root": "0x" + layer[0].hex(), "leaves": leaves}

    # ── Communes (subregistry of user-owned proxy modules) ────────────

    COMMUNES_PATH = Path(os.path.expanduser("~/.mod/dev/communes.json"))

    def _read_communes(self) -> List[dict]:
        if not self.COMMUNES_PATH.exists():
            return []
        try:
            return json.loads(self.COMMUNES_PATH.read_text())
        except json.JSONDecodeError:
            return []

    def _write_communes(self, data: List[dict]):
        self.COMMUNES_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.COMMUNES_PATH.write_text(json.dumps(data, indent=2))

    def _commune_root(self, modules: List[dict]) -> str:
        """Merkle root for a single commune's modules.

        Each module entry is `{name, content_hash}`. Leaves are
        sha3-256("{name}:{content_hash}"); structure mirrors top-level merkle.
        """
        from hashlib import sha3_256
        if not modules:
            return "0x" + "00" * 32
        leaves = sorted(modules, key=lambda x: x["name"])
        layer = [sha3_256(f"{m['name']}:{m['content_hash']}".encode()).digest() for m in leaves]
        while len(layer) > 1:
            layer = [sha3_256(layer[i] + (layer[i + 1] if i + 1 < len(layer) else layer[i])).digest()
                     for i in range(0, len(layer), 2)]
        return "0x" + layer[0].hex()

    def communes(self) -> List[dict]:
        """List all registered communes (subregistries)."""
        return self._read_communes()

    def commune(self, name: str) -> Optional[dict]:
        """Get one commune by name."""
        for c in self._read_communes():
            if c["name"] == name:
                return c
        return None

    def create_commune(self, name: str, modules: List[dict], owner: str,
                       signature: Optional[str] = None) -> dict:
        """Register a new commune.

        modules: list of {name, content_hash} entries identifying the proxy
        modules under this commune. The commune's merkle root is computed
        from these entries; the top-level dev merkle then includes the
        commune as a single leaf, regardless of member count.

        Auth: the caller must supply an `owner` wallet address. When called
        via the HTTP API, the FastAPI layer verifies a signature over the
        challenge "mod-commune-create:{name}" before invoking this method.
        """
        owner = owner.lower()
        if not owner.startswith("0x") or len(owner) != 42:
            raise ValueError(f"invalid owner address: {owner!r}")
        if not name or "/" in name or len(name) > 64:
            raise ValueError(f"invalid commune name: {name!r}")
        if not isinstance(modules, list) or not all(isinstance(x, dict) and "name" in x and "content_hash" in x for x in modules):
            raise ValueError("modules must be a list of {name, content_hash}")
        communes = self._read_communes()
        existing = next((c for c in communes if c["name"] == name), None)
        if existing and existing["owner"].lower() != owner:
            raise PermissionError(f"commune {name!r} already owned by {existing['owner']}")
        root = self._commune_root(modules)
        now = int(time.time())
        if existing:
            existing.update({"modules": modules, "root": root, "updated_at": now, "signature": signature})
            result = existing
        else:
            result = {"name": name, "owner": owner, "modules": modules, "root": root,
                      "created_at": now, "updated_at": now, "signature": signature}
            communes.append(result)
        self._write_communes(communes)
        return result

    def delete_commune(self, name: str, owner: str) -> dict:
        """Delete a commune. Caller must be the commune's owner.

        Note: the FastAPI layer should verify a signature over the challenge
        "mod-commune-delete:{name}" before invoking this.
        """
        owner = owner.lower()
        communes = self._read_communes()
        match = next((c for c in communes if c["name"] == name), None)
        if not match:
            return {"deleted": False, "reason": "not found"}
        if match["owner"].lower() != owner:
            raise PermissionError(f"only owner {match['owner']} may delete commune {name!r}")
        communes = [c for c in communes if c["name"] != name]
        self._write_communes(communes)
        return {"deleted": True, "name": name}

    # ── Watcher (auto-resync merkle on config changes) ────────────────

    WATCH_STATE = Path("/tmp/mod-dev-watch.json")
    WATCH_LOG = Path("/tmp/mod-dev-watch.log")

    def watch(self, interval: int = 30, push: bool = True, modules: Optional[str] = None) -> dict:
        """Start a background process that re-syncs the merkle on config changes.

        The watcher polls config.json mtimes every `interval` seconds.
        When any change is detected, it recomputes the merkle and (if
        push=True and the caller is the owner) pushes the new root on-chain.

        Idempotent — re-running while a watcher is alive is a no-op.
        """
        existing = self.watch_status()
        if existing.get("alive"):
            return {**existing, "already_running": True}

        cmd = ["python3", str(Path(self.path) / "src" / "watcher.py"),
               "--interval", str(interval)]
        if push:
            cmd.append("--push")
        if modules:
            cmd.extend(["--modules", modules])

        proc = subprocess.Popen(
            cmd,
            stdout=open(self.WATCH_LOG, "ab"),
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        # The watcher writes its own state file with its PID; give it a moment.
        time.sleep(0.5)
        return {"pid": proc.pid, "interval": interval, "push": push,
                "log": str(self.WATCH_LOG), "state": str(self.WATCH_STATE)}

    def unwatch(self) -> dict:
        """Stop the watcher process."""
        state = self.watch_status()
        if not state.get("alive"):
            self.WATCH_STATE.unlink(missing_ok=True)
            return {"stopped": False, "reason": "not running"}
        try:
            os.kill(state["pid"], 15)
        except ProcessLookupError:
            pass
        self.WATCH_STATE.unlink(missing_ok=True)
        return {"stopped": True, "pid": state["pid"]}

    def watch_status(self) -> dict:
        """Return current watcher state (PID, last root, last sync, etc.)."""
        if not self.WATCH_STATE.exists():
            return {"alive": False}
        try:
            data = json.loads(self.WATCH_STATE.read_text())
        except json.JSONDecodeError:
            return {"alive": False}
        data["alive"] = self._pid_alive(data.get("pid"))
        return data

    def sync(self, push: bool = False, key: Optional[str] = None) -> dict:
        """Compare local merkle vs on-chain. If push=True and they differ,
        write the current root via the registry contract (owner-only).
        """
        local = self.merkle()
        chain = m.mod("chain")()
        try:
            on_chain = chain.get("dev-merkle") if hasattr(chain, "get") else None
        except Exception:
            on_chain = None
        in_sync = on_chain == local["root"] and local["root"] is not None
        result = {"local_root": local["root"], "chain_root": on_chain, "in_sync": in_sync}
        if push and not in_sync:
            self._require_owner(key, "sync.push")
            if local["root"] is None:
                result["error"] = "no local merkle — nothing to push"
                return result
            tx = chain.reg("dev-merkle", local["root"])
            result["tx"] = tx
            result["pushed"] = True
        return result

    # ── Owner gate ────────────────────────────────────────────────────

    def _require_owner(self, key: Optional[str], op: str):
        owner = (self._cfg.get("owner") or "").lower()
        if not owner:
            raise PermissionError(f"{op}: no owner set in config.json")
        try:
            if key is None:
                addr = m.key().address.lower()
            elif hasattr(key, "address"):
                addr = key.address.lower()
            elif isinstance(key, str) and key.startswith("0x") and len(key) in (42, 66):
                addr = key.lower()
            else:
                addr = m.key(key).address.lower()
        except Exception as e:
            raise PermissionError(f"{op}: cannot resolve caller address ({e})")
        if addr != owner:
            raise PermissionError(f"{op}: only owner {owner} may call this (got {addr})")
