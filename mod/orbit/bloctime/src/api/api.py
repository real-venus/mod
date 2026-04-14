"""
BlocTime API

FastAPI backend for BlocTime staking contract on Base Sepolia.
"""

import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from web3 import Web3

app = FastAPI(title="BlocTime API", description="Time-weighted staking — stake tokens, earn BLOC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ───────────────────────────────────────────────────────────────

MODULE_DIR = Path(__file__).parent.parent.parent
CONFIG_PATH = MODULE_DIR / "config.json"
ABI_PATH = MODULE_DIR / "src" / "contracts" / "abi" / "BlocTime.json"


def _w3():
    rpc = os.environ.get("BASE_TESTNET_RPC_URL", "https://sepolia.base.org")
    return Web3(Web3.HTTPProvider(rpc))


def _account(w3):
    pk = os.environ.get("PRIVATE_KEY")
    return w3.eth.account.from_key(pk) if pk else None


def _deploy():
    if not CONFIG_PATH.exists():
        return None
    with open(CONFIG_PATH) as f:
        data = json.load(f)
    network = os.environ.get("NETWORK", "testnet")
    contracts = data.get("contracts", {})
    return contracts.get(network)


def _abi():
    if not ABI_PATH.exists():
        return None
    with open(ABI_PATH) as f:
        return json.load(f)


def load_bloctime():
    deploy = _deploy()
    artifact = _abi()
    if not deploy or not artifact:
        return None, None, None
    abi = artifact.get("abi", artifact) if isinstance(artifact, dict) else artifact
    w3 = _w3()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(deploy["bloctime"]),
        abi=abi,
    )
    return w3, contract, _account(w3)


def load_native_token():
    deploy = _deploy()
    if not deploy:
        return None, None, None
    w3 = _w3()
    # Use minimal ERC20 ABI for approve
    erc20_abi = [
        {"inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
         "name": "approve", "outputs": [{"name": "", "type": "bool"}],
         "stateMutability": "nonpayable", "type": "function"},
        {"inputs": [{"name": "account", "type": "address"}],
         "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}],
         "stateMutability": "view", "type": "function"},
    ]
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(deploy["nativeToken"]),
        abi=erc20_abi,
    )
    return w3, contract, _account(w3)


def _send_tx(w3, contract_fn, account, gas=500000):
    tx = contract_fn.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": gas,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    return {"success": receipt.status == 1, "tx_hash": tx_hash.hex()}


# ── Request models ───────────────────────────────────────────────────────

class StakeReq(BaseModel):
    amount: str
    lock_blocks: int = 0

class UnstakeReq(BaseModel):
    stake_id: int

class AddressReq(BaseModel):
    address: str

class StakePositionReq(BaseModel):
    address: str
    stake_id: int

class MultiplierReq(BaseModel):
    block_count: int

class SaveDeploymentReq(BaseModel):
    network: str = "testnet"
    chain_id: str = "84532"
    rpc_url: str = "https://sepolia.base.org"
    bloctime: str
    native_token: str


# ── Read endpoints ───────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "module": "bloctime"}


@app.post("/get_overview")
async def get_overview(req: AddressReq):
    w3, contract, _ = load_bloctime()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not loaded")
    addr = Web3.to_checksum_address(req.address)
    ids = contract.functions.getUserStakeIds(addr).call()
    positions = []
    for sid in ids:
        pos = contract.functions.getStakePosition(addr, sid).call()
        positions.append({
            "stakeId": sid,
            "amount": str(pos[0]),
            "startBlock": pos[1],
            "lockBlocks": pos[2],
            "blocTimeBalance": str(pos[3]),
            "blocksRemaining": pos[4],
        })
    total_staked = sum(int(p["amount"]) for p in positions)
    total_bloc = sum(int(p["blocTimeBalance"]) for p in positions)
    bloc_balance = contract.functions.balanceOf(addr).call()
    return {"result": {
        "address": addr,
        "stakeCount": len(positions),
        "totalStaked": str(total_staked),
        "totalBlocTime": str(total_bloc),
        "blocBalance": str(bloc_balance),
        "positions": positions,
    }}


