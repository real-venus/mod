# Transaction Management

Comprehensive transaction management system for the Bridge module to prevent nonce conflicts and gas price issues.

## Problem Statement

When sending multiple transactions or retrying failed transactions, common issues include:

1. **Nonce Conflicts**: Sending transactions with duplicate or out-of-order nonces
2. **Underpriced Replacements**: Trying to replace a pending transaction without increasing gas price
3. **Race Conditions**: Multiple concurrent transactions competing for the same nonce
4. **Gas Estimation Failures**: Transactions running out of gas

## Solution

The Bridge module now includes robust transaction management with:

### 1. Nonce Management

**Features:**
- **Nonce Caching**: Tracks last used nonce per address to prevent conflicts
- **Pending Awareness**: Can query nonces including pending transactions
- **Sequential Allocation**: Automatically increments nonces for sequential transactions
- **Reset Capability**: Can reset nonce cache when needed

**API:**
```python
# Get next nonce (includes pending by default)
nonce = bridge.get_nonce()

# Get nonce without pending
nonce = bridge.get_nonce(use_pending=False)

# Get nonce for specific address
nonce = bridge.get_nonce(address='0x...')

# Reset nonce cache
bridge.reset_nonce()
```

### 2. Gas Price Management

**Features:**
- **Smart Multiplier**: Increases gas price by 20% by default for faster inclusion
- **Dynamic Adjustment**: Can adjust multiplier based on network conditions
- **Retry Escalation**: Automatically increases gas price on retry attempts

**Configuration:**
```python
bridge.GAS_PRICE_MULTIPLIER = 1.2  # 20% increase
```

**API:**
```python
# Get gas price with default multiplier
gas_price = bridge.get_gas_price()

# Get gas price with custom multiplier
gas_price = bridge.get_gas_price(multiplier=1.5)  # 50% increase
```

### 3. Gas Limit Estimation

**Features:**
- **Automatic Estimation**: Uses eth_estimateGas with buffer
- **Safety Buffer**: Adds 30% buffer by default to prevent out-of-gas
- **Fallback Value**: Returns safe default if estimation fails

**Configuration:**
```python
bridge.GAS_LIMIT_BUFFER = 1.3  # 30% buffer
```

**API:**
```python
# Estimate gas with buffer
gas_limit = bridge.estimate_gas(tx_params)

# Estimate with custom buffer
gas_limit = bridge.estimate_gas(tx_params, buffer=2.0)
```

### 4. Transaction Retry Logic

**Features:**
- **Automatic Retry**: Retries on nonce/gas price errors
- **Smart Detection**: Identifies recoverable vs non-recoverable errors
- **Exponential Backoff**: Delays between retries
- **Gas Price Escalation**: Increases gas by 10% per retry

**Configuration:**
```python
bridge.MAX_RETRIES = 3
bridge.NONCE_RETRY_DELAY = 1  # seconds
```

**Error Recovery:**
- `nonce too low` → Reset nonce, fetch fresh, retry
- `replacement transaction underpriced` → Increase gas price 10%, retry
- `insufficient funds` → Fail immediately (non-recoverable)
- `execution reverted` → Fail immediately (non-recoverable)

## Usage

### Basic Transaction

All contract methods now use the improved transaction management:

```python
# Mint tokens - automatic nonce and gas management
receipt = bridge.mint('0x...', 100)

# Process claim - automatic retry on failure
receipt = bridge.process_claim('addr', '0x...', 1000)

# Burn tokens - automatic gas estimation
receipt = bridge.burn('0x...', 50)
```

### Advanced Usage

For custom transactions:

```python
# Build transaction with managed nonce/gas
tx = bridge.build_transaction(
    contract.functions.customFunction(args),
    gas_limit=250000  # optional override
)

# Send with retry logic
receipt = bridge.send_transaction(tx, max_retries=5)
```

### Sequential Transactions

Nonce management automatically handles sequential transactions:

```python
# These will get nonces 10, 11, 12 automatically
bridge.mint('0xAAA', 100)  # nonce 10
bridge.mint('0xBBB', 200)  # nonce 11
bridge.mint('0xCCC', 300)  # nonce 12
```

### Error Handling

Transactions can still fail after retries:

