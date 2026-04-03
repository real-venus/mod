#!/bin/bash
# Test runner script for Claude Code interface

echo "======================================================================"
echo "Claude Code Test Runner"
echo "======================================================================"

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo "❌ pytest not found. Installing..."
    pip install pytest
fi

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo "⚠️  WARNING: ANTHROPIC_API_KEY not set"
    echo "Some tests will be skipped."
    echo "To run all tests, export your API key:"
    echo "  export ANTHROPIC_API_KEY='your-api-key-here'"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run tests
echo ""
echo "Running tests with streaming output enabled..."
echo "======================================================================"

cd "$(dirname "$0")/.." || exit 1

# Run all tests with verbose output and show print statements
pytest tests/test_claude.py -v -s --tb=short "$@"

exit_code=$?

echo ""
echo "======================================================================"
if [ $exit_code -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed (exit code: $exit_code)"
fi
echo "======================================================================"

exit $exit_code
