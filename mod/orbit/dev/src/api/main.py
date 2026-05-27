"""
dev proxy API — single-port frontend for claude + codex backends.

Endpoints are mounted under both `/` (so prefix-stripping reverse proxies like
Caddy work) and `/api/dev` (so direct browser hits without a proxy work). The
UI is served at both `/` and `/dev`.

GET  /health                       — liveness
GET  /config                       — module config.json
GET  /providers                    — list of providers (claude, codex)
GET  /key/{provider}               — fetch wallet's encrypted key (if set)
POST /key/{provider}               — store the wallet's encrypted key
                                       body: { ciphertext, iv }
                                       header: X-Mod-Signature (wallet sig over challenge)
ANY  /proxy/{provider}/{path}      — proxy request to claude/codex backend
"""

import json
import os
from pathlib import Path
from typing import Optional

import httpx
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import APIRouter, FastAPI, HTTPException, Header, Request
from fastapi.responses import FileResponse, JSONResponse, Response

CONFIG_PATH = Path("/app/config.json") if Path("/app/config.json").exists() else Path(__file__).resolve().parents[2] / "config.json"
KEY_STORE_DIR = Path(os.environ.get("DEV_KEY_DIR", "/home/node/.mod/dev"))
KEY_STORE_DIR.mkdir(parents=True, exist_ok=True)
KEY_STORE_PATH = KEY_STORE_DIR / "keys.json"

SIGNATURE_CHALLENGE = "mod-key-derivation-v1"

with CONFIG_PATH.open() as f:
    CONFIG = json.load(f)

PROVIDERS = dict(CONFIG.get("providers", {}))
# Env override for upstream API URL — useful when running outside Docker where
# the in-network hostnames (claude:8820, codex:8830) don't resolve.
for _name in list(PROVIDERS):
    _env_url = os.environ.get(f"{_name.upper()}_API")
    if _env_url:
        PROVIDERS[_name] = {**PROVIDERS[_name], "api": _env_url}

OWNER = (CONFIG.get("owner") or "").lower()
UI_PATH = Path(__file__).resolve().parents[1] / "app" / "index.html"

app = FastAPI(title="mod/dev proxy", version=CONFIG.get("version", "0.1.0"))
api = APIRouter()


def _load_store() -> dict:
    if not KEY_STORE_PATH.exists():
        return {}
    return json.loads(KEY_STORE_PATH.read_text() or "{}")


def _save_store(d: dict) -> None:
    KEY_STORE_PATH.write_text(json.dumps(d, indent=2))


def _recover_wallet(signature: Optional[str]) -> str:
    if not signature:
        raise HTTPException(status_code=401, detail="missing X-Mod-Signature")
    try:
        msg = encode_defunct(text=SIGNATURE_CHALLENGE)
        return Account.recover_message(msg, signature=signature).lower()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"invalid signature: {e}")


@api.get("/health")
def health():
    return {"status": "ok", "name": CONFIG.get("name"), "version": CONFIG.get("version")}


@api.get("/config")
def get_config():
    return CONFIG


@api.get("/providers")
def get_providers():
    return {name: {k: v for k, v in p.items() if k != "env_key"} for name, p in PROVIDERS.items()}


@api.get("/key/{provider}")
def get_key(provider: str, x_mod_signature: Optional[str] = Header(default=None, alias="X-Mod-Signature")):
    if provider not in PROVIDERS:
        raise HTTPException(404, f"unknown provider: {provider}")
    wallet = _recover_wallet(x_mod_signature)
    entry = _load_store().get(provider, {}).get(wallet)
    if not entry:
        return JSONResponse({"exists": False}, status_code=404)
    return {"exists": True, "ciphertext": entry["ciphertext"], "iv": entry["iv"], "wallet": wallet}


