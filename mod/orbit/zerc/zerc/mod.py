"""
ZERC — Zero-knowledge ERC20 module based on Zama fhEVM.

Provides confidential token operations using Fully Homomorphic Encryption:
  - Encrypted balances (euint64 ciphertext handles)
  - Encrypted transfer amounts with ZK input proofs
  - Oblivious execution (both transfer paths always run)
  - Gateway re-encryption for balance viewing (EIP-712 authenticated)
  - Wrap/unwrap standard ERC20 ↔ confidential ZERC20
"""

import json
import os
from pathlib import Path
from typing import Optional

from .crypto.fhe import FHEClient, EphemeralKeypair, EncryptedInput
from .crypto.proof import InputProof


CONTRACTS_DIR = Path(__file__).parent / "contracts"


class Mod:
    description = """
    ZERC — Zero-knowledge ERC20 based on Zama fhEVM.
    Confidential token with FHE-encrypted balances, transfers, and allowances.
    Uses the TFHE coprocessor model: host chain stores ciphertext handles,
    FHE computation happens off-chain on encrypted data.
    """

    def __init__(
        self,
        network_url: str = "",
        gateway_url: str = "",
        network_pubkey: Optional[bytes] = None,
    ):
        self.fhe = FHEClient(
            network_url=network_url,
            gateway_url=gateway_url,
            network_pubkey=network_pubkey,
        )

    # ================================================================
    #  Contract source access
    # ================================================================

    def get_contract_source(self, name: str = "ZERCToken") -> str:
        """
        Return Solidity source for a ZERC contract.

        Available contracts:
          - TFHE         : FHE library (types + operations)
          - IZERC20      : Interface
          - ZERC20       : Abstract base (Zama ConfidentialERC20 pattern)
          - ZERCToken    : Deployable confidential token with owner mint
          - ZERCWrapped  : Wrap standard ERC20 → confidential ZERC20
        """
        path = CONTRACTS_DIR / f"{name}.sol"
        if not path.exists():
            available = [f.stem for f in CONTRACTS_DIR.glob("*.sol")]
            raise FileNotFoundError(
                f"Contract '{name}' not found. Available: {available}"
            )
        return path.read_text()

    def list_contracts(self) -> list:
        """List available Solidity contract names."""
        return sorted(f.stem for f in CONTRACTS_DIR.glob("*.sol"))

    # ================================================================
    #  Encrypted input creation (client-side)
    # ================================================================

    def encrypt_amount(
        self,
        amount: int,
        contract_address: str,
        signer_address: str,
    ) -> EncryptedInput:
        """
        Encrypt a transfer/approve amount for a ZERC20 contract call.

        The amount is encrypted under the network's FHE public key and
        accompanied by a ZK proof of well-formedness. The contract verifies
        the proof via TFHE.asEuint64(handle, proof).

        Args:
            amount: Plaintext amount (uint64 range: 0 to ~1.8e19)
            contract_address: Target ZERC20 contract
            signer_address: Wallet address signing the transaction

        Returns:
            EncryptedInput with handle and proof for contract call
        """
        return self.fhe.encrypt_uint64(amount, contract_address, signer_address)

    def create_encrypted_input(
        self,
        contract_address: str,
        signer_address: str,
    ):
        """
        Create an input builder for encrypting multiple values in one call.
        Mirrors fhevmjs createEncryptedInput().

        Usage:
            builder = mod.create_encrypted_input(contract, signer)
            builder.add64(transfer_amount)
            result = builder.encrypt()
            handle, proof = result.handles[0], result.input_proof
        """
        return self.fhe.create_encrypted_input(contract_address, signer_address)

    # ================================================================
    #  Balance viewing (re-encryption via Gateway)
    # ================================================================

    def view_balance(
        self,
        contract_address: str,
        balance_handle: bytes,
        eip712_signature: bytes,
    ) -> tuple:
        """
        Request re-encryption of an encrypted balance for viewing.

        Flow (Zama Gateway re-encryption protocol):
          1. Generate ephemeral keypair
          2. Sign EIP-712 message binding pubkey to contract address
          3. Gateway re-encrypts balance from network key to user's key
          4. Decrypt locally with ephemeral private key

        Args:
            contract_address: ZERC20 contract holding the balance
            balance_handle: The euint64 handle from balanceOf()
            eip712_signature: EIP-712 signature from the balance owner

        Returns:
            (keypair, request) — keypair for local decryption, request for Gateway
        """
        keypair = EphemeralKeypair.generate()
        request = self.fhe.request_reencryption(
            contract_address=contract_address,
            handle=balance_handle,
            user_keypair=keypair,
            eip712_sig=eip712_signature,
        )
        return keypair, request

    # ================================================================
    #  ZK proof generation
    # ================================================================

    def generate_input_proof(
        self,
        ciphertext_handle: bytes,
        plaintext: int,
        bit_width: int,
        contract_address: str,
        signer_address: str,
    ) -> InputProof:
        """
        Generate a standalone ZK proof for an encrypted input.

        The proof demonstrates:
          1. Ciphertext is well-formed (encrypts a valid value)
          2. Value is in range [0, 2^bit_width)
          3. Ciphertext is bound to (contract, signer) — anti-replay

        In production Zama fhEVM, this uses a specialized ZK circuit
        for TFHE ciphertext well-formedness with 128-bit security.
        """
        nonce = self.fhe._next_nonce()
        return InputProof.generate(
            ciphertext_handle=ciphertext_handle,
            plaintext=plaintext,
            bit_width=bit_width,
            contract_address=contract_address,
            signer_address=signer_address,
            nonce=nonce,
        )

    # ================================================================
    #  Module interface
    # ================================================================

    def forward(self, action: str = "info", **kwargs):
        """
        Module entry point.

        Actions:
          - info:       Return module description and available contracts
          - source:     Return Solidity source (name=<contract>)
          - encrypt:    Encrypt an amount (amount, contract, signer)
          - proof:      Generate ZK input proof
          - contracts:  List available contracts
        """
        if action == "info":
            return {
                "module": "zerc",
                "description": self.description.strip(),
                "contracts": self.list_contracts(),
                "architecture": "Zama fhEVM coprocessor model",
                "encryption": "TFHE (Torus FHE) — 128-bit security, post-quantum",
                "standard": "ERC-7984 compatible (Confidential Token Association)",
            }

        elif action == "source":
            name = kwargs.get("name", "ZERCToken")
            return self.get_contract_source(name)

        elif action == "encrypt":
            amount = kwargs.get("amount", 0)
            contract = kwargs.get("contract", "")
            signer = kwargs.get("signer", "")
            enc = self.encrypt_amount(amount, contract, signer)
            return {
                "handle": enc.handle.hex(),
                "proof": enc.input_proof.hex(),
            }

        elif action == "proof":
            return self.generate_input_proof(
                ciphertext_handle=bytes.fromhex(kwargs.get("handle", "00" * 32)),
                plaintext=kwargs.get("plaintext", 0),
                bit_width=kwargs.get("bits", 64),
                contract_address=kwargs.get("contract", ""),
                signer_address=kwargs.get("signer", ""),
            )

        elif action == "contracts":
            return self.list_contracts()

        else:
            return {"error": f"Unknown action: {action}"}
