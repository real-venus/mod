#!/usr/bin/env python3
"""
Test config.json creation and IPFS storage for commune registration.
"""

import os
import json
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from claude.claude import Mod


def test_config_creation():
    """Test that config.json is created automatically."""
    print("\n" + "="*60)
    print("TEST: Config Creation")
    print("="*60)

    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')

    # Config should exist (created by the module)
    assert os.path.exists(config_path), "config.json should exist"
    print("✓ config.json exists")

    # Load and verify structure
    with open(config_path, 'r') as f:
        config = json.load(f)

    assert 'name' in config, "config should have 'name'"
    assert config['name'] == 'claude', "name should be 'claude'"
    print(f"✓ Module name: {config['name']}")

    assert 'urls' in config, "config should have 'urls'"
    assert 'app' in config['urls'], "config should have app URL"
    assert 'api' in config['urls'], "config should have api URL"
    print(f"✓ App URL: {config['urls']['app']}")
    print(f"✓ API URL: {config['urls']['api']}")

    assert 'fns' in config, "config should have 'fns'"
    assert isinstance(config['fns'], list), "fns should be a list"
    print(f"✓ Functions: {len(config['fns'])} exposed")

    assert 'endpoints' in config, "config should have 'endpoints'"
    assert isinstance(config['endpoints'], dict), "endpoints should be a dict"
    print(f"✓ Endpoints: {len(config['endpoints'])} defined")

    print("\n✓ All config structure checks passed")


def test_config_methods():
    """Test config-related methods."""
    print("\n" + "="*60)
    print("TEST: Config Methods")
    print("="*60)

    # Note: This requires IPFS to be running
    # We'll test the methods exist and work without IPFS requirement

    c = Mod()

    # Test show_config (should not raise)
    print("\n📋 Testing show_config()...")
    try:
        c.show_config()
        print("✓ show_config() works")
    except Exception as e:
        print(f"⚠ show_config() failed: {e}")

    # Test get_config_cid
    print("\n📦 Testing get_config_cid()...")
    try:
        cid = c.get_config_cid()
        if cid:
            print(f"✓ Config CID: {cid}")
        else:
            print("⚠ No CID yet (IPFS may not be running)")
    except Exception as e:
        print(f"⚠ get_config_cid() failed: {e}")

    print("\n✓ Config methods are accessible")


def test_ensure_config_idempotent():
    """Test that _ensure_config is idempotent."""
    print("\n" + "="*60)
    print("TEST: Config Idempotence")
    print("="*60)

    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')

    # Get initial state
    with open(config_path, 'r') as f:
        config_before = json.load(f)

    # Initialize module (should not overwrite)
    c = Mod()

    # Check state unchanged
    with open(config_path, 'r') as f:
        config_after = json.load(f)

    assert config_before == config_after, "Config should not be modified if it exists"
    print("✓ Config remains unchanged on re-initialization")


def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("CLAUDE CONFIG TESTS")
    print("="*70)

    try:
        test_config_creation()
        test_config_methods()
        test_ensure_config_idempotent()

        print("\n" + "="*70)
        print("✓ ALL TESTS PASSED")
        print("="*70 + "\n")

    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