@app.post("/get_stake_position")
async def get_stake_position(req: StakePositionReq):
    w3, contract, _ = load_bloctime()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not loaded")
    addr = Web3.to_checksum_address(req.address)
    pos = contract.functions.getStakePosition(addr, req.stake_id).call()
    return {"result": {
        "stakeId": req.stake_id,
        "amount": str(pos[0]),
        "startBlock": pos[1],
        "lockBlocks": pos[2],
        "blocTimeBalance": str(pos[3]),
        "blocksRemaining": pos[4],
    }}


@app.post("/get_user_stakes")
async def get_user_stakes(req: AddressReq):
    w3, contract, _ = load_bloctime()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not loaded")
    addr = Web3.to_checksum_address(req.address)
    ids = contract.functions.getUserStakeIds(addr).call()
    stakes = []
    for sid in ids:
        pos = contract.functions.getStakePosition(addr, sid).call()
        stakes.append({
            "stakeId": sid,
            "amount": str(pos[0]),
            "startBlock": pos[1],
            "lockBlocks": pos[2],
            "blocTimeBalance": str(pos[3]),
            "blocksRemaining": pos[4],
        })
    return {"result": stakes}


@app.post("/get_multiplier")
async def get_multiplier(req: MultiplierReq):
    w3, contract, _ = load_bloctime()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not loaded")
    mult = contract.functions.getMultiplier(req.block_count).call()
    return {"result": {"blockCount": req.block_count, "multiplier": mult, "multiplierX": mult / 10000}}


@app.get("/get_curve")
async def get_curve():
    """Return the full multiplier curve sampled at many points."""
    _, contract, _ = load_bloctime()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not loaded")
    p = contract.functions.params().call()
    max_blocks = p[0]
    # Sample ~50 points along the curve
    steps = 50
    points = []
    for i in range(steps + 1):
        blocks = int(max_blocks * i / steps)
        mult = contract.functions.getMultiplier(blocks).call()
        points.append({"blocks": blocks, "multiplier": mult, "multiplierX": mult / 10000})
    return {"result": {"maxBlocks": max_blocks, "points": points}}


@app.post("/get_params")
async def get_params():
    _, contract, _ = load_bloctime()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not loaded")
    p = contract.functions.params().call()
    total = contract.functions.totalBlocTime().call()
    supply = contract.functions.totalSupply().call()
    next_id = contract.functions.nextStakeId().call()
    return {"result": {
        "maxLockBlocks": p[0],
        "distributionPercentage": p[1],
        "totalBlocTime": str(total),
        "totalSupply": str(supply),
        "nextStakeId": next_id,
    }}


@app.post("/get_deployment")
async def get_deployment():
    deploy = _deploy()
    if not deploy:
        return {"result": None}
    return {"result": deploy}


@app.get("/get_artifact")
async def get_artifact():
    """Return ABI + bytecode for client-side deployment."""
    artifact = _abi()
    if not artifact:
        raise HTTPException(status_code=500, detail="Artifact not found")
    return {"result": artifact}


@app.post("/save_deployment")
async def save_deployment(req: SaveDeploymentReq):
    """Save a new deployment address to config.json after client-side deploy."""
    cfg = {}
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
    if "contracts" not in cfg:
        cfg["contracts"] = {}
    cfg["contracts"][req.network] = {
        "chainId": req.chain_id,
        "url": req.rpc_url,
        "bloctime": Web3.to_checksum_address(req.bloctime),
        "nativeToken": Web3.to_checksum_address(req.native_token),
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)
    return {"result": cfg["contracts"][req.network]}


# ── Write endpoints ──────────────────────────────────────────────────────

@app.post("/stake")
async def stake(req: StakeReq):
    w3, contract, account = load_bloctime()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not loaded or no signer")
    try:
        amount = int(req.amount) if len(req.amount) > 10 else Web3.to_wei(float(req.amount), "ether")
        # Approve nativeToken first
        _, ntv, _ = load_native_token()
        _send_tx(w3, ntv.functions.approve(contract.address, amount), account)
        result = _send_tx(w3, contract.functions.stake(amount, req.lock_blocks), account)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/unstake")
async def unstake(req: UnstakeReq):
    w3, contract, account = load_bloctime()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not loaded or no signer")
    try:
        result = _send_tx(w3, contract.functions.unstake(req.stake_id), account)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
