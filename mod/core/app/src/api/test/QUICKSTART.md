# API Testing Quick Start Guide

Get up and running with API tests in 2 minutes!

## Installation

```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-cov pytest-mock
```

## Run Tests

### Option 1: Use the Test Runner (Recommended)

```bash
cd /Users/broski/mod/mod/core/app/src/api/test
python run_tests.py
```

### Option 2: Use Pytest Directly

```bash
cd /Users/broski/mod/mod/core/app
pytest src/api/test/ -v
```

### Option 3: Run Individual Test Files

```bash
# Test API core
python -m pytest src/api/test/test_api.py -v

# Test Router
python -m pytest src/api/test/test_router.py -v

# Test Token auth
python -m pytest src/api/test/test_token.py -v

# Test integration
python -m pytest src/api/test/test_integration.py -v
```

## Example Output

```
======================================================================
Running API Tests
======================================================================
Test directory: /Users/broski/mod/mod/core/app/src/api/test
Arguments: . -v --tb=short --color=yes -s
======================================================================

collected 25 items

test_api.py::TestApiCore::test_api_initialization PASSED
test_api.py::TestApiCore::test_api_has_required_methods PASSED
test_api.py::TestApiCore::test_key_address PASSED
...

======================================================================
✓ All tests passed!
======================================================================
```

## Common Commands

```bash
# Run all tests with coverage
pytest src/api/test/ --cov=api --cov-report=html

# Run only fast tests
pytest src/api/test/ -m "not slow"

# Run tests matching a keyword
pytest src/api/test/ -k "test_api"

# Stop on first failure
pytest src/api/test/ -x

# Show all output (including print statements)
pytest src/api/test/ -v -s

# Run tests in parallel (faster)
pip install pytest-xdist
pytest src/api/test/ -n auto
```

## Writing Your First Test

Create a new test file:

```python
# test_my_feature.py
import pytest
from api.api.api import Api

class TestMyFeature:
    def test_something(self):
        """Test that something works"""
        api = Api(key='test', store='ipfs')
        result = api.my_method()
        assert result is not None
```

Run it:
```bash
pytest test_my_feature.py -v
```

## Debugging Failed Tests

```bash
# Show full traceback
pytest src/api/test/ --tb=long

# Drop into debugger on failure
pytest src/api/test/ --pdb

# Show print output
pytest src/api/test/ -s
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [conftest.py](conftest.py) for available fixtures
- Look at existing tests for examples

## Need Help?

- Check pytest docs: https://docs.pytest.org/
- See test examples in `test_*.py` files
- Review fixtures in `conftest.py`
