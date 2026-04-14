"""
StakeTime + Incentive API

FastAPI backend proxying calls to StakeTime (staking) and Incentive (emissions)
contracts on Base Sepolia.
"""

import json
import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from web3 import Web3

app = FastAPI(title="StakeTime API", description="Delegated staking + Yuma consensus emissions")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ───────────────────────────────────────────────────────────────

MODULE_DIR = Path(__file__).parent.parent.parent
DEPLOY_PATH = MODULE_DIR / "config.json"
ST_ABI_PATH = MODULE_DIR / "artifacts" / "src" / "contracts" / "StakeTime.sol" / "StakeTime.json"
INC_ABI_PATH = MODULE_DIR / "artifacts" / "src" / "contracts" / "consensus" / "yuma" / "ConsensusYuma.sol" / "ConsensusYuma.json"
NTV_ABI_PATH = MODULE_DIR / "artifacts" / "src" / "contracts" / "Subnet.sol" / "Subnet.json"
REG_ABI_PATH = MODULE_DIR / "artifacts" / "src" / "contracts" / "Registry.sol" / "Registry.json"


def _w3():
    rpc = os.environ.get("BASE_TESTNET_RPC_URL", "https://sepolia.base.org")
    return Web3(Web3.HTTPProvider(rpc))


def _account(w3):
    pk = os.environ.get("PRIVATE_KEY")
    return w3.eth.account.from_key(pk) if pk else None


def _deploy():
    if not DEPLOY_PATH.exists():
        return None
    with open(DEPLOY_PATH) as f:
        data = json.load(f)
    network = os.environ.get("NETWORK", "base_sepolia")
    contracts = data.get("contracts", data)
    if isinstance(contracts, dict) and network in contracts:
        return contracts[network]
    # Fallback: first available network
    for key in contracts:
        if isinstance(contracts[key], dict) and "stakeTime" in contracts[key]:
            return contracts[key]
    return data


def load_staketime():
    deploy = _deploy()
    if not deploy or not ST_ABI_PATH.exists():
        return None, None, None
    w3 = _w3()
    with open(ST_ABI_PATH) as f:
        abi = json.load(f)["abi"]
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(deploy["stakeTime"]),
        abi=abi,
    )
    return w3, contract, _account(w3)


def load_incentive():
    deploy = _deploy()
    if not deploy or not INC_ABI_PATH.exists():
        return None, None, None
    w3 = _w3()
    with open(INC_ABI_PATH) as f:
        abi = json.load(f)["abi"]
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(deploy["consensus"]),
        abi=abi,
    )
    return w3, contract, _account(w3)


def load_native_token():
    deploy = _deploy()
    if not deploy or not NTV_ABI_PATH.exists():
        return None, None, None
    w3 = _w3()
    with open(NTV_ABI_PATH) as f:
        abi = json.load(f)["abi"]
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(deploy["subnet"]),
        abi=abi,
    )
    return w3, contract, _account(w3)


def load_registry():
    deploy = _deploy()
    if not deploy or not REG_ABI_PATH.exists() or "registry" not in deploy:
        return None, None, None
    w3 = _w3()
    with open(REG_ABI_PATH) as f:
        abi = json.load(f)["abi"]
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(deploy["registry"]),
        abi=abi,
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

class RegisterReq(BaseModel):
    key: str
    key_type: int = 0
    commission_bps: int = 1000

class CheckinReq(BaseModel):
    key: str

class KeyReq(BaseModel):
    key: str

class StakeReq(BaseModel):
    validator_key: str
    amount: str  # wei string or ether string
    lock_blocks: int = 0

class UnstakeReq(BaseModel):
    stake_id: int

class AddressReq(BaseModel):
    address: str

class StakeIdReq(BaseModel):
    stake_id: int

class ClaimValidatorReq(BaseModel):
    key: str
    to: Optional[str] = None

class RegisterSubnetReq(BaseModel):
    name: str
    subnet: str
    stake_time: str
    consensus: str

class SubnetIdReq(BaseModel):
    subnet_id: int


# ── Incentive endpoints ──────────────────────────────────────────────────

@app.post("/get_consensus")
async def get_consensus():
    w3, contract, _ = load_incentive()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not deployed")
    r = contract.functions.getBlock().call()
    return {"result": {
        "currentBlock": r[0],
        "lastEmissionBlock": r[1],
        "totalBlocktime": r[2],
        "emissionRate": str(r[3]),
        "decayBps": r[4],
        "epochLength": r[5],
    }}


