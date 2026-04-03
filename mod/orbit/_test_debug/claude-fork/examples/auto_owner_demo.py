#!/usr/bin/env python3
"""
Auto-Owner Feature Demo

This script demonstrates the auto-owner functionality where the first
authenticated user automatically becomes the owner.
"""

import os
import json
from pathlib import Path


def print_header(text):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")


def check_owner_status():
    """Check and display current owner status."""
    owner_path = Path.home() / '.mod' / 'claude' / 'owner.json'

    print_header("OWNER STATUS CHECK")

    if not owner_path.exists():
        print("❌ No owner file found")
        print(f"   Expected location: {owner_path}")
        print("\n📝 First authenticated user will become owner")
        return None

    try:
        with open(owner_path) as f:
            owner_data = json.load(f)

        owner = owner_data.get('owner')
        print("✅ Owner is set")
        print(f"   Address: {owner}")
        print(f"   Config:  {owner_path}")
        return owner

    except Exception as e:
        print(f"⚠️  Error reading owner file: {e}")
        return None


def demo_python_usage():
    """Demonstrate Python SDK usage."""
    print_header("PYTHON SDK USAGE")

    print("1. Import and initialize:")
    print("   >>> import mod as m")
    print("   >>> c = m.mod('claude')()")
    print()

    print("2. Check owner:")
    print("   >>> owner = c.get_owner()")
    print("   >>> print(f'Owner: {owner}')")
    print()

    print("3. Reload owner (after first auth):")
    print("   >>> c.reload_owner()")
    print()

    print("4. Check if you're the owner:")
    print("   >>> if c.is_owner(m.key()):")
    print("   ...     print('You are the owner!')")
    print()

    print("5. Try an edit operation:")
    print("   >>> c.edit_file(")
    print("   ...     file_path='test.py',")
    print("   ...     instructions='Add docstring',")
    print("   ...     key=m.key()")
    print("   ... )")
    print()


def demo_api_usage():
    """Demonstrate API endpoint usage."""
    print_header("REST API USAGE")

    print("Check owner status:")
    print("   curl http://localhost:8820/owner")
    print()

    print("Example responses:")
    print()
    print("  No owner set:")
    print("  {")
    print('    "has_owner": false,')
    print('    "owner": null,')
    print('    "message": "No owner set - first authenticated user will become owner"')
    print("  }")
    print()

    print("  Owner is set:")
    print("  {")
    print('    "has_owner": true,')
    print('    "owner": "0x1234567890abcdef1234567890abcdef12345678",')
    print('    "message": "Owner is set"')
    print("  }")
    print()


def demo_workflow():
    """Demonstrate the complete workflow."""
    print_header("AUTO-OWNER WORKFLOW")

    print("Step 1: Clean slate")
    print("  $ rm ~/.mod/claude/owner.json")
    print()

    print("Step 2: Start server")
    print("  $ cd server && cargo run")
    print("  → Server starts at http://localhost:8820")
    print()

    print("Step 3: Open web UI")
    print("  → Navigate to http://localhost:8821")
    print()

    print("Step 4: Connect wallet")
    print("  → Click 'Connect Wallet' button")
    print("  → Choose MetaMask, SubWallet, or Local Key")
    print("  → Sign the challenge message")
    print()

    print("Step 5: Automatic owner assignment")
    print("  → Backend checks: owner.json doesn't exist")
    print("  → Backend creates owner.json with your address")
    print("  → Server logs: '✓ First user authenticated - set as owner: 0x...'")
    print("  → Frontend logs: '✓ You are now the owner of this Claude instance'")
    print()

    print("Step 6: Verify ownership")
    print("  $ cat ~/.mod/claude/owner.json")
    print("  → Shows your wallet address")
    print()

    print("Step 7: Use edit operations")
    print("  → You can now use edit_file(), refactor(), generate_code()")
    print("  → Other users will be read-only")
    print()


def demo_security():
    """Demonstrate security model."""
    print_header("SECURITY MODEL")

    print("Permission Levels:")
    print()

    print("  📖 READ OPERATIONS (anyone authenticated):")
    print("     • ask() - Ask AI questions")
    print("     • analyze_code() - Analyze codebase")
    print("     • debug() - Debug analysis")
    print("     • View job history")
    print()

    print("  ✏️  EDIT OPERATIONS (owner only):")
    print("     • edit_file() - Edit files")
    print("     • generate_code() - Generate code")
    print("     • refactor() - Refactor code")
    print("     • Any keyword: edit, modify, change, update, fix, add, remove")
    print()

    print("What happens if non-owner tries to edit:")
    print("  >>> c.edit_file('test.py', 'Add comment', key=non_owner_key)")
    print("  PermissionError: Access denied: code editing requires owner permission")
    print("  Current key: 0xabcd...")
    print("  Owner: 0x1234...")
    print()


def demo_reset():
    """Demonstrate how to reset ownership."""
    print_header("RESET OWNERSHIP")

    print("To allow a new first user to become owner:")
    print()

    print("1. Stop the server:")
    print("   $ pkill -f claude-jobs")
    print()

    print("2. Remove owner file:")
    print("   $ rm ~/.mod/claude/owner.json")
    print()

    print("3. Restart server:")
    print("   $ cd server && cargo run")
    print()

    print("4. Next person to sign in becomes new owner")
    print()

    print("Alternative: Manual ownership change")
    print("  $ echo '{\"owner\": \"0xNEW_ADDRESS\"}' > ~/.mod/claude/owner.json")
    print()


def main():
    """Run all demo sections."""
    print("\n" + "=" * 70)
    print("  AUTO-OWNER FEATURE DEMONSTRATION")
    print("  Claude Module - Mod Framework")
    print("=" * 70)

    # Check current status
    current_owner = check_owner_status()

    # Show usage examples
    demo_python_usage()
    demo_api_usage()
    demo_workflow()
    demo_security()
    demo_reset()

    # Summary
    print_header("SUMMARY")
    print("✅ Auto-owner feature automatically assigns ownership to first authenticated user")
    print("✅ No manual configuration required")
    print("✅ Simple reset by deleting owner.json")
    print("✅ Secure by default - only owner can edit code")
    print("✅ Works with all auth methods (MetaMask, SubWallet, password, local key)")
    print()
    print("📚 For more details, see:")
    print("   • AUTO_OWNER_SETUP.md - Complete guide")
    print("   • IMPLEMENTATION_SUMMARY.md - Technical details")
    print("   • README.md - Updated documentation")
    print()

    if current_owner:
        print(f"🔐 Current owner: {current_owner}")
    else:
        print("🔓 No owner set - ready for first authentication")

    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    main()
