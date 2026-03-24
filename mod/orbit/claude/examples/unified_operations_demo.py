#!/usr/bin/env python3
"""
Unified Operations Demo

Demonstrates the unified architecture where all operations (read and write)
flow through the same forward() method with permission control.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'claude'))

from claude import Mod
import mod as m


def demo_unified_operations():
    """
    Show how the unified architecture handles both read and write operations
    through the same backend with automatic permission control.
    """

    print("\n" + "="*70)
    print("UNIFIED OPERATIONS DEMO")
    print("="*70)
    print("\nThe Claude module uses a unified architecture:")
    print("• All operations flow through forward()")
    print("• Permissions determined by requires_owner flag")
    print("• Read operations: requires_owner=False (no permission check)")
    print("• Write operations: requires_owner=True (owner key required)")
    print("="*70 + "\n")

    # Initialize without owner (local development mode)
    claude = Mod()

    print("\n1. READ-ONLY OPERATIONS (No Permission Required)")
    print("-" * 70)

    # Example 1: Using convenience method (automatically sets requires_owner=False)
    print("\nExample 1a: analyze_code() - convenience method")
    print("Code: mod.analyze_code(path='./src', focus='performance')")
    print("→ Internally calls forward(requires_owner=False)")
    print("→ No permission check performed")

    # Example 2: Using forward() directly with requires_owner=False
    print("\nExample 1b: forward() with explicit requires_owner=False")
    print("Code: mod.forward(query='What does main.py do?', requires_owner=False)")
    print("→ No permission check performed")

    # Example 3: Auto-detection (no edit keywords)
    print("\nExample 1c: forward() with auto-detection (read query)")
    print("Code: mod.forward(query='Analyze the code structure')")
    print("→ Auto-detects as read-only (no edit keywords)")
    print("→ No permission check performed")

    print("\n2. WRITE OPERATIONS (Owner Permission Required)")
    print("-" * 70)

    # Set owner for demonstration
    owner_address = "0x1234567890abcdef1234567890abcdef12345678"
    claude.set_owner(owner_address)

    print("\nExample 2a: edit_file() - convenience method")
    print("Code: mod.edit_file(file_path='utils.py', instructions='Add type hints')")
    print("→ Internally calls forward(requires_owner=True)")
    print("→ Permission check: Is caller the owner?")
    print("→ If yes: executes, stores to IPFS")
    print("→ If no: raises PermissionError")

    print("\nExample 2b: forward() with explicit requires_owner=True")
    print("Code: mod.forward(query='Refactor main.py', requires_owner=True)")
    print("→ Permission check: Is caller the owner?")
    print("→ If yes: executes, stores to IPFS")

    print("\nExample 2c: forward() with auto-detection (edit keywords)")
    print("Code: mod.forward(query='Fix the bug in login.py')")
    print("→ Auto-detects 'fix' keyword")
    print("→ Sets requires_owner=True internally")
    print("→ Permission check performed")

    print("\n3. UNIFIED BACKEND")
    print("-" * 70)
    print("\nAll operations use the same execution path:")
    print("• Same Claude Code CLI backend")
    print("• Same streaming output logic")
    print("• Same error handling")
    print("• Same IPFS storage mechanism")
    print("\nOnly difference: permission check before execution")

    print("\n4. BENEFITS")
    print("-" * 70)
    print("✓ Single code path - easier to maintain")
    print("✓ Consistent behavior across operations")
    print("✓ Flexible permission control")
    print("✓ Automatic IPFS versioning for writes")
    print("✓ Clear separation of read vs write")

    print("\n5. PERMISSION FLOW")
    print("-" * 70)
    print("""
    Operation Called
         ↓
    Set requires_owner flag
    (explicit or auto-detect)
         ↓
    forward() method
         ↓
    Permission check?
    ├─ Yes (requires_owner=True)
    │  ├─ Is caller owner?
    │  │  ├─ Yes → Execute
    │  │  └─ No  → PermissionError
    │  └─ Store to IPFS (if store_ipfs=True)
    └─ No (requires_owner=False)
       └─ Execute directly
    """)

    print("\n" + "="*70)
    print("DEMO COMPLETE")
    print("="*70)
    print("\nSee UNIFIED_OPERATIONS.md for detailed documentation")
    print("See examples/ directory for working code examples\n")


if __name__ == '__main__':
    demo_unified_operations()