@app.post("/get_validators")
async def get_validators():
    w3_st, st, _ = load_staketime()
    w3_inc, inc, _ = load_incentive()
    if not st or not inc:
        raise HTTPException(status_code=500, detail="Contracts not deployed")

    count = st.functions.validatorCount().call()
    validators = []
    for i in range(count):
        kh = st.functions.getValidatorKeyHash(i).call()
        v = st.functions.getValidatorByHash(kh).call()
        score = inc.functions.getValidatorScore(kh).call()
        bal = inc.functions.validatorBalances(kh).call()
        total_stt = st.functions.getValidatorTotalStakeTimeByHash(kh).call()
        validators.append({
            "key": v[0],
            "keyHash": kh.hex(),
            "keyType": v[1],
            "registeredBlock": v[2],
            "commissionBps": v[3],
            "active": v[4],
            "lastSeenBlock": score[0],
            "blocktimeScore": score[1],
            "earned": str(score[2]),
            "balance": str(bal),
            "totalSTT": str(total_stt),
        })
    return {"result": validators}


@app.post("/register")
async def register(req: RegisterReq):
    w3, contract, account = load_staketime()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        result = _send_tx(w3, contract.functions.registerValidatorAdmin(
            req.key, req.key_type, req.commission_bps
        ), account)
        result["key"] = req.key
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/checkin")
async def checkin(req: CheckinReq):
    w3, contract, account = load_incentive()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        return {"result": _send_tx(w3, contract.functions.batchCheckin([req.key]), account, gas=300000)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/produce_block")
async def produce_block():
    w3, contract, account = load_incentive()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        result = _send_tx(w3, contract.functions.produceBlock(), account)
        r = contract.functions.getBlock().call()
        result["block"] = r[0]
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/distribute")
async def distribute():
    w3, contract, account = load_incentive()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        return {"result": _send_tx(w3, contract.functions.distributeEmissions(), account, gas=1000000)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── StakeTime endpoints ─────────────────────────────────────────────────

@app.post("/stake_on")
async def stake_on(req: StakeReq):
    w3, contract, account = load_staketime()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        # Parse amount — if it looks like a small number, treat as ether
        amount = int(req.amount) if len(req.amount) > 10 else Web3.to_wei(float(req.amount), "ether")

        # Approve nativeToken first
        _, ntv, _ = load_native_token()
        approve_result = _send_tx(w3, ntv.functions.approve(contract.address, amount), account)

        result = _send_tx(w3, contract.functions.stakeOn(req.validator_key, amount, req.lock_blocks), account)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/unstake_from")
async def unstake_from(req: UnstakeReq):
    w3, contract, account = load_staketime()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        return {"result": _send_tx(w3, contract.functions.unstakeFrom(req.stake_id), account)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get_user_stakes")
async def get_user_stakes(req: AddressReq):
    w3, contract, _ = load_staketime()
    if not contract:
        raise HTTPException(status_code=500, detail="Not deployed")
    addr = Web3.to_checksum_address(req.address)
    ids = contract.functions.getUserStakeIds(addr).call()
    stakes = []
    for sid in ids:
        pos = contract.functions.getStakePosition(sid).call()
        stakes.append({
            "stakeId": sid,
            "staker": pos[0],
            "validatorKeyHash": pos[1].hex(),
            "amount": str(pos[2]),
            "startBlock": pos[3],
            "lockBlocks": pos[4],
            "stakeTimeBalance": str(pos[5]),
            "blocksRemaining": pos[6],
        })
    return {"result": stakes}


@app.post("/get_stake_position")
async def get_stake_position(req: StakeIdReq):
    w3, contract, _ = load_staketime()
    if not contract:
        raise HTTPException(status_code=500, detail="Not deployed")
    pos = contract.functions.getStakePosition(req.stake_id).call()
    return {"result": {
        "stakeId": req.stake_id,
        "staker": pos[0],
        "validatorKeyHash": pos[1].hex(),
        "amount": str(pos[2]),
        "startBlock": pos[3],
        "lockBlocks": pos[4],
        "stakeTimeBalance": str(pos[5]),
        "blocksRemaining": pos[6],
    }}


@app.post("/get_validator")
async def get_validator(req: KeyReq):
    w3_st, st, _ = load_staketime()
    w3_inc, inc, _ = load_incentive()
    if not st or not inc:
        raise HTTPException(status_code=500, detail="Not deployed")
    v = st.functions.getValidator(req.key).call()
    kh = Web3.solidity_keccak(["string"], [req.key])
    score = inc.functions.getValidatorScore(kh).call()
    bal = inc.functions.validatorBalances(kh).call()
    total_stt = st.functions.getValidatorTotalStakeTimeByHash(kh).call()
    return {"result": {
        "key": v[0],
        "keyType": v[1],
        "registeredBlock": v[2],
        "commissionBps": v[3],
        "active": v[4],
        "lastSeenBlock": score[0],
        "blocktimeScore": score[1],
        "earned": str(score[2]),
        "balance": str(bal),
        "totalSTT": str(total_stt),
    }}


# ── Reward claims ────────────────────────────────────────────────────────

@app.post("/claim_staker_rewards")
async def claim_staker_rewards():
    w3, contract, account = load_incentive()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        return {"result": _send_tx(w3, contract.functions.claimStakerRewards(), account)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/claim_validator_rewards")
async def claim_validator_rewards(req: ClaimValidatorReq):
    w3, contract, account = load_incentive()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Not deployed or no signer")
    try:
        to = Web3.to_checksum_address(req.to) if req.to else account.address
        return {"result": _send_tx(w3, contract.functions.claimValidatorRewards(req.key, to), account)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get_staker_rewards")
async def get_staker_rewards(req: AddressReq):
    w3, contract, _ = load_incentive()
    if not contract:
        raise HTTPException(status_code=500, detail="Not deployed")
    addr = Web3.to_checksum_address(req.address)
    return {"result": str(contract.functions.getStakerRewards(addr).call())}


@app.post("/get_deployment")
async def get_deployment():
    deploy = _deploy()
    if not deploy:
        raise HTTPException(status_code=500, detail="Not deployed")
    return {"result": deploy}


# ── Registry endpoints ──────────────────────────────────────────────────

@app.post("/get_subnets")
async def get_subnets():
    w3, contract, _ = load_registry()
    if not contract:
        raise HTTPException(status_code=500, detail="Registry not deployed")
    try:
        raw = contract.functions.getAllSubnets().call()
        subnets = []
        for s in raw:
            score = contract.functions.getStakeScore(s[0]).call()
            immune = contract.functions.isImmune(s[0]).call()
            subnets.append({
                "id": s[0],
                "owner": s[1],
                "name": s[2],
                "stakeTime": s[3],
                "incentive": s[4],
                "registeredBlock": s[5],
                "active": s[6],
                "stakeScore": str(score),
                "immune": immune,
            })
        return {"result": subnets}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get_registration_cost")
async def get_registration_cost():
    w3, contract, _ = load_registry()
    if not contract:
        raise HTTPException(status_code=500, detail="Registry not deployed")
    cost = contract.functions.getRegistrationCost().call()
    return {"result": str(cost)}


@app.post("/register_subnet")
async def register_subnet(req: RegisterSubnetReq):
    w3, contract, account = load_registry()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Registry not deployed or no signer")
    try:
        # Approve NativeToken for registration cost
        cost = contract.functions.getRegistrationCost().call()
        if cost > 0:
            _, ntv, _ = load_native_token()
            _send_tx(w3, ntv.functions.approve(contract.address, cost), account)

        result = _send_tx(w3, contract.functions.registerSubnet(
            req.name,
            Web3.to_checksum_address(req.subnet),
            Web3.to_checksum_address(req.stake_time),
            Web3.to_checksum_address(req.consensus),
        ), account)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/deregister_subnet")
async def deregister_subnet(req: SubnetIdReq):
    w3, contract, account = load_registry()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Registry not deployed or no signer")
    try:
        result = _send_tx(w3, contract.functions.deregisterSubnet(req.subnet_id), account)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get_subnet")
async def get_subnet(req: SubnetIdReq):
    w3, contract, _ = load_registry()
    if not contract:
        raise HTTPException(status_code=500, detail="Registry not deployed")
    r = contract.functions.getSubnet(req.subnet_id).call()
    score = contract.functions.getStakeScore(req.subnet_id).call()
    immune = contract.functions.isImmune(req.subnet_id).call()
    return {"result": {
        "id": r[0],
        "owner": r[1],
        "name": r[2],
        "stakeTime": r[3],
        "incentive": r[4],
        "registeredBlock": r[5],
        "active": r[6],
        "stakeScore": str(score),
        "immune": immune,
    }}


@app.post("/get_weakest_subnet")
async def get_weakest_subnet():
    w3, contract, _ = load_registry()
    if not contract:
        raise HTTPException(status_code=500, detail="Registry not deployed")
    weak_id, weak_score, found = contract.functions.getWeakestSubnet().call()
    return {"result": {
        "id": weak_id,
        "score": str(weak_score),
        "found": found,
    }}


@app.get("/health")
async def health():
    return {"status": "ok", "module": "staketime"}
