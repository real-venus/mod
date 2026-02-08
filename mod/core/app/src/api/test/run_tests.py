#!/usr/bin/env python3
"""
Test Runner for API Tests

This script runs all pytest tests for the API module.

Usage:
    python run_tests.py                 # Run all tests
    python run_tests.py -v              # Run with verbose output
    python run_tests.py -k test_api     # Run specific test
    python run_tests.py --cov           # Run with coverage report
"""
import sys
import pytest
import os
from pathlib import Path


def main():
    """Main test runner function"""
    # Get the test directory
    test_dir = Path(__file__).parent

    # Default pytest arguments
    args = [
        str(test_dir),           # Run tests in this directory
        '-v',                     # Verbose output
        '--tb=short',            # Short traceback format
        '--color=yes',           # Colored output
        '-s',                    # Show print statements
    ]

    # Add any command line arguments passed to this script
    if len(sys.argv) > 1:
        args.extend(sys.argv[1:])

    print("=" * 70)
    print("Running API Tests")
    print("=" * 70)
    print(f"Test directory: {test_dir}")
    print(f"Arguments: {' '.join(args)}")
    print("=" * 70)
    print()

    # Run pytest
    exit_code = pytest.main(args)

    print()
    print("=" * 70)
    if exit_code == 0:
        print("✓ All tests passed!")
    else:
        print(f"✗ Tests failed with exit code: {exit_code}")
    print("=" * 70)

    return exit_code


if __name__ == '__main__':
    sys.exit(main())