```python
try:
    receipt = bridge.process_claim('addr', '0x...', 1000)
    print(f"Success! Gas used: {receipt['gasUsed']}")
except Exception as e:
    print(f"Failed after retries: {e}")
    # Handle failure (log, alert, etc.)
```

## Configuration

### Adjust for Network Conditions

**High Congestion (Mainnet during peak hours):**
```python
bridge.GAS_PRICE_MULTIPLIER = 1.5  # 50% increase
bridge.GAS_LIMIT_BUFFER = 1.5       # 50% buffer
bridge.MAX_RETRIES = 5
```

**Low Congestion (Testnet):**
```python
bridge.GAS_PRICE_MULTIPLIER = 1.1  # 10% increase
bridge.GAS_LIMIT_BUFFER = 1.2       # 20% buffer
bridge.MAX_RETRIES = 3
```

**Development (Local Ganache):**
```python
bridge.GAS_PRICE_MULTIPLIER = 1.0  # No increase needed
bridge.GAS_LIMIT_BUFFER = 1.1       # Minimal buffer
bridge.MAX_RETRIES = 1              # Fail fast
```

## Monitoring

Track transaction management metrics:

```python
# Check current nonce cache
print(bridge._last_nonce)

# Check pending nonce locks
print(bridge._nonce_lock)

# Get chain nonce vs cached
chain_nonce = bridge.w3.eth.get_transaction_count(bridge.account.address)
cached_nonce = bridge._last_nonce.get(bridge.account.address, -1)
print(f"Chain: {chain_nonce}, Cached: {cached_nonce}")
```

## Testing

Comprehensive test suite covers all scenarios:

```bash
# Run transaction management tests
pytest test/test_transaction_management.py -v

# Run specific test class
pytest test/test_transaction_management.py::TestNonceManagement -v

# Run with coverage
pytest test/test_transaction_management.py --cov=bridge
```

### Test Coverage

- ✅ Nonce management (fresh, cached, pending, reset)
- ✅ Gas price calculation (default, custom multipliers)
- ✅ Gas limit estimation (success, failure, custom buffer)
- ✅ Transaction building (basic, custom gas)
- ✅ Transaction sending (success, retry, failure)
- ✅ Error recovery (nonce, underpriced, non-recoverable)
- ✅ Integration with contract methods
- ✅ Sequential transaction handling

## Troubleshooting

### Issue: "nonce too low"

**Cause**: Cached nonce out of sync with chain

**Solution:**
```python
bridge.reset_nonce()
# Then retry transaction
```

### Issue: "replacement transaction underpriced"

**Cause**: Trying to replace pending tx without higher gas price

**Solution:**
```python
# Increase gas multiplier
receipt = bridge.send_transaction(tx, max_retries=5)
# Automatic retry will increase gas price
```

### Issue: Transactions stuck pending

**Cause**: Gas price too low for network conditions

**Solution:**
```python
# Increase default multiplier
bridge.GAS_PRICE_MULTIPLIER = 2.0  # 100% increase

# Or get current recommended gas price
current_gas = bridge.w3.eth.gas_price
bridge.GAS_PRICE_MULTIPLIER = current_gas / bridge.w3.eth.gas_price
```

### Issue: Out of gas

**Cause**: Gas limit too low

**Solution:**
```python
# Increase buffer
bridge.GAS_LIMIT_BUFFER = 2.0  # 100% buffer

# Or specify custom gas limit
tx = bridge.build_transaction(function, gas_limit=500000)
```

## Best Practices

1. **Let Automatic Management Handle It**: Don't manually set nonces unless necessary
2. **Use Default Settings**: Only adjust multipliers/buffers for specific network conditions
3. **Monitor Gas Prices**: Check network conditions before batch operations
4. **Test on Testnet**: Always test transaction flow on testnet first
5. **Handle Errors Gracefully**: Catch exceptions and log failures
6. **Reset Between Tests**: Call `reset_nonce()` between test runs
7. **Batch When Possible**: Use `batch_process_claims()` instead of multiple single transactions

## Future Enhancements

Potential improvements:

- EIP-1559 support (maxFeePerGas, maxPriorityFeePerGas)
- Gas price oracle integration for dynamic pricing
- Transaction pooling for batch optimization
- Mempool monitoring for pending transaction status
- Automatic gas price adjustment based on network congestion
- Transaction replacement/cancellation utilities
