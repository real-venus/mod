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
from .abi import ZERC_TOKEN_ABI


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
        rpc_url: str = "",
        gateway_url: str = "",
        network_pubkey: Optional[bytes] = None,
        private_key: str = "",
        contract_address: str = "",
    ):
        self.rpc_url = rpc_url
        self.private_key = private_key
        self.contract_address = contract_address
        self.fhe = FHEClient(
            network_url=rpc_url,
            gateway_url=gateway_url,
            network_pubkey=network_pubkey,
        )
        self._w3 = None
        self._contract = None
        self._account = None

    # ================================================================
    #  Web3 connection
    # ================================================================

    def _connect(self):
        """Lazily initialize web3 provider, account, and contract."""
        if self._w3 is not None:
            return
        from web3 import Web3

        self._w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if self.private_key:
            self._account = self._w3.eth.account.from_key(self.private_key)
        if self.contract_address:
            self._contract = self._w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=ZERC_TOKEN_ABI,
            )

    def _send_tx(self, fn):
        """Build, sign, and send a contract transaction. Returns tx hash."""
        tx = fn.build_transaction({
            "from": self._account.address,
            "nonce": self._w3.eth.get_transaction_count(self._account.address),
            "gas": 500_000,
            "gasPrice": self._w3.eth.gas_price,
            "chainId": self._w3.eth.chain_id,
        })
        signed = self._account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return self._w3.eth.wait_for_transaction_receipt(tx_hash)

    # ================================================================
    #  Send — encrypted confidential transfer
    # ================================================================

    def send(self, to: str, amount: int) -> dict:
        """
        Send confidential tokens to an address.

        Flow:
          1. Encrypt amount client-side under network FHE key
          2. Generate ZK proof of ciphertext well-formedness
          3. Call contract.transfer(to, encryptedAmount, proof)
          4. Contract verifies proof, performs oblivious transfer on ciphertexts

        The on-chain transfer uses TFHE.select — both debit and credit
        always execute. If amount > balance, transferValue becomes 0.
        An observer sees that a transfer happened but not the amount or
        whether it succeeded.

        Args:
            to: Recipient address
            amount: Amount in token decimals (6 decimals, so 1_000_000 = 1.0 token)

        Returns:
            dict with tx hash and encrypted transfer details
        """
        self._connect()
        from web3 import Web3

        encrypted = self.encrypt_amount(
            amount,
            self.contract_address,
            self._account.address,
        )

        receipt = self._send_tx(
            self._contract.functions.transfer(
                Web3.to_checksum_address(to),
                encrypted.handle,
                encrypted.input_proof,
            )
        )

        return {
            "tx": receipt.transactionHash.hex(),
            "status": "success" if receipt.status == 1 else "reverted",
            "from": self._account.address,
            "to": to,
            "encrypted_handle": encrypted.handle.hex(),
            "block": receipt.blockNumber,
        }

    # ================================================================
    #  Approve — encrypted confidential allowance
    # ================================================================

    def approve(self, spender: str, amount: int) -> dict:
        """
        Approve a spender to transfer confidential tokens on your behalf.

        The approved amount is encrypted — the spender can see the allowance
        via Gateway re-encryption but observers cannot.

        Args:
            spender: Address to approve
            amount: Allowance amount in token decimals
        """
        self._connect()
        from web3 import Web3

        encrypted = self.encrypt_amount(
            amount,
            self.contract_address,
            self._account.address,
        )

        receipt = self._send_tx(
            self._contract.functions.approve(
                Web3.to_checksum_address(spender),
                encrypted.handle,
                encrypted.input_proof,
            )
        )

        return {
            "tx": receipt.transactionHash.hex(),
            "status": "success" if receipt.status == 1 else "reverted",
            "owner": self._account.address,
            "spender": spender,
            "encrypted_handle": encrypted.handle.hex(),
            "block": receipt.blockNumber,
        }

    # ================================================================
    #  Balance — query encrypted balance handle
    # ================================================================

    def balance(self, account: str = "") -> dict:
        """
        Query the encrypted balance handle for an account.

        Returns the euint64 ciphertext handle — not the plaintext balance.
        To view the actual balance, use view_balance() to request Gateway
        re-encryption with an EIP-712 signature.

        Args:
            account: Address to query (defaults to connected wallet)
        """
        self._connect()
        from web3 import Web3

        if not account:
            account = self._account.address
        account = Web3.to_checksum_address(account)

        handle = self._contract.functions.balanceOf(account).call()
        supply = self._contract.functions.totalSupply().call()

        return {
            "account": account,
            "encrypted_handle": handle.hex() if isinstance(handle, bytes) else handle,
            "total_supply": supply,
            "note": "Balance is encrypted. Use view_balance() with EIP-712 sig for re-encryption.",
        }

    # ================================================================
    #  Transfer From — spend from approved allowance
    # ================================================================

    def send_from(self, owner: str, to: str, amount: int) -> dict:
        """
        Transfer confidential tokens from an approved owner to a recipient.

        Requires prior approval from the owner. Both allowance and balance
        checks happen in encrypted space — no information leaks about whether
        the transfer succeeded or what the balances/allowance are.

        Args:
            owner: Address whose tokens to spend (must have approved you)
            to: Recipient address
            amount: Amount in token decimals
        """
        self._connect()
        from web3 import Web3

        encrypted = self.encrypt_amount(
            amount,
            self.contract_address,
            self._account.address,
        )

        receipt = self._send_tx(
            self._contract.functions.transferFrom(
                Web3.to_checksum_address(owner),
                Web3.to_checksum_address(to),
                encrypted.handle,
                encrypted.input_proof,
            )
        )

        return {
            "tx": receipt.transactionHash.hex(),
            "status": "success" if receipt.status == 1 else "reverted",
            "spender": self._account.address,
            "from": owner,
            "to": to,
            "encrypted_handle": encrypted.handle.hex(),
            "block": receipt.blockNumber,
        }

    # ================================================================
    #  Mint — owner-only plaintext mint
    # ================================================================

    def mint(self, to: str, amount: int) -> dict:
        """
        Mint tokens to an address (owner only).
        Amount is plaintext at mint time but immediately becomes
        part of the recipient's encrypted balance.
        """
        self._connect()
        from web3 import Web3

        receipt = self._send_tx(
            self._contract.functions.mint(
                Web3.to_checksum_address(to),
                amount,
            )
        )

        return {
            "tx": receipt.transactionHash.hex(),
            "status": "success" if receipt.status == 1 else "reverted",
            "to": to,
            "amount": amount,
            "block": receipt.blockNumber,
        }

    # ================================================================
    #  Token info
    # ================================================================

    def token_info(self) -> dict:
        """Query on-chain token metadata."""
        self._connect()
        return {
            "name": self._contract.functions.name().call(),
            "symbol": self._contract.functions.symbol().call(),
            "decimals": self._contract.functions.decimals().call(),
            "total_supply": self._contract.functions.totalSupply().call(),
            "owner": self._contract.functions.owner().call(),
            "contract": self.contract_address,
        }

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
          - info:        Return module description and available contracts
          - send:        Encrypted confidential transfer (to, amount)
          - approve:     Encrypted allowance approval (spender, amount)
          - send_from:   Transfer from approved allowance (owner, to, amount)
          - balance:     Query encrypted balance handle (account)
          - mint:        Owner mint plaintext amount (to, amount)
          - token_info:  Query on-chain token metadata
          - source:      Return Solidity source (name=<contract>)
          - encrypt:     Encrypt an amount offline (amount, contract, signer)
          - proof:       Generate ZK input proof
          - contracts:   List available contracts
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

        elif action == "send":
            return self.send(
                to=kwargs.get("to", ""),
                amount=kwargs.get("amount", 0),
            )

        elif action == "approve":
            return self.approve(
                spender=kwargs.get("spender", ""),
                amount=kwargs.get("amount", 0),
            )

        elif action == "send_from":
            return self.send_from(
                owner=kwargs.get("owner", ""),
                to=kwargs.get("to", ""),
                amount=kwargs.get("amount", 0),
            )

        elif action == "balance":
            return self.balance(account=kwargs.get("account", ""))

        elif action == "mint":
            return self.mint(
                to=kwargs.get("to", ""),
                amount=kwargs.get("amount", 0),
            )

        elif action == "token_info":
            return self.token_info()

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
