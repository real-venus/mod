#!/usr/bin/env python3
"""
Test GitAgent setup and basic functionality
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from gitagent.mod import GitAgent


def test_initialization():
    """Test that GitAgent initializes correctly"""
    print("Testing GitAgent initialization...")
    try:
        git = GitAgent()
        print("✅ GitAgent initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to initialize GitAgent: {e}")
        return False


def test_help():
    """Test help/forward function"""
    print("\nTesting help function...")
    try:
        git = GitAgent()
        help_info = git.forward("help")

        if "actions" in help_info:
            print("✅ Help function works")
            print(f"   Available action categories: {len(help_info['actions'])}")
            return True
        else:
            print("❌ Help function returned unexpected format")
            return False
    except Exception as e:
        print(f"❌ Help function failed: {e}")
        return False


def test_account_management():
    """Test account management (without actual token)"""
    print("\nTesting account management structure...")
    try:
        git = GitAgent()

        # Test listing accounts (should work even if empty)
        accounts = git.list_accounts()

        if accounts["status"] == "success":
            print("✅ Account listing works")
            print(f"   Current accounts: {len(accounts['accounts'])}")
            return True
        else:
            print("❌ Account listing failed")
            return False
    except Exception as e:
        print(f"❌ Account management test failed: {e}")
        return False


def test_config_directory():
    """Test that config directory is created"""
    print("\nTesting config directory setup...")
    try:
        git = GitAgent()

        if git.config_dir.exists():
            print(f"✅ Config directory created: {git.config_dir}")
            return True
        else:
            print(f"❌ Config directory not found: {git.config_dir}")
            return False
    except Exception as e:
        print(f"❌ Config directory test failed: {e}")
        return False


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("GitAgent Setup Test")
    print("=" * 60)

    tests = [
        ("Initialization", test_initialization),
        ("Help Function", test_help),
        ("Account Management", test_account_management),
        ("Config Directory", test_config_directory),
    ]

    results = []

    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\n{passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed! GitAgent is ready to use.")
        print("\nNext steps:")
        print("1. Get a GitHub token: https://github.com/settings/tokens/new")
        print("2. Add your account: git.add_account('name', 'ghp_...')")
        print("3. See examples.py for usage examples")
        print("4. Read QUICKSTART.md for quick reference")
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")

    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
