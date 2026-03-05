"""
Sr25519 to ERC20 Bridge Module

This module provides a bridge from Substrate-based chains (sr25519 keys) to Base EVM (ERC20).
Users prove ownership of their sr25519 address by signing a timestamp with Subwallet,
and the bridge operator distributes ERC20 tokens to their MetaMask address.

Architecture:
1. User signs timestamp with sr25519 key (Subwallet)
2. Backend verifies signature using substrate-interface
3. Operator processes claim via smart contract
4. Tokens transferred from operator to user's EVM address

Requirements:
- substrate-interface (for sr25519 signature verification)
- web3.py (for EVM interaction)
- FastAPI (for API endpoints)
"""

import json
import hashlib
import time
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

from substrateinterface import Keypair
from web3 import Web3
from eth_account import Account


@dataclass
class ClaimRequest:
    """Claim request from user"""
    sr25519_address: str  # SS58 format
    evm_address: str      # 0x... format
    timestamp: int        # Unix timestamp when signed
    signature: str        # Hex signature from sr25519 signing
    amount: int           # Amount to claim (optional, can be from snapshot)


@dataclass
class PendingClaim:
    """Verified claim pending on-chain execution"""
    sr25519_address: str
    evm_address: str
    amount: int
    verified_at: int


class Sr25519Bridge:
    """
    Bridge operator for sr25519 to ERC20 claims

    Flow:
    1. receive_claim() - Accept claim from user with signature
    2. verify_signature() - Verify sr25519 signature
    3. process_claims() - Batch process verified claims on-chain
    """

    def __init__(
        self,
        rpc_url: str,
        bridge_contract: str,
        operator_key: str,
        snapshot_path: str = None,
        signature_timeout: int = 300  # 5 minutes
    ):
        """
        Initialize bridge

        Args:
            rpc_url: Base RPC endpoint
            bridge_contract: Sr25519Bridge contract address
            operator_key: Private key for operator (controls tokens)
            snapshot_path: Path to total_balances.json from snapshot
            signature_timeout: Max age for timestamp signatures (seconds)
        """
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.operator = Account.from_key(operator_key)
        self.bridge_address = self.w3.to_checksum_address(bridge_contract)
        self.signature_timeout = signature_timeout

        # Load snapshot balances
        self.balances: Dict[str, int] = {}
        if snapshot_path:
            self.load_snapshot(snapshot_path)

        # Pending verified claims
        self.pending_claims: List[PendingClaim] = []

        # Load contract ABIs
        with open('contracts/Sr25519Bridge.json', 'r') as f:
            bridge_abi = json.load(f)
            self.bridge = self.w3.eth.contract(
                address=self.bridge_address,
                abi=bridge_abi['abi']
            )

    def load_snapshot(self, path: str):
        """Load balance snapshot from Rust tool output"""
        with open(path, 'r') as f:
            self.balances = json.load(f)
        print(f"Loaded {len(self.balances)} account balances from snapshot")

    def get_balance(self, sr25519_address: str) -> int:
        """Get balance for sr25519 address from snapshot"""
        return self.balances.get(sr25519_address, 0)

    def verify_signature(
        self,
        sr25519_address: str,
        timestamp: int,
        signature: str
    ) -> bool:
        """
        Verify sr25519 signature of timestamp

        Message format: "bridge_claim:{timestamp}"

        Args:
            sr25519_address: SS58 address
            timestamp: Unix timestamp that was signed
            signature: Hex signature from Subwallet

        Returns:
            True if signature is valid and timestamp is recent
        """
        # Check timestamp is recent
        current_time = int(time.time())
        if abs(current_time - timestamp) > self.signature_timeout:
            print(f"Timestamp too old: {timestamp} vs {current_time}")
            return False

        # Construct message
        message = f"bridge_claim:{timestamp}"

        try:
            # Create keypair from address to verify
            keypair = Keypair(ss58_address=sr25519_address)

            # Verify signature
            is_valid = keypair.verify(message, signature)

            if is_valid:
                print(f"✓ Valid signature from {sr25519_address}")
            else:
                print(f"✗ Invalid signature from {sr25519_address}")

            return is_valid

        except Exception as e:
            print(f"Signature verification error: {e}")
            return False

    def has_claimed(self, sr25519_address: str) -> bool:
        """Check if address has already claimed on-chain"""
        # Hash the sr25519 address for on-chain lookup
        addr_hash = self.hash_sr25519(sr25519_address)
        return self.bridge.functions.claimed(addr_hash).call()

    def hash_sr25519(self, address: str) -> bytes:
        """Hash sr25519 address to bytes32 for contract storage"""
        return Web3.keccak(text=address)

    def receive_claim(self, claim: ClaimRequest) -> Dict:
        """
        Receive and verify claim request from user

        Returns:
            {"success": bool, "message": str}
        """
        # Check if already claimed
        if self.has_claimed(claim.sr25519_address):
            return {
                "success": False,
                "message": "Address has already claimed"
            }

        # Verify signature
        if not self.verify_signature(
            claim.sr25519_address,
            claim.timestamp,
            claim.signature
        ):
            return {
                "success": False,
                "message": "Invalid signature"
            }

        # Get amount from snapshot or use provided amount
        amount = claim.amount
        if amount == 0 and claim.sr25519_address in self.balances:
            amount = self.balances[claim.sr25519_address]

        if amount == 0:
            return {
                "success": False,
                "message": "No balance found for this address"
            }

        # Add to pending claims
        pending = PendingClaim(
            sr25519_address=claim.sr25519_address,
            evm_address=claim.evm_address,
            amount=amount,
            verified_at=int(time.time())
        )
        self.pending_claims.append(pending)

        return {
            "success": True,
            "message": f"Claim verified. Amount: {amount}. Pending operator processing.",
            "amount": amount
        }

    def process_claims(self, batch_size: int = 50) -> Dict:
        """
        Process pending claims on-chain (operator only)

        Batches multiple claims into a single transaction

        Returns:
            {"success": bool, "tx_hash": str, "processed": int}
        """
        if not self.pending_claims:
            return {
                "success": False,
                "message": "No pending claims"
            }

        # Take up to batch_size claims
        batch = self.pending_claims[:batch_size]

        # Prepare batch data
        sr25519_hashes = [self.hash_sr25519(c.sr25519_address) for c in batch]
        evm_addresses = [self.w3.to_checksum_address(c.evm_address) for c in batch]
        amounts = [c.amount for c in batch]

        # Build transaction
        tx = self.bridge.functions.batchProcessClaims(
            sr25519_hashes,
            evm_addresses,
            amounts
        ).build_transaction({
            'from': self.operator.address,
            'nonce': self.w3.eth.get_transaction_count(self.operator.address),
            'gas': 500000 * len(batch),  # Estimate
            'gasPrice': self.w3.eth.gas_price,
        })

        # Sign and send
        signed = self.operator.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)

        # Wait for confirmation
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt['status'] == 1:
            # Remove processed claims
            self.pending_claims = self.pending_claims[batch_size:]

            return {
                "success": True,
                "tx_hash": tx_hash.hex(),
                "processed": len(batch),
                "remaining": len(self.pending_claims)
            }
        else:
            return {
                "success": False,
                "tx_hash": tx_hash.hex(),
                "message": "Transaction failed"
            }

    def get_stats(self) -> Dict:
        """Get bridge statistics"""
        total_claimed = self.bridge.functions.totalClaimed().call()

        return {
            "pending_claims": len(self.pending_claims),
            "total_claimed": total_claimed,
            "total_snapshot": sum(self.balances.values()),
            "accounts_in_snapshot": len(self.balances)
        }


