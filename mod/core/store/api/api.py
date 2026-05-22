"""
store api — FastAPI gateway with SIWE (Sign-In With Ethereum) auth.

Endpoints
    GET  /health
    GET  /status
    GET  /backends
    GET  /nonce?address=0x...
    POST /verify              SIWE message + sig → session token
    GET  /me                  current session
    POST /put                 (multipart) upload to filecoin/hippius/both
    GET  /get?cid=...         retrieve by CID
    POST /pin                 pin a CID
    GET  /list                list caller's objects
    DELETE /rm?cid=...        delete record

Run:
    uvicorn api.api:app --host 0.0.0.0 --port 50150 --reload
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# Import the top-level `mod` package BEFORE polluting sys.path with the
# store module dir (its parent `mod/core/` contains a `mod.py` that would
# otherwise shadow the real package).
import mod as m  # noqa: E402

mod_dir = Path(__file__).resolve().parent.parent
config_path = mod_dir / 'config.json'
CONFIG = json.loads(config_path.read_text()) if config_path.exists() else {}

# Use dstore (orbit) — the core 'store' is a separate KV module.
store_mod = m.mod('dstore')()

# ── auth ───────────────────────────────────────────────────────

JWT_SECRET = (os.environ.get('STORE_JWT_SECRET') or secrets.token_hex(32)).encode()
DOMAIN = os.environ.get('STORE_DOMAIN') or 'localhost:50151'
ORIGIN = os.environ.get('STORE_ORIGIN') or 'http://localhost:50151'

NONCES: dict = {}   # address -> {nonce, expires}
NONCE_TTL = 600     # 10 min
SESSION_TTL = 86400 * 7  # 7 days

# ── whitelist (mirrors orbit/claude pattern) ───────────────────
# Private state at ~/.mod/store/{owner.json, whitelist.json}. Empty/missing
# whitelist = open access (back-compat). Non-empty = only owner + listed
# addresses may sign in.

PRIVATE_DIR = Path(os.environ.get('STORE_PRIVATE_DIR') or os.path.expanduser('~/.mod/store'))
PRIVATE_DIR.mkdir(parents=True, exist_ok=True)
WHITELIST_PATH = PRIVATE_DIR / 'whitelist.json'
OWNER_PATH = PRIVATE_DIR / 'owner.json'


def read_owner() -> Optional[str]:
    try:
        return json.loads(OWNER_PATH.read_text()).get('owner', '').lower() or None
    except Exception:
        return None


def read_whitelist() -> list:
    try:
        data = json.loads(WHITELIST_PATH.read_text())
    except Exception:
        return []
    if isinstance(data, dict):
        data = data.get('addresses', [])
    if not isinstance(data, list):
        return []
    return sorted({str(a).lower() for a in data if isinstance(a, str) and a.startswith('0x')})


def write_whitelist(addresses: list) -> None:
    clean = sorted({str(a).lower() for a in addresses if isinstance(a, str) and a.startswith('0x')})
    WHITELIST_PATH.write_text(json.dumps(clean, indent=2))


def is_authorized(address: str) -> bool:
    """Owner ∪ whitelist; if whitelist is empty AND no owner is set, allow all."""
    addr = address.lower()
    owner = read_owner()
    wl = read_whitelist()
    if not owner and not wl:
        return True
    if owner and addr == owner:
        return True
    return addr in wl


def _b64url(b: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode()


def _b64url_decode(s: str) -> bytes:
    import base64
    pad = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def issue_token(address: str) -> str:
    payload = json.dumps({'sub': address.lower(), 'exp': int(time.time()) + SESSION_TTL}, separators=(',', ':')).encode()
    p = _b64url(payload)
    sig = _b64url(hmac.new(JWT_SECRET, p.encode(), hashlib.sha256).digest())
    return f'{p}.{sig}'


def verify_token(token: str) -> Optional[str]:
    try:
        p, sig = token.split('.')
        expected = _b64url(hmac.new(JWT_SECRET, p.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_b64url_decode(p))
        if payload.get('exp', 0) < time.time():
            return None
        return payload['sub']
    except Exception:
        return None


def require_session(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'missing bearer token')
    addr = verify_token(authorization[7:])
    if not addr:
        raise HTTPException(401, 'invalid or expired token')
    return addr


# ── SIWE verification (no external dep — manual ecrecover via eth-utils) ─

def keccak256(b: bytes) -> bytes:
    from eth_utils import keccak
    return keccak(b)


def recover_address(message: str, signature: str) -> str:
    """Recover an Ethereum address from a personal_sign signature."""
    from eth_keys import keys
    from eth_utils import to_checksum_address

    sig = signature[2:] if signature.startswith('0x') else signature
    sig_bytes = bytes.fromhex(sig)
    if len(sig_bytes) != 65:
        raise ValueError(f'bad signature length: {len(sig_bytes)}')
    r, s, v = sig_bytes[:32], sig_bytes[32:64], sig_bytes[64]
    if v >= 27:
        v -= 27
    msg = f'\x19Ethereum Signed Message:\n{len(message)}{message}'.encode()
    msg_hash = keccak256(msg)
    sig_obj = keys.Signature(vrs=(v, int.from_bytes(r, 'big'), int.from_bytes(s, 'big')))
    pub = sig_obj.recover_public_key_from_msg_hash(msg_hash)
    return to_checksum_address(pub.to_checksum_address())


SIWE_ADDRESS_RE = re.compile(r'^([^\s]+) wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})')
SIWE_NONCE_RE = re.compile(r'\nNonce: ([^\s]+)')


def parse_siwe(message: str) -> dict:
    m_addr = SIWE_ADDRESS_RE.match(message)
    m_nonce = SIWE_NONCE_RE.search(message)
    if not m_addr or not m_nonce:
        raise ValueError('not a valid SIWE message')
    return {'domain': m_addr.group(1), 'address': m_addr.group(2), 'nonce': m_nonce.group(1)}


# ── app ────────────────────────────────────────────────────────

app = FastAPI(title='store', description=CONFIG.get('description', 'store'))
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'], allow_methods=['*'], allow_headers=['*'], allow_credentials=False,
)


@app.get('/health')
def health():
    return {'ok': True, 'service': 'store', 'time': int(time.time())}


@app.get('/status')
def status():
    return store_mod.status()


@app.get('/backends')
def backends():
    return {'backends': store_mod.backends()}


# ── auth flow ──

@app.get('/nonce')
def nonce(address: str):
    address = address.lower()
    n = secrets.token_hex(16)
    NONCES[address] = {'nonce': n, 'expires': time.time() + NONCE_TTL}
    return {'address': address, 'nonce': n, 'domain': DOMAIN, 'origin': ORIGIN}


class VerifyBody(BaseModel):
    message: str
    signature: str


@app.post('/verify')
def verify(body: VerifyBody):
    try:
        parsed = parse_siwe(body.message)
    except Exception as e:
        raise HTTPException(400, f'bad SIWE message: {e}')

    addr_lc = parsed['address'].lower()
    record = NONCES.get(addr_lc)
    if not record or record['expires'] < time.time():
        raise HTTPException(401, 'no active nonce for address')
    if record['nonce'] != parsed['nonce']:
        raise HTTPException(401, 'nonce mismatch')

    try:
        recovered = recover_address(body.message, body.signature)
    except Exception as e:
        raise HTTPException(401, f'signature recovery failed: {e}')

    if recovered.lower() != addr_lc:
        raise HTTPException(401, f'recovered {recovered} != claimed {parsed["address"]}')

    if not is_authorized(addr_lc):
        raise HTTPException(403, f'{recovered} is not on the store whitelist')

    NONCES.pop(addr_lc, None)
    token = issue_token(addr_lc)
    return {'address': recovered, 'token': token, 'expires_in': SESSION_TTL}


# ── whitelist management ──

def require_owner(authorization: Optional[str]) -> str:
    addr = require_session(authorization)
    owner = read_owner()
    if not owner:
        # No owner set: any authenticated address can manage the list (bootstrap).
        return addr
    if addr.lower() != owner.lower():
        raise HTTPException(403, 'owner only')
    return addr


@app.get('/whitelist')
def whitelist_get():
    return {'owner': read_owner(), 'addresses': read_whitelist()}


class WhitelistBody(BaseModel):
    address: str


@app.post('/whitelist')
def whitelist_add(body: WhitelistBody, authorization: Optional[str] = Header(default=None)):
    require_owner(authorization)
    addr = body.address.strip().lower()
    if not addr.startswith('0x') or len(addr) != 42:
        raise HTTPException(400, 'address must be 0x-prefixed 42 chars')
    wl = read_whitelist()
    if addr not in wl:
        wl.append(addr)
        write_whitelist(wl)
    return {'addresses': read_whitelist(), 'added': addr}


@app.delete('/whitelist')
def whitelist_rm(address: str, authorization: Optional[str] = Header(default=None)):
    require_owner(authorization)
    addr = address.strip().lower()
    wl = [a for a in read_whitelist() if a != addr]
    write_whitelist(wl)
    return {'addresses': read_whitelist(), 'removed': addr}


@app.get('/me')
def me(authorization: Optional[str] = Header(default=None)):
    addr = require_session(authorization)
    return {'address': addr}


# ── storage ────────────────────────────────────────────────────

@app.post('/put')
async def put(
    file: UploadFile = File(...),
    backend: str = Form('filecoin'),
    key: Optional[str] = Form(None),
    authorization: Optional[str] = Header(default=None),
):
    owner = require_session(authorization)
    cache_dir = Path(os.path.expanduser('~/.store-mod/upload'))
    cache_dir.mkdir(parents=True, exist_ok=True)
    tmp = cache_dir / f'{int(time.time()*1000)}-{file.filename}'
    with open(tmp, 'wb') as f:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    try:
        result = store_mod.put(path=str(tmp), backend=backend, owner=owner, key=key)
        return result
    finally:
        try:
            tmp.unlink()
        except Exception:
            pass


@app.get('/get')
def get(cid: str, backend: Optional[str] = None):
    out = Path(os.path.expanduser(f'~/.store-mod/cache/{cid}'))
    out.parent.mkdir(parents=True, exist_ok=True)
    r = store_mod.get(cid=cid, backend=backend, out=str(out))
    if 'error' in r:
        raise HTTPException(404, r['error'])
    return FileResponse(out, filename=cid)


class PinBody(BaseModel):
    cid: str
    backend: str = 'filecoin'


@app.post('/pin')
def pin(body: PinBody, authorization: Optional[str] = Header(default=None)):
    owner = require_session(authorization)
    return store_mod.pin(cid=body.cid, backend=body.backend, owner=owner)


@app.get('/list')
def list_objects(
    backend: Optional[str] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
):
    owner = require_session(authorization)
    return {'owner': owner, 'objects': store_mod.list(owner=owner, backend=backend, limit=limit)}


@app.delete('/rm')
def rm(cid: str, authorization: Optional[str] = Header(default=None)):
    require_session(authorization)
    return store_mod.rm(cid)


@app.get('/')
def root():
    return {
        'name': 'store',
        'description': CONFIG.get('description'),
        'app': CONFIG.get('urls', {}).get('app'),
        'endpoints': sorted(CONFIG.get('endpoints', {}).keys()),
    }
