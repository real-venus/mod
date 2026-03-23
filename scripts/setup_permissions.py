#!/usr/bin/env python3
"""
Quick setup script for the MOD permission system.

This script helps configure the owner address and permission settings.
"""

import sys
from pathlib import Path

# Add mod to path
mod_root = Path(__file__).parent.parent
sys.path.insert(0, str(mod_root))

from mod.core.server.auth.auth.config import setup_owner, show_config


def main():
    """Run the permission system setup."""
    print("""
╔═══════════════════════════════════════════════════════════════╗
║          MOD Permission System Setup                          ║
╚═══════════════════════════════════════════════════════════════╝

This script will help you configure the permission system for MOD.

Access Control Model:
  • Owner (you) → Full root access to all modules
  • Other users → Can only access mod/orbit/_outer/{their_address}/

    """)

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'show':
            show_config()
            return
        elif command == 'setup':
            setup_owner()
            return
        else:
            print(f"Unknown command: {command}")
            print("\nUsage:")
            print("  python setup_permissions.py         # Interactive setup")
            print("  python setup_permissions.py setup   # Interactive setup")
            print("  python setup_permissions.py show    # Show current config")
            return

    # Default to setup
    setup_owner()

    print("\n✓ Setup complete!")
    print("\nNext steps:")
    print("  1. Users can now register modules in mod/orbit/_outer/{their_address}/")
    print("  2. Each user has full access to their own modules")
    print("  3. You (owner) have access to all modules")
    print("\nTo change settings later, run:")
    print("  python setup_permissions.py setup")
    print()


if __name__ == '__main__':
    main()
