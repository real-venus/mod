"""Chain Hub API — FastAPI backend for chain deployment and module orchestration."""

import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import requests

app = FastAPI(title="Chain Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_chain = None

MOD_NAMES = ['token', 'oracle', 'registry', 'perms', 'tokengate',
             'bloctime', 'treasury', 'market', 'debit', 'safe', 'bridge']

PORTS = {
    'token': {'api': 8810, 'app': 8811},
    'oracle': {'api': 8812, 'app': 8813},
    'registry': {'api': 8814, 'app': 8815},
    'perms': {'api': 8816, 'app': 8817},
    'tokengate': {'api': 8818, 'app': 8819},
    'bloctime': {'api': 8820, 'app': 8821},
    'treasury': {'api': 8822, 'app': 8823},
    'market': {'api': 8824, 'app': 8825},
    'debit': {'api': 8826, 'app': 8827},
    'safe': {'api': 8828, 'app': 8829},
    'bridge': {'api': 8830, 'app': 8831},
}


def get_chain(network='testnet'):
    global _chain
    if _chain is None:
        import mod as m
        _chain = m.mod('chain')(network=network)
    return _chain


# ── Health ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "module": "chain-hub"}


# ── Module Info ───────────────────────────────────────────────────────────

@app.get("/mods")
async def list_mods():
    """List all available contract modules with their ports and status."""
    results = []
    for name in MOD_NAMES:
        ports = PORTS.get(name, {})
        api_url = f"http://localhost:{ports.get('api', 0)}"
        alive = False
        try:
            r = requests.get(f"{api_url}/health", timeout=1)
            alive = r.status_code == 200
        except Exception:
            pass
        results.append({
            "name": name,
            "api_port": ports.get("api"),
            "app_port": ports.get("app"),
            "api_url": api_url,
            "app_url": f"http://localhost:{ports.get('app', 0)}",
            "alive": alive,
        })
    return {"mods": results}


@app.get("/status")
async def status():
    """Get chain deployment status across networks."""
    chain = get_chain()
    config = chain.config
    deployments = config.get("deployments", {})
    result = {}
    for network, info in deployments.items():
        contracts = info.get("contracts", {})
        result[network] = {
            "chainId": info.get("chainId"),
            "deployer": info.get("deployer"),
            "url": info.get("url"),
            "contract_count": len(contracts),
            "contracts": {k: v.get("address", "") for k, v in contracts.items()},
        }
    return {"deployments": result}


# ── Deploy ────────────────────────────────────────────────────────────────

class DeployReq(BaseModel):
    network: str = "testnet"
    mods: Optional[List[str]] = None
    key: Optional[str] = None

@app.post("/deploy")
async def deploy(req: DeployReq):
    """Deploy contracts (synchronous)."""
    chain = get_chain(req.network)
    try:
        result = chain.deploy(
            network=req.network,
            mods=req.mods,
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Contracts ─────────────────────────────────────────────────────────────

class NetworkReq(BaseModel):
    network: str = "testnet"

@app.post("/contracts")
async def contracts(req: NetworkReq):
    """Get deployed contract addresses for a network."""
    chain = get_chain()
    config = chain.config
    deployment = config.get("deployments", {}).get(req.network, {})
    return {"contracts": deployment.get("contracts", {})}


@app.post("/config")
async def config(req: NetworkReq):
    """Get full deployment config for a network."""
    chain = get_chain()
    config = chain.config
    return {"config": config.get("deployments", {}).get(req.network, {})}


# ── Module Proxy ──────────────────────────────────────────────────────────

class ModCallReq(BaseModel):
    mod: str
    method: str
    args: Optional[list] = None
    network: str = "testnet"

@app.post("/call")
async def mod_call(req: ModCallReq):
    """Call a method on a contract module."""
    chain = get_chain(req.network)
    try:
        mod_instance = chain.mod(req.mod)
        method = getattr(mod_instance, req.method, None)
        if not method:
            raise HTTPException(status_code=404, detail=f"Method {req.method} not found on {req.mod}")
        result = method(*(req.args or []))
        if hasattr(result, 'transactionHash'):
            return {"result": {
                "tx_hash": result.transactionHash.hex(),
                "status": "success" if result.status == 1 else "failed",
            }}
        return {"result": str(result)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/block")
async def block(number: Optional[int] = None):
    """Get latest block number, or block info by number."""
    chain = get_chain()
    return {"result": chain.block(number)}


@app.get("/timestamp")
async def timestamp(number: Optional[int] = None):
    """Get the timestamp of a block (latest if no number given)."""
    chain = get_chain()
    return {"result": chain.timestamp(number)}


@app.get("/info")
async def info():
    """API info."""
    return {
        "name": "chain-hub",
        "mods": MOD_NAMES,
        "ports": PORTS,
        "endpoints": [
            "health", "mods", "status", "deploy",
            "contracts", "config", "call", "block",
            "timestamp", "info",
        ],
    }
