"""
Test sr25519 signature verification

This script demonstrates how to verify sr25519 signatures
for the bridge claim process.

Usage:
    python examples/test_signature.py
"""

import time
from substrateinterface import Keypair

def test_signature_verification():
    """
    Test signing and verifying messages with sr25519
    """
    print("=== Sr25519 Signature Test ===\n")

    # Create a test keypair (for demo purposes)
    # In production, user signs with their real Subwallet account
    keypair = Keypair.create_from_mnemonic(
        Keypair.generate_mnemonic(),
        ss58_format=42  # Generic Substrate format
    )

    print(f"Test Address: {keypair.ss58_address}")
    print(f"Public Key: {keypair.public_key.hex()}\n")

    # Create message to sign
    timestamp = int(time.time())
    message = f"bridge_claim:{timestamp}"

    print(f"Message: {message}")
    print(f"Timestamp: {timestamp}\n")

    # Sign message
    signature = keypair.sign(message)
    signature_hex = signature.hex()

    print(f"Signature: {signature_hex}\n")

    # Verify signature
    is_valid = keypair.verify(message, signature)

    print(f"Verification: {'✓ VALID' if is_valid else '✗ INVALID'}\n")

    # Test verification with wrong message
    wrong_message = f"bridge_claim:{timestamp + 100}"
    is_invalid = keypair.verify(wrong_message, signature)

    print(f"Wrong message verification: {'✗ INVALID (expected)' if not is_invalid else '✓ VALID (unexpected!)'}\n")

    # Test verfication from just the address
    print("=== Verification from Address Only ===\n")

    # In the bridge, we only have the sr25519 address, not the full keypair
    # Create a new Keypair instance from just the address for verification
    verify_keypair = Keypair(ss58_address=keypair.ss58_address)

    is_valid_from_address = verify_keypair.verify(message, signature)

    print(f"Address: {keypair.ss58_address}")
    print(f"Verification: {'✓ VALID' if is_valid_from_address else '✗ INVALID'}\n")

    print("=== Bridge Integration Example ===\n")

    # Example of what the frontend sends
    claim_request = {
        "sr25519_address": keypair.ss58_address,
        "evm_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "timestamp": timestamp,
        "signature": signature_hex,
        "amount": 0
    }

    print("Frontend sends:")
    print(f"  sr25519_address: {claim_request['sr25519_address']}")
    print(f"  evm_address: {claim_request['evm_address']}")
    print(f"  timestamp: {claim_request['timestamp']}")
    print(f"  signature: {claim_request['signature'][:20]}...")
    print(f"  amount: {claim_request['amount']}\n")

    # Example of backend verification
    print("Backend verification:")
    msg = f"bridge_claim:{claim_request['timestamp']}"
    kp = Keypair(ss58_address=claim_request['sr25519_address'])
    sig = bytes.fromhex(claim_request['signature'])
    valid = kp.verify(msg, sig)

    print(f"  Message: {msg}")
    print(f"  Valid: {'✓ YES' if valid else '✗ NO'}")

    if valid:
        print("\n✓ Claim would be accepted and queued for processing")
    else:
        print("\n✗ Claim would be rejected")


def test_multiple_signatures():
    """
    Test that different users have different signatures
    """
    print("\n\n=== Multiple User Test ===\n")

    timestamp = int(time.time())
    message = f"bridge_claim:{timestamp}"

    users = []
    for i in range(3):
        kp = Keypair.create_from_mnemonic(
            Keypair.generate_mnemonic(),
            ss58_format=42
        )
        sig = kp.sign(message)
        users.append({
            'address': kp.ss58_address,
            'signature': sig.hex(),
            'keypair': kp
        })

    print("Three users sign the same message:\n")
    for i, user in enumerate(users, 1):
        print(f"User {i}:")
        print(f"  Address: {user['address']}")
        print(f"  Signature: {user['signature'][:40]}...\n")

    # Verify each signature
    print("Verification:")
    for i, user in enumerate(users, 1):
        kp = Keypair(ss58_address=user['address'])
        sig = bytes.fromhex(user['signature'])
        valid = kp.verify(message, sig)
        print(f"  User {i}: {'✓ VALID' if valid else '✗ INVALID'}")

    # Try to verify user 1's signature with user 2's address (should fail)
    print("\nCross-verification test:")
    kp1 = Keypair(ss58_address=users[0]['address'])
    sig2 = bytes.fromhex(users[1]['signature'])
    cross_valid = kp1.verify(message, sig2)
    print(f"  User 1's address with User 2's signature: {'✓ VALID (SECURITY ISSUE!)' if cross_valid else '✗ INVALID (expected)'}")


if __name__ == "__main__":
    test_signature_verification()
    test_multiple_signatures()

    print("\n" + "="*50)
    print("All tests completed!")
    print("="*50)