@api.post("/key/{provider}")
async def set_key(provider: str, request: Request, x_mod_signature: Optional[str] = Header(default=None, alias="X-Mod-Signature")):
    if provider not in PROVIDERS:
        raise HTTPException(404, f"unknown provider: {provider}")
    wallet = _recover_wallet(x_mod_signature)
    body = await request.json()
    ciphertext = body.get("ciphertext")
    iv = body.get("iv")
    if not ciphertext or not iv:
        raise HTTPException(400, "ciphertext and iv required")
    store = _load_store()
    store.setdefault(provider, {})[wallet] = {"ciphertext": ciphertext, "iv": iv}
    _save_store(store)
    return {"ok": True, "wallet": wallet, "provider": provider}


def _commune_challenge(action: str, name: str) -> str:
    return f"mod-commune-{action}:{name}"


def _recover_wallet_for(action: str, name: str, signature: Optional[str]) -> str:
    if not signature:
        raise HTTPException(status_code=401, detail="missing X-Mod-Signature")
    try:
        msg = encode_defunct(text=_commune_challenge(action, name))
        return Account.recover_message(msg, signature=signature).lower()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"invalid signature: {e}")


def _dev_mod():
    """Lazy-load the dev orchestrator (avoids import-time cost)."""
    import sys
    sys.path.insert(0, "/Users/broski/mod")
    import mod as m
    return m.mod("dev")()


@api.get("/communes")
def list_communes():
    """List all registered communes."""
    return _dev_mod().communes()


@api.get("/communes/{name}")
def get_commune(name: str):
    """Get one commune by name."""
    c = _dev_mod().commune(name)
    if not c:
        raise HTTPException(404, f"commune {name!r} not found")
    return c


@api.post("/communes/{name}")
async def create_commune(name: str, request: Request,
                         x_mod_signature: Optional[str] = Header(default=None, alias="X-Mod-Signature")):
    """Create or update a commune. Body: {modules: [{name, content_hash}]}.

    The caller signs the challenge `mod-commune-create:{name}` with their
    wallet; that wallet becomes the commune's owner (if new) or must match
    the existing owner (if updating).
    """
    wallet = _recover_wallet_for("create", name, x_mod_signature)
    body = await request.json()
    modules = body.get("modules") or []
    try:
        result = _dev_mod().create_commune(name=name, modules=modules, owner=wallet,
                                           signature=x_mod_signature)
    except (ValueError, PermissionError) as e:
        raise HTTPException(400 if isinstance(e, ValueError) else 403, str(e))
    return result


@api.delete("/communes/{name}")
def delete_commune(name: str,
                   x_mod_signature: Optional[str] = Header(default=None, alias="X-Mod-Signature")):
    """Delete a commune. Caller signs `mod-commune-delete:{name}`."""
    wallet = _recover_wallet_for("delete", name, x_mod_signature)
    try:
        return _dev_mod().delete_commune(name=name, owner=wallet)
    except PermissionError as e:
        raise HTTPException(403, str(e))


@api.get("/merkle")
def get_merkle():
    """Current deployment merkle (modules + communes)."""
    return _dev_mod().merkle()


@api.get("/modules")
def list_modules():
    """List orbit modules with status info for the sidebar.

    Each entry: name, alive (gateway reachable?), kind, port (if known),
    served (in current dev.serve() set?), warnings (config issues).
    """
    import urllib.request as _r
    import urllib.error as _e
    dev = _dev_mod()
    served = (dev._read_pidfile().get("modules") or {})
    orbit = dev._orbit_dir()
    results = []
    for entry in sorted(orbit.iterdir(), key=lambda p: p.name):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        cfg_path = entry / "config.json"
        if not cfg_path.exists():
            continue
        try:
            cfg = json.loads(cfg_path.read_text())
        except json.JSONDecodeError:
            continue
        name = entry.name
        port = cfg.get("port")
        served_info = served.get(name)
        alive = False
        warnings = []
        # Probe directly by port — more reliable than the pidfile (which only
        # tracks what dev.serve() started) and works when modules are run
        # manually or by a different orchestrator.
        if port:
            try:
                with _r.urlopen(f"http://127.0.0.1:{port}/health", timeout=0.3) as r:
                    alive = r.status == 200
            except Exception:
                pass
        if not cfg.get("owner"):
            warnings.append("no owner set")
        if cfg.get("port") is None:
            warnings.append("no port configured")
        results.append({
            "name": name,
            "version": cfg.get("version"),
            "description": cfg.get("description"),
            "icon": cfg.get("icon"),
            "color": cfg.get("color"),
            "port": port,
            "app_port": cfg.get("app_port"),
            "kind": "fastapi" if name == "dev" else ("rust" if port else "static"),
            "alive": alive,
            "served": bool(served_info),
            "served_pid": served_info.get("pid") if served_info else None,
            "warnings": warnings,
        })
    return results


