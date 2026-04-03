# Bridge Module Tests

Comprehensive pytest test suite for the Bridge module.

## Test Coverage

### TestBridgeInitialization
- Network initialization (testnet, mainnet, ganache, custom RPC)
- Configuration loading
- Contract setup

### TestAddressHandling
- Checksum address conversion
- Wallet connection with private keys

### TestBalanceManagement
- Loading and saving total balances
- Balance persistence
- Empty balance handling

### TestClaimsManagement
- Checking if address has claimed
- Calculating unclaimed amounts
- Resetting individual and all claims
- Deleting claims
- Saving and retrieving claim data

### TestTokenFunctions
- Balance queries (default and specific addresses)
- Token decimals retrieval
- Balance formatting (wei to human-readable)

### TestBridgeFunctions
- Processing single claims (with hash or address)
- Batch processing multiple claims
- Getting claim recipients
- Total claims calculation

### TestMintBurnTransfer
- Minting tokens (owner only)
- Burning tokens
- Transferring tokens

### TestAuthVerification
- Sr25519 signature verification
- Claim processing with auth tokens
- Zero balance handling
- Clearing claims

### TestUtilityFunctions
- Generic transaction sending
- Contract compilation

### TestContractLoading
- Loading contracts from config
- ABI retrieval from IPFS
- Error handling

### TestIPFSIntegration
- IPFS client initialization
- ABI mapping and upload

## Running Tests

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run All Tests
```bash
pytest
```

### Run with Coverage
```bash
pytest --cov=bridge --cov-report=html
```

### Run Specific Test Class
```bash
pytest test/test_bridge.py::TestClaimsManagement -v
```

### Run Specific Test
```bash
pytest test/test_bridge.py::TestClaimsManagement::test_has_claimed_true -v
```

### Run Tests by Marker
```bash
pytest -m unit
```

## Test Structure

Tests use mocking extensively to avoid requiring actual blockchain connections or IPFS access. Key mocked components:

- **mod framework**: Mocked to avoid dependencies on other modules
- **Web3**: Mocked to simulate blockchain interactions
- **IPFS**: Mocked for ABI storage/retrieval
- **Auth module**: Mocked for sr25519 verification
- **Store module**: Mocked for persistence

## Adding New Tests

When adding new functionality to the Bridge module:

1. Create a new test class or add to existing class
2. Mock external dependencies
3. Test both success and error cases
4. Ensure test isolation (no shared state)
5. Use descriptive test names

Example:
```python
def test_new_feature_success(self, bridge_instance):
    """Test new feature with valid input."""
    result = bridge_instance.new_feature('valid_input')
    assert result == expected_value

def test_new_feature_error(self, bridge_instance):
    """Test new feature with invalid input."""
    with pytest.raises(ValueError):
        bridge_instance.new_feature('invalid_input')
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines without external dependencies. All blockchain and network interactions are mocked.
