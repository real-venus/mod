# ZERC Tutorial

## How Confidential Tokens Work

Traditional ERC20 tokens store balances as `uint256` — fully visible on-chain. Anyone can see how much anyone holds, every transfer amount, and all allowances.

ZERC replaces `uint256` with `euint64` — **encrypted 64-bit unsigned integers**. The chain only stores ciphertext handles (32-byte pointers). Actual encrypted values live on the FHE coprocessor.

### What's Encrypted vs. Public

| Data | Visibility |
|------|-----------|
| Balances | Encrypted (euint64) |
| Transfer amounts | Encrypted (euint64) |
| Allowances | Encrypted (euint64) |
| Total supply | Public (uint64) |
| From/to addresses | Public |
| Transaction existence | Public |

### The Coprocessor Model

```
                    Host Chain              FHE Coprocessor
                    ----------              ---------------
store:              bytes32 handles    →    actual ciphertexts
compute:            emit FHE events    →    TFHE operations
result:             receive handles    ←    deterministic outputs
```

The host chain never performs FHE. It stores pointers and routes computation requests to the coprocessor network, which runs the actual encrypted arithmetic.

## Encrypted Types

```
ebool    — encrypted boolean (comparison results)
euint8   — encrypted 8-bit  (error codes)
euint16  — encrypted 16-bit
euint32  — encrypted 32-bit
euint64  — encrypted 64-bit (token balances/amounts)
euint128 — encrypted 128-bit
eaddress — encrypted address
einput   — external encrypted input from user
```

## Core Pattern: Oblivious Execution

You **cannot branch** on encrypted values. `if (TFHE.le(a, b))` is impossible — the condition is encrypted. Instead, both paths execute and `TFHE.select` picks the result:

```solidity
// WRONG — cannot do this:
if (TFHE.le(amount, balance)) {
    balance -= amount;
}

// RIGHT — oblivious execution:
ebool canTransfer = TFHE.le(amount, balance);
euint64 transferValue = TFHE.select(canTransfer, amount, TFHE.asEuint64(0));
balance = TFHE.sub(balance, transferValue);
```

Both subtraction paths always run. If the condition is false, `transferValue` is 0, so the subtraction is a no-op. An observer cannot tell if the transfer succeeded.

## Encrypted Transfer Flow

```
1. Alice encrypts 100 tokens client-side
   → produces (handle, zkProof)

2. Alice calls transfer(bob, handle, zkProof)

3. Contract:
   a. TFHE.asEuint64(handle, zkProof)  → verify + get euint64
   b. TFHE.le(amount, balances[alice]) → ebool canTransfer
   c. TFHE.select(canTransfer, amount, 0) → euint64 transferValue
   d. balances[bob]   += transferValue
   e. balances[alice] -= transferValue
   f. emit Transfer(alice, bob, PLACEHOLDER)

4. Event reveals: alice sent something to bob
   Amount, success/failure, balances → all encrypted
```

## Viewing Your Balance

Since balances are encrypted under the network key, you need **re-encryption** to view yours:

```
1. Generate ephemeral keypair (pub, priv)
2. Sign EIP-712: "I authorize re-encryption of my balance at contract X"
3. Send (pub, signature) to Gateway
4. Gateway verifies signature, re-encrypts balance under your pub key
5. You decrypt locally with priv key
6. Discard keypair
```

## Python SDK Usage

### Setup
```python
from zerc import Mod

mod = Mod(
    network_url="https://fhevm-gateway.example.com",
    gateway_url="https://gateway.example.com",
)
```

### Encrypt a Transfer Amount
```python
encrypted = mod.encrypt_amount(
    amount=1_000_000,           # 1.0 tokens (6 decimals)
    contract_address="0xABC...",
    signer_address="0xDEF...",
)

# Use in web3 contract call:
# contract.transfer(recipient, encrypted.handle, encrypted.input_proof)
```

### Multi-Value Encryption
```python
builder = mod.create_encrypted_input("0xABC...", "0xDEF...")
builder.add64(1_000_000)  # amount
builder.add64(500_000)    # another value
result = builder.encrypt()

handle1 = result.handles[0]
handle2 = result.handles[1]
proof = result.input_proof
```

### View Balance
```python
keypair, request = mod.view_balance(
    contract_address="0xABC...",
    balance_handle=handle_bytes,
    eip712_signature=sig,
)

# Send request to Gateway, receive re-encrypted ciphertext
# reencrypted = gateway.reencrypt(request)
# plaintext_balance = keypair.decrypt(reencrypted)
```

### ZK Proof Generation
```python
proof = mod.generate_input_proof(
    ciphertext_handle=handle_bytes,
    plaintext=1_000_000,
    bit_width=64,
    contract_address="0xABC...",
    signer_address="0xDEF...",
)

assert proof.verify(handle_bytes)
proof_bytes = proof.to_bytes()
```

## Wrapping Standard ERC20

ZERCWrapped converts a standard ERC20 into a confidential token:

```
wrap():
  1. User approves ZERCWrapped to spend their ERC20
  2. User calls wrap(amount)
  3. Contract pulls ERC20, adjusts decimals (18→6)
  4. Mints equivalent encrypted ZERC20 balance

unwrap():
  1. User calls unwrap(amount)
  2. Account is locked (prevents double-spend during async decryption)
  3. Gateway decrypts balance check (amount <= balance?)
  4. Callback: if sufficient, burn ZERC20 and release ERC20
  5. Account is unlocked
```

## Contract Deployment

```python
mod = Mod()

# Get deployable Solidity source
source = mod.get_contract_source("ZERCToken")

# Deploy via your preferred tool (Hardhat, Foundry, etc.)
# Constructor: ZERCToken("My Token", "MTK", ownerAddress)
```

## Security Considerations

1. **Total supply is public** — an observer knows the total tokens in existence
2. **Addresses are public** — an observer knows who transacts (but not amounts)
3. **Timing** — transaction timing can leak information
4. **Mint amounts** — mint uses plaintext amounts that become encrypted in balance
5. **Wrap amounts** — the deposited ERC20 amount is public at wrap time