@api.get("/logs/{module}")
def get_logs(module: str, lines: int = 100, since: int = 0):
    """Tail the last `lines` of /tmp/mod-{module}.log. `since` is a byte offset
    for incremental polling — the response includes the new offset so the
    client can fetch only what's new on the next call.
    """
    log_path = Path(f"/tmp/mod-{module}.log")
    if not log_path.exists():
        return {"module": module, "lines": [], "offset": 0, "exists": False}
    size = log_path.stat().st_size
    with log_path.open("rb") as f:
        if since and since < size:
            f.seek(since)
            chunk = f.read().decode("utf-8", errors="replace")
            new_lines = chunk.splitlines()
        else:
            # Initial load — read the tail.
            tail_bytes = min(size, 64 * 1024)
            f.seek(max(0, size - tail_bytes))
            chunk = f.read().decode("utf-8", errors="replace")
            new_lines = chunk.splitlines()[-lines:]
    return {"module": module, "lines": new_lines, "offset": size, "exists": True, "bytes": size}


@api.get("/jobs/{module}")
def get_jobs(module: str, x_mod_signature: Optional[str] = Header(default=None, alias="X-Mod-Signature")):
    """List recent jobs for a module — proxies through with the caller's
    wallet signature. The module's own auth layer enforces authorization.
    For modules without a /jobs endpoint, returns an empty list.
    """
    dev = _dev_mod()
    served = (dev._read_pidfile().get("modules") or {})
    info = served.get(module)
    if not info:
        return {"jobs": [], "reason": "module not served"}
    try:
        import httpx
        with httpx.Client(timeout=2.0) as client:
            headers = {}
            if x_mod_signature:
                headers["X-Mod-Signature"] = x_mod_signature
                headers["Authorization"] = f"Bearer {x_mod_signature}"
            r = client.get(f"{info['url']}/jobs", headers=headers)
            if r.status_code == 200:
                return {"jobs": r.json()}
            return {"jobs": [], "reason": f"upstream HTTP {r.status_code}"}
    except Exception as e:
        return {"jobs": [], "reason": f"{type(e).__name__}: {e}"}


@api.api_route("/proxy/{provider}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(provider: str, path: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(404, f"unknown provider: {provider}")
    target = PROVIDERS[provider]["api"]
    url = f"{target.rstrip('/')}/{path}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}
    body = await request.body()
    async with httpx.AsyncClient(timeout=300) as client:
        upstream = await client.request(request.method, url, headers=headers, content=body, params=dict(request.query_params))
    resp_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in {"transfer-encoding", "content-encoding"}}
    return Response(content=upstream.content, status_code=upstream.status_code, headers=resp_headers)


# Mount the same router at both root (for prefix-stripping Caddy) and /api/dev
# (for direct local hits without a proxy in front).
app.include_router(api)
app.include_router(api, prefix="/api/dev")


def _serve_ui():
    if UI_PATH.exists():
        return FileResponse(UI_PATH)
    raise HTTPException(404, "UI not built")


@app.get("/")
def root():
    return _serve_ui()


@app.get("/dev")
@app.get("/dev/")
def dev_ui():
    return _serve_ui()
