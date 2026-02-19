# ZERC — Zero-knowledge ERC20

Confidential ERC20 token based on Zama's fhEVM (Fully Homomorphic Encryption Virtual Machine).

## Overview

ZERC implements a confidential token where **balances, transfer amounts, and allowances are encrypted** using Fully Homomorphic Encryption. The architecture follows Zama's coprocessor model:

1. **Host chain** stores `bytes32` ciphertext handles (pointers)
2. **FHE coprocessor** performs encrypted computation off-chain
3. **Gateway** re-encrypts results for authorized viewers
4. **ZK proofs** accompany every encrypted input from users

All arithmetic happens on ciphertexts — the chain never sees plaintext balances.

## Architecture

```
User (client-side)
  |
  |  1. Encrypt amount under network FHE pubkey
  |  2. Generate ZK proof of well-formedness
  |  3. Submit (handle, proof) to contract
  v
ZERC20 Contract (host chain)
  |
  |  Stores euint64 handles, emits placeholder events
  |  Calls TFHE.asEuint64(handle, proof) to verify
  |  Uses TFHE.select() for oblivious execution
  v
TFHE Coprocessor (off-chain)
  |
  |  Performs actual FHE operations on ciphertexts
  |  Returns deterministic handles to host chain
  v
Gateway (re-encryption)
  |
  |  Re-encrypts balance for authorized viewer
  |  Authenticated via EIP-712 signature
  v
User (client-side decryption)
```

## Contracts

| Contract | Description |
|----------|-------------|
| `TFHE.sol` | FHE library — encrypted types (euint64, ebool) and operations |
| `IZERC20.sol` | Interface for confidential ERC20 |
| `ZERC20.sol` | Abstract base — encrypted balances, oblivious transfers, ACL |
| `ZERCToken.sol` | Deployable token with owner mint and burn |
| `ZERCWrapped.sol` | Wrap standard ERC20 into confidential ZERC20 |

## Key Patterns

**Oblivious execution** — both transfer paths always run:
```solidity
ebool canTransfer = TFHE.le(amount, _balances[from]);
euint64 transferValue = TFHE.select(canTransfer, amount, TFHE.asEuint64(0));
// Both add and sub always execute
newBalanceTo = TFHE.add(_balances[to], transferValue);
newBalanceFrom = TFHE.sub(_balances[from], transferValue);
```

**Encrypted inputs** — user submits ciphertext + ZK proof:
```solidity
function transfer(address to, einput encryptedAmount, bytes calldata inputProof) public {
    euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);
    // ... transfer with verified encrypted amount
}
```

**ACL permissions** — every ciphertext handle has access control:
```solidity
TFHE.allowThis(newBalance);          // contract can operate on it
TFHE.allow(newBalance, account);     // account owner can view it
```

## Python Module

```python
from zerc.mod import Mod

mod = Mod(network_url="...", gateway_url="...")

# Encrypt a transfer amount
encrypted = mod.encrypt_amount(
    amount=1000000,  # 1.0 tokens (6 decimals)
    contract_address="0x...",
    signer_address="0x...",
)
# encrypted.handle → 32-byte ciphertext pointer
# encrypted.input_proof → ZK proof bytes

# View encrypted balance (re-encryption)
keypair, request = mod.view_balance(
    contract_address="0x...",
    balance_handle=handle_bytes,
    eip712_signature=sig_bytes,
)

# Get contract source
source = mod.get_contract_source("ZERCToken")
```

## Quick Start

```bash
pip install -r requirements.txt
```

```python
from zerc import Mod

mod = Mod()
print(mod.forward(action="info"))
print(mod.list_contracts())
```

## Docker

```bash
docker-compose up --build
```

## References

- [Zama fhEVM](https://github.com/zama-ai/fhevm) — FHE for EVM smart contracts
- [TFHE-rs](https://github.com/zama-ai/tfhe-rs) — Rust implementation of TFHE
- [ERC-7984](https://ethereum-magicians.org/) — Confidential token standard (Zama + OpenZeppelin + Inco)
- [Zama Protocol Docs](https://docs.zama.org/protocol/)

## Security

- 128-bit encryption security
- Post-quantum resistant FHE scheme (TFHE lattice-based)
- ZK proofs prevent replay attacks and malformed ciphertexts
- ACL system prevents unauthorized access to ciphertext handles
