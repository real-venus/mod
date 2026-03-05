"""
Pytest configuration file.
This file is automatically loaded by pytest and provides shared fixtures.
"""
import pytest
import os


def pytest_configure(config):
    """Called before test run starts."""
    print("\n" + "="*60)
    print("CLAUDE CODE TEST SUITE")
    print("="*60)

    # Check if API key is available
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if api_key:
        print("✓ API key found - all tests can run")
    else:
        print("⚠ No API key found - some tests will be skipped")
        print("  Set ANTHROPIC_API_KEY to run all tests")

    print("="*60 + "\n")


def pytest_runtest_setup(item):
    """Called before each test."""
    print(f"\n{'─'*60}")
    print(f"Running: {item.name}")
    print(f"{'─'*60}")
