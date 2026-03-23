# BT Module Test Suite

Comprehensive test suite for the Bittensor (bt) trading and copy-trading module.

## Quick Start

```bash
# Run all tests
python3 -m pytest test_bt.py -v

# Run tests with coverage (requires pytest-cov)
python3 -m pytest test_bt.py --cov=bt --cov-report=term-missing

# Run specific test class
python3 -m pytest test_bt.py::TestEdgeCases -v

# Run specific test
python3 -m pytest test_bt.py::TestBtTrader::test_buy_success -v
```

## Test Structure

### Test Classes

| Class | Purpose | Tests |
|-------|---------|-------|
| `TestBt` | Core network operations | 39 |
| `TestBtTrader` | Trading operations | 46 |
| `TestTaoCopy` | Copy-trading & indexing | 59 |
| `TestWalletCapitalization` | Regression tests | 2 |
| `TestEdgeCases` | Boundary conditions | 20 |
| `TestIntegration` | Multi-step workflows | 4 |
| **Total** | | **156** |

### Key Features

✅ **100% Mocked** - All tests run offline without real dependencies
✅ **Fast** - Complete suite runs in ~130ms
✅ **Deterministic** - No flaky tests, consistent results
✅ **Well Organized** - Clear structure by feature area
✅ **Comprehensive** - Covers normal, edge, and error cases

## Test Categories

### Unit Tests
Test individual methods in isolation:
```bash
python3 -m pytest test_bt.py::TestBt -v
python3 -m pytest test_bt.py::TestBtTrader -v
python3 -m pytest test_bt.py::TestTaoCopy -v
```

### Edge Case Tests
Test boundary conditions and unusual inputs:
```bash
python3 -m pytest test_bt.py::TestEdgeCases -v
```

Examples:
- Very large/small numbers (1M TAO, 0.000001 TAO)
- Empty collections
- Malformed data
- Zero values
- Extreme ratios

### Integration Tests
Test complete workflows:
```bash
python3 -m pytest test_bt.py::TestIntegration -v
```

Examples:
- Full trading lifecycle (scan → buy → portfolio → sell)
- Copy-trading workflow (scan → rank → copy)
- Index fund management (create → buy → rebalance → sell)

### Parametrized Tests
Tests that run multiple times with different inputs:
```python
@pytest.mark.parametrize("amount,expected", [
    (0.01, True),
    (10000.0, True),
    (0.000001, True),
])
def test_buy_various_amounts(self, amount, expected):
    ...
```

## Writing New Tests

### Test Method Template
```python
def test_feature_behavior(self):
    """Brief description of what this tests."""
    # Setup
    obj, mock = _make_bt()  # or _make_trader(), _make_taocopy()
    mock.method.return_value = expected_value

    # Execute
    result = obj.feature()

    # Assert
    assert result == expected_value
    mock.method.assert_called_once_with(expected_args)
```

### Helper Functions
- `_make_bt()` - Create mocked Bt instance
- `_make_trader()` - Create mocked BtTrader instance
- `_make_taocopy()` - Create mocked TaoCopy instance
- `_fake_subnet()` - Generate fake subnet data
- `_fake_neuron()` - Generate fake neuron data
- `_fb(val)` - Create FakeBalance object

### Best Practices

1. **Name tests descriptively**: `test_buy_success`, `test_buy_failure`
2. **One assertion per test**: Focus on one behavior
3. **Use pytest.approx()**: For floating-point comparisons
4. **Mock at the boundary**: Mock subtensor/wallet, not internal logic
5. **Test both paths**: Success and failure cases
6. **Document edge cases**: Explain why boundary values matter

## Common Patterns

### Testing with Mock Return Values
```python
def test_balance(self):
    bt_obj, sub = _make_bt()
    sub.get_balance.return_value = _fb(42.5)
    assert bt_obj.balance('5Addr') == 42.5
```

### Testing with Side Effects
```python
def test_scan_multiple(self):
    t, sub = _make_trader()
    sub.get_subnets.return_value = [1, 2, 3]
    sub.subnet.side_effect = lambda netuid, **kw: _fake_subnet(netuid=netuid)
    result = t.scan()
    assert len(result) == 3
```

### Testing Error Handling
```python
def test_scan_skips_errors(self):
    t, sub = _make_trader()
    sub.get_subnets.return_value = [1, 2]
    def side_effect(netuid):
        if netuid == 2:
            raise Exception("RPC error")
        return _fake_subnet(netuid=netuid)
    sub.subnet.side_effect = side_effect
    result = t.scan()
    assert len(result) == 1  # Only subnet 1
```

## Debugging Failed Tests

### View Full Traceback
```bash
python3 -m pytest test_bt.py -v --tb=long
```

### Run Specific Failed Test
```bash
python3 -m pytest test_bt.py::TestClass::test_method -vv
```

### Use Print Debugging
```python
def test_something(self):
    result = obj.method()
    print(f"DEBUG: result = {result}")  # Shows in output with -s
    assert result == expected
```

Run with:
```bash
python3 -m pytest test_bt.py::test_something -v -s
```

## Coverage Analysis

### Generate HTML Report
```bash
python3 -m pytest test_bt.py --cov=bt --cov-report=html
open htmlcov/index.html
```

### Terminal Coverage Report
```bash
python3 -m pytest test_bt.py --cov=bt --cov-report=term-missing
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Tests
  run: |
    python3 -m pytest bt/test_bt.py -v --tb=short
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit
python3 -m pytest mod/orbit/bt/bt/test_bt.py -q
```

## Troubleshooting

### Import Errors
Make sure you're in the correct directory:
```bash
cd /Users/broski/mod/mod/orbit/bt/bt
python3 -m pytest test_bt.py
```

### Mock Issues
If mocks aren't working, check `conftest.py` is being loaded:
```bash
python3 -m pytest test_bt.py -v --setup-show
```

### Floating Point Precision
Use `pytest.approx()` for float comparisons:
```python
assert result == pytest.approx(expected_value, rel=1e-6)
```

## Additional Resources

- See `TEST_IMPROVEMENTS.md` for detailed improvement notes
- See `conftest.py` for mock setup and fixtures
- See `test_bt.py` for test examples
- pytest docs: https://docs.pytest.org/

## Contributing

When adding new features to bt module:
1. Write tests first (TDD)
2. Add both success and failure cases
3. Add edge case tests if applicable
4. Run full test suite before committing
5. Maintain 100% pass rate
