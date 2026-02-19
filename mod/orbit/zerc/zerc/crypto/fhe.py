"""
FHE client-side encryption for ZERC20 interactions.

Based on Zama fhEVM client SDK pattern:
  1. User creates encrypted input with amount
  2. Client encrypts under network FHE public key
  3. Generates ZK proof that ciphertext is well-formed
  4. Submits (handle, proof) to contract
  5. Contract calls TFHE.asEuint64(handle, proof) to verify and obtain ciphertext handle

For balance viewing:
  1. User generates ephemeral keypair
  2. Signs EIP-712 message binding pubkey to contract address
  3. Gateway re-encrypts balance from network key to user's key
  4. User decrypts locally
"""

import os
import hashlib
import struct
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EncryptedInput:
    """Client-side encrypted input for ZERC20 contract calls."""
    handle: bytes       # 32-byte handle (ciphertext pointer)
    input_proof: bytes  # ZK proof that ciphertext is well-formed
    plaintext: int      # Original value (kept client-side only, never sent)

    def to_contract_args(self) -> tuple:
        """Return (einput, bytes) for contract function call."""
        return (self.handle, self.input_proof)


@dataclass
class ReencryptionRequest:
    """Request for Gateway to re-encrypt a ciphertext handle for a specific user."""
    contract_address: str
    handle: bytes             # On-chain ciphertext handle
    user_pubkey: bytes        # User's ephemeral public key
    eip712_signature: bytes   # EIP-712 signature binding pubkey to contract


@dataclass
class FHEClient:
    """
    Client for interacting with the FHE coprocessor network.

    In production Zama fhEVM:
      - network_pubkey is the threshold FHE public key shared by coprocessors
      - Encryption uses TFHE (Torus FHE) scheme with 128-bit security
      - Proofs are zero-knowledge proofs of ciphertext well-formedness
      - The scheme is post-quantum resistant

    This implementation provides the interface and uses a simplified
    encryption scheme suitable for development and testing.
    """
    network_url: str = ""
    gateway_url: str = ""
    network_pubkey: Optional[bytes] = None
    _nonce: int = field(default=0, init=False)

    def create_encrypted_input(
        self,
        contract_address: str,
        signer_address: str
    ) -> "InputBuilder":
        """
        Create an input builder for encrypting values.
        Mirrors fhevmjs createEncryptedInput().

        Args:
            contract_address: Target contract that will process the ciphertext
            signer_address: Address of the transaction signer

        Returns:
            InputBuilder that accumulates values and produces handles + proof
        """
        return InputBuilder(
            client=self,
            contract_address=contract_address,
            signer_address=signer_address,
        )

    def encrypt_uint64(self, value: int, contract_address: str, signer_address: str) -> EncryptedInput:
        """
        Encrypt a uint64 value for use in a ZERC20 contract call.
        Shorthand for single-value encryption.
        """
        builder = self.create_encrypted_input(contract_address, signer_address)
        builder.add64(value)
        result = builder.encrypt()
        return result.inputs[0]

    def request_reencryption(
        self,
        contract_address: str,
        handle: bytes,
        user_keypair: "EphemeralKeypair",
        eip712_sig: bytes
    ) -> ReencryptionRequest:
        """
        Request the Gateway to re-encrypt a ciphertext handle
        for viewing by a specific user.
        """
        return ReencryptionRequest(
            contract_address=contract_address,
            handle=handle,
            user_pubkey=user_keypair.public_key,
            eip712_signature=eip712_sig,
        )

    def _next_nonce(self) -> int:
        self._nonce += 1
        return self._nonce


@dataclass
class InputBuilder:
    """Accumulates encrypted inputs for a single contract call."""

    client: FHEClient
    contract_address: str
    signer_address: str
    _values: list = field(default_factory=list)
    _types: list = field(default_factory=list)

    def add8(self, value: int) -> "InputBuilder":
        assert 0 <= value < 2**8, f"Value {value} out of uint8 range"
        self._values.append(value)
        self._types.append(8)
        return self

    def add16(self, value: int) -> "InputBuilder":
        assert 0 <= value < 2**16, f"Value {value} out of uint16 range"
        self._values.append(value)
        self._types.append(16)
        return self

    def add32(self, value: int) -> "InputBuilder":
        assert 0 <= value < 2**32, f"Value {value} out of uint32 range"
        self._values.append(value)
        self._types.append(32)
        return self

    def add64(self, value: int) -> "InputBuilder":
        assert 0 <= value < 2**64, f"Value {value} out of uint64 range"
        self._values.append(value)
        self._types.append(64)
        return self

    def add128(self, value: int) -> "InputBuilder":
        assert 0 <= value < 2**128, f"Value {value} out of uint128 range"
        self._values.append(value)
        self._types.append(128)
        return self

    def encrypt(self) -> "EncryptionResult":
        """
        Encrypt all accumulated values and generate ZK proof.

        In production fhEVM:
          - Each value is encrypted under the network's TFHE public key
          - A ZK proof is generated proving each ciphertext encrypts
            a value in the correct range (e.g., [0, 2^64) for uint64)
          - The proof also binds the ciphertext to the contract address
            and signer to prevent replay attacks

        Returns:
            EncryptionResult with handles and unified input proof
        """
        inputs = []
        proof_parts = []

        for value, bits in zip(self._values, self._types):
            nonce = self.client._next_nonce()

            # Generate deterministic handle from (contract, signer, nonce, value)
            handle = hashlib.sha256(
                self.contract_address.encode()
                + self.signer_address.encode()
                + struct.pack(">Q", nonce)
                + struct.pack(">Q", value)
            ).digest()

            # Generate proof binding ciphertext to context
            proof_data = hashlib.sha256(
                handle
                + struct.pack(">H", bits)
                + self.contract_address.encode()
                + self.signer_address.encode()
            ).digest()

            inputs.append(EncryptedInput(
                handle=handle,
                input_proof=proof_data,
                plaintext=value,
            ))
            proof_parts.append(proof_data)

        # Unified proof covers all inputs
        unified_proof = b"".join(proof_parts)

        return EncryptionResult(inputs=inputs, input_proof=unified_proof)


@dataclass
class EncryptionResult:
    """Result of encrypting one or more values."""
    inputs: list          # List[EncryptedInput]
    input_proof: bytes    # Unified proof covering all inputs

    @property
    def handles(self) -> list:
        """List of 32-byte handles for contract call."""
        return [inp.handle for inp in self.inputs]


@dataclass
class EphemeralKeypair:
    """
    Ephemeral keypair for Gateway re-encryption.

    In production:
      - User generates a fresh keypair per re-encryption request
      - Public key is sent to Gateway with EIP-712 signature
      - Gateway re-encrypts under this public key
      - User decrypts with private key
      - Keypair is discarded after use
    """
    public_key: bytes = field(default_factory=lambda: os.urandom(32))
    private_key: bytes = field(default_factory=lambda: os.urandom(32))

    @classmethod
    def generate(cls) -> "EphemeralKeypair":
        seed = os.urandom(32)
        priv = hashlib.sha256(b"zerc-ephemeral-priv" + seed).digest()
        pub = hashlib.sha256(b"zerc-ephemeral-pub" + priv).digest()
        return cls(public_key=pub, private_key=priv)

    def decrypt(self, reencrypted_ciphertext: bytes) -> int:
        """
        Decrypt a re-encrypted value using the ephemeral private key.
        In production this would be actual TFHE decryption.
        """
        # Simplified: in production this is proper FHE decryption
        if len(reencrypted_ciphertext) >= 8:
            return struct.unpack(">Q", reencrypted_ciphertext[:8])[0]
        return 0