# FastAPI endpoints for the bridge
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Sr25519 Bridge API")

# Global bridge instance (initialize with config)
bridge: Optional[Sr25519Bridge] = None


class ClaimRequestModel(BaseModel):
    sr25519_address: str
    evm_address: str
    timestamp: int
    signature: str
    amount: int = 0


def init_bridge(config_path: str = "bridge_config.json"):
    """Initialize bridge from config file"""
    global bridge

    with open(config_path, 'r') as f:
        config = json.load(f)

    bridge = Sr25519Bridge(
        rpc_url=config['rpc_url'],
        bridge_contract=config['bridge_contract'],
        operator_key=config['operator_key'],
        snapshot_path=config.get('snapshot_path'),
        signature_timeout=config.get('signature_timeout', 300)
    )


@app.post("/claim")
async def submit_claim(claim: ClaimRequestModel):
    """
    Submit a claim request

    User should sign the message: "bridge_claim:{timestamp}"
    with their sr25519 key in Subwallet
    """
    if not bridge:
        raise HTTPException(status_code=500, detail="Bridge not initialized")

    claim_req = ClaimRequest(
        sr25519_address=claim.sr25519_address,
        evm_address=claim.evm_address,
        timestamp=claim.timestamp,
        signature=claim.signature,
        amount=claim.amount
    )

    result = bridge.receive_claim(claim_req)

    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])

    return result


@app.get("/balance/{sr25519_address}")
async def get_balance(sr25519_address: str):
    """Get claimable balance for an address"""
    if not bridge:
        raise HTTPException(status_code=500, detail="Bridge not initialized")

    balance = bridge.get_balance(sr25519_address)
    has_claimed = bridge.has_claimed(sr25519_address)

    return {
        "address": sr25519_address,
        "balance": balance,
        "claimed": has_claimed,
        "claimable": balance if not has_claimed else 0
    }


@app.post("/process")
async def process_pending(batch_size: int = 50):
    """
    Process pending claims (operator only)

    Should be protected by authentication in production
    """
    if not bridge:
        raise HTTPException(status_code=500, detail="Bridge not initialized")

    result = bridge.process_claims(batch_size)

    if not result['success']:
        raise HTTPException(status_code=400, detail=result.get('message', 'Processing failed'))

    return result


@app.get("/stats")
async def get_stats():
    """Get bridge statistics"""
    if not bridge:
        raise HTTPException(status_code=500, detail="Bridge not initialized")

    return bridge.get_stats()


if __name__ == "__main__":
    import uvicorn

    # Initialize bridge
    init_bridge()

    # Start API
    uvicorn.run(app, host="0.0.0.0", port=8000)
