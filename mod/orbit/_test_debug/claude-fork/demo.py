#!/usr/bin/env python3
"""
Demo: Owner Protection & IPFS Storage

This script demonstrates the new owner-based access control
and automatic IPFS storage features in the Claude module.

Run: python3 demo.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from claude.claude import Mod

def demo_permissions():
    """Demonstrate owner-based access control."""
    print("\n" + "="*60)
    print("DEMO 1: Owner-Based Access Control")
    print("="*60)

    # Create instance
    c = Mod()

    # Show current owner (should be None initially)
    print(f"\n1. Current owner: {c.get_owner()}")
    print("   (None = everyone has access)")

    # Set owner
    owner_addr = "0x1234567890abcdef1234567890abcdef12345678"
    print(f"\n2. Setting owner to: {owner_addr}")
    c.set_owner(owner_addr)

    # Check owner
    print(f"\n3. Current owner: {c.get_owner()}")
    print(f"   Is owner? {c.is_owner(owner_addr)}")

    # Check non-owner
    other_addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    print(f"\n4. Checking different address: {other_addr}")
    print(f"   Is owner? {c.is_owner(other_addr)}")

    # Try to require owner
    print("\n5. Testing permission checks:")
    try:
        c.require_owner(owner_addr, "test operation")
        print("   ✓ Owner passed permission check")
    except PermissionError as e:
        print(f"   ✗ Owner failed: {e}")

    try:
        c.require_owner(other_addr, "test operation")
        print("   ✓ Non-owner passed (shouldn't happen!)")
    except PermissionError as e:
        print("   ✓ Non-owner blocked (correct!)")

    print("\n" + "="*60)


def demo_ipfs_history():
    """Demonstrate IPFS storage and history tracking."""
    print("\n" + "="*60)
    print("DEMO 2: IPFS Storage & History Tracking")
    print("="*60)

    c = Mod()

    # Mock IPFS to avoid needing actual daemon
    from unittest.mock import Mock
    c._ipfs = Mock()
    c._ipfs.put = Mock(side_effect=[
        "QmFirst123",
        "QmSecond456",
        "QmThird789"
    ])

    print("\n1. Adding entries to IPFS...")

    # Add some history entries
    c._store_to_ipfs(
        {'code': 'def hello(): pass'},
        description="Add hello function"
    )
    print("   ✓ Stored: QmFirst123")

    c._store_to_ipfs(
        {'code': 'def world(): pass'},
        description="Add world function"
    )
    print("   ✓ Stored: QmSecond456")

    c._store_to_ipfs(
        {'code': 'def test(): pass'},
        description="Add test function"
    )
    print("   ✓ Stored: QmThird789")

    # Get history
    print("\n2. Viewing history:")
    history = c.get_history()
    for i, entry in enumerate(history, 1):
        print(f"   {i}. {entry['description']}")
        print(f"      CID: {entry['cid']}")

    # Get latest
    print(f"\n3. Latest CID: {c.get_latest_cid()}")

    # Show formatted history
    print("\n4. Formatted history:")
    c.show_history(limit=5)

    print("\n" + "="*60)


def demo_combined():
    """Demonstrate permissions + IPFS together."""
    print("\n" + "="*60)
    print("DEMO 3: Combined Protection + Storage")
    print("="*60)

    c = Mod()

    # Set owner
    owner = "0x1234567890abcdef1234567890abcdef12345678"
    print(f"\n1. Setting owner: {owner}")
    c.set_owner(owner)

    # Mock IPFS
    from unittest.mock import Mock
    c._ipfs = Mock()
    c._ipfs.put = Mock(return_value="QmProtected123")

    # Show the workflow
    print("\n2. Workflow:")
    print("   - Owner can edit files")
    print("   - Edits automatically stored to IPFS")
    print("   - History tracks all changes")
    print("   - Non-owners blocked from editing")

    # Simulate storing a change
    print("\n3. Simulating owner edit (stored to IPFS):")
    c._store_to_ipfs(
        {
            'query': 'Edit main.py: Add error handling',
            'result': {'success': True},
            'work_dir': '/path/to/project'
        },
        description="Add error handling to main.py"
    )

    # Show it's in history
    print("\n4. Change recorded in history:")
    history = c.get_history(limit=1)
    if history:
        print(f"   Latest: {history[0]['description']}")
        print(f"   CID: {history[0]['cid']}")
        print(f"   Gateway: https://ipfs.io/ipfs/{history[0]['cid']}")

    print("\n" + "="*60)


def main():
    """Run all demos."""
    print("\n" + "#"*60)
    print("#  Claude Module - Owner Protection & IPFS Demo")
    print("#"*60)

    try:
        demo_permissions()
        demo_ipfs_history()
        demo_combined()

        print("\n" + "#"*60)
        print("#  Demo Complete!")
        print("#"*60)
        print("\nKey Features Demonstrated:")
        print("  ✓ Owner-based access control")
        print("  ✓ IPFS storage with CID tracking")
        print("  ✓ Complete change history")
        print("  ✓ Permission enforcement")
        print("\nNext Steps:")
        print("  - Read: QUICKSTART_SECURITY.md")
        print("  - Examples: EXAMPLE_USAGE.md")
        print("  - Full Docs: PERMISSIONS_AND_IPFS.md")
        print("")

    except Exception as e:
        print(f"\n✗ Demo failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
