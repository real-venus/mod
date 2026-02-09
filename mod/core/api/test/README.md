# API Test Suite

This directory contains comprehensive tests for the API module.

## Test Structure

```
api/test/
├── __init__.py              # Package initialization
├── conftest.py              # Pytest fixtures and configuration
├── test_api.py              # API core functionality tests
├── test_router.py           # Router functionality tests
├── test_token.py            # Token authentication tests
├── test_integration.py      # Integration tests
├── run_tests.py             # Test runner script
└── README.md                # This file
```

## Running Tests

### Run All Tests

```bash
# Using the test runner
python run_tests.py

# Using pytest directly
pytest src/api/test/ -v

# From any directory
python -m pytest src/api/test/
```

### Run Specific Test Files

```bash
# Test only API core
pytest src/api/test/test_api.py -v

# Test only Router
pytest src/api/test/test_router.py -v

# Test only Token
pytest src/api/test/test_token.py -v

# Test only Integration
pytest src/api/test/test_integration.py -v
```

### Run Specific Test Classes or Methods

```bash
# Run a specific test class
pytest src/api/test/test_api.py::TestApiCore -v

# Run a specific test method
pytest src/api/test/test_api.py::TestApiCore::test_api_initialization -v
```

### Run with Coverage

```bash
# Generate coverage report
pytest src/api/test/ --cov=api --cov-report=html

# View coverage in terminal
pytest src/api/test/ --cov=api --cov-report=term
```

### Run with Specific Options

```bash
# Show print statements
pytest src/api/test/ -v -s

# Stop on first failure
pytest src/api/test/ -x

# Run only tests matching keyword
pytest src/api/test/ -k "test_api"

# Run in parallel (requires pytest-xdist)
pytest src/api/test/ -n auto
```

## Test Categories

### 1. API Core Tests (`test_api.py`)
Tests for main API functionality:
- API initialization
- Module registration
- Content management
- IPFS integration
- Registry operations
- Balance functionality

### 2. Router Tests (`test_router.py`)
Tests for Router functionality:
- Task creation and execution
- Function calls
- Transaction management
- Sync operations

### 3. Token Tests (`test_token.py`)
Tests for Token authentication:
- Token creation
- Token verification
- Token data extraction
- Signature validation

### 4. Integration Tests (`test_integration.py`)
End-to-end integration tests:
- API and Router integration
- Store integration
- Token authentication flow
- Complete workflows

## Test Fixtures

Available fixtures (defined in `conftest.py`):

- `test_key`: Provides a test key for authentication
- `api_instance`: Provides an initialized API instance
- `router_instance`: Provides an initialized Router instance
- `token_instance`: Provides an initialized Token instance
- `sample_params`: Provides sample parameters for testing
- `cleanup_test_files`: Helps cleanup test files after tests

## Writing New Tests

### Example Test

```python
import pytest
from api.api.api import Api

class TestMyFeature:
    """Test suite for my feature"""

    def test_something(self, api_instance):
        """Test that something works"""
        result = api_instance.some_method()
        assert result is not None
        assert isinstance(result, dict)

    def test_something_else(self):
        """Test something else"""
        api = Api(key='test', store='ipfs')
        assert api.some_property == expected_value
```

### Test Naming Conventions

- Test files: `test_*.py`
- Test classes: `Test*`
- Test methods: `test_*`

### Using Pytest Markers

```python
@pytest.mark.slow
def test_slow_operation():
    """Test that takes a long time"""
    pass

@pytest.mark.skip(reason="Not implemented yet")
def test_future_feature():
    """Test for future feature"""
    pass

@pytest.mark.parametrize("input,expected", [
    (1, 2),
    (2, 4),
    (3, 6),
])
def test_with_parameters(input, expected):
    """Parametrized test"""
    assert input * 2 == expected
```

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run API Tests
  run: |
    pip install -r requirements.txt
    pytest src/api/test/ -v --cov=api
```

## Troubleshooting

### Import Errors

If you get import errors, make sure:
1. The `mod` module is in your Python path
2. All dependencies are installed: `pip install -r requirements.txt`
3. You're running from the correct directory

### Skipped Tests

Tests may be skipped if:
- Required modules are not available
- Test dependencies are missing
- The environment is not properly configured

To see why tests are skipped:
```bash
pytest src/api/test/ -v -rs
```

## Requirements

Install test dependencies:
```bash
pip install pytest>=8.0.0
pip install pytest-asyncio>=0.23.0
pip install pytest-cov>=4.1.0
pip install pytest-mock>=3.12.0
```

Or install from requirements.txt:
```bash
pip install -r requirements.txt
```

## Legacy Tests

The legacy test file is located at:
- `src/api/api/test/test.py`

This file maintains backward compatibility and can run standalone or via pytest.
