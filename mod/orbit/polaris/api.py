from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os

app = FastAPI(title="Polaris", description="GPU cloud management API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None

def get_mod():
    global _mod
    if _mod is None:
        from mod import Mod
        _mod = Mod()
    return _mod

# ── Health ──

@app.get("/health")
def health():
    return {"status": "ok", "module": "polaris"}

# ── GPU Endpoints ──

@app.get("/gpus")
def gpus():
    return get_mod().gpus()

@app.get("/credits")
def credits():
    return get_mod().credits()

@app.get("/instances")
def instances():
    return get_mod().instances()

@app.get("/instances/{instance_id}")
def instance_status(instance_id: str):
    return get_mod().status(instance_id=instance_id)

@app.post("/instances")
async def create_instance(req: Request):
    body = await req.json()
    return get_mod().create(**body)

@app.delete("/instances/{instance_id}")
def terminate_instance(instance_id: str):
    return get_mod().terminate(instance_id=instance_id)

@app.get("/instances/{instance_id}/ssh")
def ssh_cmd(instance_id: str):
    return {"ssh": get_mod().ssh_cmd(instance_id=instance_id)}

@app.get("/status")
def status():
    return get_mod().status()

# ── Auth Endpoints ──

@app.post("/auth/verify")
async def verify(req: Request):
    headers = await req.json()
    try:
        return get_mod().verify(headers)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# ── Generic Forward ──

@app.post("/forward")
async def forward(req: Request):
    body = await req.json()
    fn = body.pop("fn", None)
    if fn is None:
        raise HTTPException(status_code=400, detail="missing fn")
    mod = get_mod()
    if not hasattr(mod, fn) or fn.startswith('_'):
        raise HTTPException(status_code=404, detail=f"unknown fn: {fn}")
    result = getattr(mod, fn)(**body)
    return {"result": result}
