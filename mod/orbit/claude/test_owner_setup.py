#!/usr/bin/env python3
"""
Test script for auto-owner functionality
"""
import os
import json
from pathlib import Path

# Path to owner config
owner_path = Path.home() / '.mod' / 'claude' / 'owner.json'

print("Testing Auto-Owner Functionality")
print("=" * 60)

# 1. Check current owner status
if owner_path.exists():
    with open(owner_path) as f:
        owner_data = json.load(f)
    print(f"✓ Current owner: {owner_data.get('owner')}")
else:
    print("✗ No owner set yet")

print("\n" + "=" * 60)
print("Setup Instructions:")
print("=" * 60)
print()
print("1. To test first-time owner setup:")
print(f"   rm {owner_path}")
print()
print("2. Start the Rust server:")
print("   cd server && cargo run")
print()
print("3. Open the web UI and sign in with MetaMask/SubWallet")
print()
print("4. The first person to sign in will become the owner!")
print()
print("5. Check owner was set:")
print(f"   cat {owner_path}")
print()
print("6. Check server logs for:")
print("   '✓ First user authenticated - set as owner: 0x...'")
print()
