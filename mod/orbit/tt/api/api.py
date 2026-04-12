"""
TT - Blocktime Yuma Consensus API

FastAPI backend that proxies calls to the TT smart contract on Base Sepolia.
Served via mod.serve() as part of the tt orbit module.
"""

import json
import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from web3 import Web3

app = FastAPI(title="TT API", description="Blocktime Yuma Consensus")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ───────────────────────────────────────────────────────────────

MODULE_DIR = Path(__file__).parent.parent
DEPLOY_PATH = MODULE_DIR / "deployment.json"
ABI_PATH = MODULE_DIR / "artifacts" / "contracts" / "TT.sol" / "TT.json"

def load_contract():
    """Load contract from deployment info and ABI."""
    if not DEPLOY_PATH.exists():
        return None, None, None

    with open(DEPLOY_PATH) as f:
        deploy = json.load(f)

    if not ABI_PATH.exists():
        return None, None, None

    with open(ABI_PATH) as f:
        artifact = json.load(f)

    rpc = os.environ.get("BASE_TESTNET_RPC_URL", "https://sepolia.base.org")
    w3 = Web3(Web3.HTTPProvider(rpc))

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(deploy["address"]),
        abi=artifact["abi"],
    )

    # Load signer if available
    pk = os.environ.get("PRIVATE_KEY")
    account = None
    if pk:
        account = w3.eth.account.from_key(pk)

    return w3, contract, account


# ── Request models ───────────────────────────────────────────────────────

class RegisterReq(BaseModel):
    key: str
    key_type: int = 0  # 0=ECDSA, 1=Ed25519, 2=Sr25519

class CheckinReq(BaseModel):
    key: str

class KeyReq(BaseModel):
    key: str


# ── Endpoints ────────────────────────────────────────────────────────────

@app.post("/get_consensus")
async def get_consensus():
    w3, contract, _ = load_contract()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not deployed")

    result = contract.functions.getBlock().call()
    return {"result": {
        "currentBlock": result[0],
        "lastEmissionBlock": result[1],
        "totalBlocktime": result[2],
        "emissionRate": str(result[3]),
        "decayBps": result[4],
        "epochLength": result[5],
    }}


@app.post("/get_validators")
async def get_validators():
    w3, contract, _ = load_contract()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not deployed")

    count = contract.functions.validatorCount().call()
    validators = []
    for i in range(count):
        kh = contract.functions.validatorKeys(i).call()
        v = contract.functions.validators(kh).call()
        bal = contract.functions.balances(kh).call()
        validators.append({
            "key": v[0],
            "keyHash": kh.hex(),
            "keyType": v[1],
            "registeredBlock": v[2],
            "lastSeenBlock": v[3],
            "blocktimeScore": v[4],
            "earned": str(v[5]),
            "active": v[6],
            "balance": str(bal),
        })

    return {"result": validators}


@app.post("/register")
async def register(req: RegisterReq):
    w3, contract, account = load_contract()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Contract not deployed or no signer")

    try:
        tx = contract.functions.registerValidatorAdmin(
            req.key, req.key_type
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 500000,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return {"result": {
            "success": receipt.status == 1,
            "tx_hash": tx_hash.hex(),
            "key": req.key,
            "key_type": req.key_type,
        }}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/checkin")
async def checkin(req: CheckinReq):
    w3, contract, account = load_contract()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Contract not deployed or no signer")

    try:
        tx = contract.functions.batchCheckin(
            [req.key]
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 300000,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return {"result": {
            "success": receipt.status == 1,
            "tx_hash": tx_hash.hex(),
        }}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/produce_block")
async def produce_block():
    w3, contract, account = load_contract()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Contract not deployed or no signer")

    try:
        tx = contract.functions.produceBlock().build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 500000,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        # Read updated block
        result = contract.functions.getBlock().call()
        return {"result": {
            "success": receipt.status == 1,
            "tx_hash": tx_hash.hex(),
            "block": result[0],
        }}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/distribute")
async def distribute():
    w3, contract, account = load_contract()
    if not contract or not account:
        raise HTTPException(status_code=500, detail="Contract not deployed or no signer")

    try:
        tx = contract.functions.distributeEmissions().build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 1000000,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return {"result": {
            "success": receipt.status == 1,
            "tx_hash": tx_hash.hex(),
        }}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get_validator")
async def get_validator(req: KeyReq):
    w3, contract, _ = load_contract()
    if not contract:
        raise HTTPException(status_code=500, detail="Contract not deployed")

    result = contract.functions.getValidator(req.key).call()
    kh = Web3.solidity_keccak(["string"], [req.key])
    bal = contract.functions.balances(kh).call()
    return {"result": {
        "key": result[0],
        "keyType": result[1],
        "registeredBlock": result[2],
        "lastSeenBlock": result[3],
        "blocktimeScore": result[4],
        "earned": str(result[5]),
        "active": result[6],
        "balance": str(bal),
    }}


@app.get("/health")
async def health():
    return {"status": "ok", "module": "tt"}
