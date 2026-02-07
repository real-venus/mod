#!/usr/bin/env python3
"""
Test script for auto-installation and API key detection features.
"""

import sys
import os
from claude.mod import Mod

def test_initialization():
    """Test that Mod initializes correctly with auto-installation and API key detection."""
    print("Testing Mod initialization...")

    try:
        # Test basic initialization (should auto-install if needed)
        mod = Mod()
        print(f"✓ Mod initialized successfully")
        print(f"  Claude binary: {mod.claude_bin}")

        # Check API key detection
        if mod.api_key:
            print(f"✓ API key detected (length: {len(mod.api_key)} chars)")
        else:
            print("⚠ No API key detected (will prompt during execution)")

        return True

    except Exception as e:
        print(f"✗ Initialization failed: {e}")
        return False

def test_api_key_priority():
    """Test API key priority order."""
    print("\nTesting API key detection priority...")

    # Save original env
    original_key = os.environ.get('ANTHROPIC_API_KEY')

    try:
        # Test with explicit key
        test_key = "test-key-explicit"
        mod = Mod(api_key=test_key)
        assert mod.api_key == test_key, "Explicit API key should be used"
        print("✓ Explicit API key parameter works")

        # Test with environment variable
        os.environ['ANTHROPIC_API_KEY'] = "test-key-env"
        mod = Mod()
        assert mod.api_key == "test-key-env", "Environment variable should be used"
        print("✓ Environment variable API key detection works")

        return True

    except Exception as e:
        print(f"✗ API key priority test failed: {e}")
        return False

    finally:
        # Restore original env
        if original_key:
            os.environ['ANTHROPIC_API_KEY'] = original_key
        elif 'ANTHROPIC_API_KEY' in os.environ:
            del os.environ['ANTHROPIC_API_KEY']

def main():
    """Run all tests."""
    print("=" * 60)
    print("Claude Code Mod - Auto-Installation & API Key Tests")
    print("=" * 60)

    results = []

    # Run tests
    results.append(("Initialization", test_initialization()))
    results.append(("API Key Priority", test_api_key_priority()))

    # Print summary
    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)

    all_passed = True
    for name, passed in results:
        status = "PASSED" if passed else "FAILED"
        symbol = "✓" if passed else "✗"
        print(f"{symbol} {name}: {status}")
        if not passed:
            all_passed = False

    print("=" * 60)

    if all_passed:
        print("\n✓ All tests passed!")
        return 0
    else:
        print("\n✗ Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
