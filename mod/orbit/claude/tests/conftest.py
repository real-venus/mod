"""
Pytest configuration file.
This file is automatically loaded by pytest and provides shared fixtures.
"""
import pytest
import os
from pathlib import Path


def pytest_configure(config):
    """Called before test run starts."""
    print("\n" + "="*60)
    print("CLAUDE CODE TEST SUITE")
    print("="*60)

    api_key = os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('ANTHROPIC_AUTH_TOKEN')
    max_auth = (Path.home() / '.claude' / '.credentials.json').exists()

    if api_key:
        print("  Auth: API key")
    elif max_auth:
        print("  Auth: Claude Max subscription")
    else:
        print("  Auth: None detected — CLI tests will be skipped")

    print("="*60 + "\n")


def pytest_runtest_setup(item):
    """Called before each test."""
    print(f"\n{'─'*60}")
    print(f"Running: {item.name}")
    print(f"{'─'*60}")
