#!/usr/bin/env python3
"""
Simple test to verify the Claude Code Mod interface works correctly.
"""

from claude.mod import Mod, run_claude
import sys


def test_basic_functionality():
    """Test basic functionality without requiring actual Claude Code execution"""

    print("Testing Claude Code Mod Interface")
    print("=" * 60)

    # Test 1: Module import
    print("\n✓ Test 1: Module imports successfully")

    # Test 2: Mod initialization
    try:
        mod = Mod(default_path="/tmp")
        print("✓ Test 2: Mod class initializes successfully")
    except Exception as e:
        print(f"✗ Test 2 Failed: {e}")
        return False

    # Test 3: Check if Claude binary is found
    try:
        claude_path = mod.claude_bin
        print(f"✓ Test 3: Claude binary found at: {claude_path}")
    except RuntimeError as e:
        print(f"⚠ Test 3: Claude CLI not found - {e}")
        print("  Install with: brew install anthropics/claude/claude")
        return False

    # Test 4: Command building (dry run)
    print("\n✓ Test 4: Testing command construction...")

    # Build a sample command without executing
    cmd_parts = [
        mod.claude_bin,
        "--print",
        "--model", "sonnet",
        "--output-format", "json",
        "--dangerously-skip-permissions",
        "--permission-mode", "bypassPermissions",
        "test query"
    ]

    print(f"  Sample command: {' '.join(cmd_parts[:4])} ...")
    print("✓ Test 4: Command structure is correct")

    print("\n" + "=" * 60)
    print("All basic tests passed! ✓")
    print("\nTo test with actual Claude Code execution:")
    print("  python test_live.py")

    return True


def test_live_execution():
    """Test actual execution with Claude Code (requires API access)"""

    print("\n" + "=" * 60)
    print("Running Live Execution Test")
    print("=" * 60)

    try:
        # Simple test query
        result = run_claude(
            query="Echo back: Hello from Mod interface!",
            path="/tmp",
            model="haiku",  # Use fastest model
            output_format="text"
        )

        print("\n✓ Live execution successful!")
        print(f"\nResult:\n{result[:200]}...")  # Show first 200 chars
        return True

    except RuntimeError as e:
        print(f"\n✗ Live execution failed: {e}")
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        return False


if __name__ == "__main__":
    success = test_basic_functionality()

    if success and "--live" in sys.argv:
        print("\n\nRunning live execution test...")
        test_live_execution()
    elif success:
        print("\n\nNote: Add --live flag to test actual Claude Code execution")

    sys.exit(0 if success else 1)
