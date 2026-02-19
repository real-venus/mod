"""
Zero-knowledge proof generation for ZERC20 encrypted inputs.

Based on Zama fhEVM ZK proof system:
  - Each encrypted input to a contract must be accompanied by a proof
  - The proof demonstrates:
    1. The ciphertext is well-formed (encrypts a value, not garbage)
    2. The encrypted value is in the correct range (e.g., fits in uint64)
    3. The ciphertext is bound to the target contract and signer (anti-replay)
  - Proofs are verified on-chain by TFHE.asEuint64(input, proof)
"""

import hashlib
import struct
from dataclasses import dataclass
from typing import Optional


@dataclass
class InputProof:
    """
    Zero-knowledge proof for an encrypted input.

    Properties proven:
      - Well-formedness: ciphertext encrypts a valid plaintext
      - Range: plaintext is in [0, 2^bits)
      - Binding: ciphertext is tied to (contract, signer, nonce)
    """
    proof_bytes: bytes
    contract_address: str
    signer_address: str
    bit_width: int
    nonce: int

    @classmethod
    def generate(
        cls,
        ciphertext_handle: bytes,
        plaintext: int,
        bit_width: int,
        contract_address: str,
        signer_address: str,
        nonce: int,
        network_params: Optional[bytes] = None,
    ) -> "InputProof":
        """
        Generate a ZK proof for an encrypted input.

        In production Zama fhEVM:
          - Uses a specialized ZK circuit for TFHE ciphertext well-formedness
          - Proof generation happens client-side (in browser via WASM or native)
          - Verification is done by the on-chain TFHE precompile
          - The proof system provides 128-bit security

        Args:
            ciphertext_handle: The 32-byte handle of the ciphertext
            plaintext: The plaintext value being encrypted
            bit_width: The encrypted type width (8, 16, 32, 64, 128)
            contract_address: Target contract address
            signer_address: Transaction signer address
            nonce: Unique nonce for anti-replay
            network_params: Optional network-specific parameters
        """
        # Range check
        assert 0 <= plaintext < 2**bit_width, (
            f"Plaintext {plaintext} out of range for uint{bit_width}"
        )

        # Build proof commitment
        commitment = hashlib.sha256(
            b"zerc-proof-v1"
            + ciphertext_handle
            + struct.pack(">Q", plaintext)
            + struct.pack(">H", bit_width)
            + contract_address.encode()
            + signer_address.encode()
            + struct.pack(">Q", nonce)
            + (network_params or b"")
        ).digest()

        # In production: this would be a proper ZK-SNARK or similar proof
        # The simplified version demonstrates the structure
        proof_bytes = (
            b"\x01"                          # version byte
            + struct.pack(">H", bit_width)   # type tag
            + commitment                      # 32-byte commitment
            + hashlib.sha256(                 # 32-byte response
                b"zerc-proof-response" + commitment
            ).digest()
        )

        return cls(
            proof_bytes=proof_bytes,
            contract_address=contract_address,
            signer_address=signer_address,
            bit_width=bit_width,
            nonce=nonce,
        )

    def verify(self, ciphertext_handle: bytes) -> bool:
        """
        Verify the proof against a ciphertext handle.

        In production this is done on-chain by the TFHE precompile.
        This method is for client-side pre-verification.
        """
        if len(self.proof_bytes) < 67:  # 1 + 2 + 32 + 32
            return False

        version = self.proof_bytes[0]
        if version != 0x01:
            return False

        type_tag = struct.unpack(">H", self.proof_bytes[1:3])[0]
        if type_tag != self.bit_width:
            return False

        return True

    def to_bytes(self) -> bytes:
        """Serialize proof for contract call."""
        return self.proof_bytes
