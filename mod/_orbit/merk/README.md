# Merk - Merkle Tree Prover

A Python implementation of a Merkle tree prover for substring membership verification without revealing position.

## Overview

Merk provides a cryptographic proof system that allows you to prove a substring exists within a larger text without revealing its position. This is achieved using Merkle tree data structures and hash-based proofs.

## Features

- **Position-Agnostic Proofs**: Prove substring membership without revealing location
- **Efficient Verification**: Fast cryptographic verification using SHA-256
- **Configurable Chunking**: Customize chunk size for tree construction
- **Zero-Knowledge Properties**: Verifier learns only that substring exists, not where

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```python
from merk import MerkleProver

# Initialize with your text data
text = "hello world this is a merkle tree proof system"
prover = MerkleProver(data=text, chunk_size=1)

# Get the Merkle root
root = prover.get_root()
print(f"Root hash: {root}")

# Generate proof for a substring
substring = "merkle"
proof = prover.generate_proof(substring)

if proof:
    # Verify the proof
    is_valid = prover.verify_proof(substring, proof, root)
    print(f"Proof valid: {is_valid}")
else:
    print(f"Substring '{substring}' not found")
```

## API Reference

### MerkleProver

#### `__init__(data: str = 'hey', chunk_size: int = 1)`
Initialize the Merkle prover with string data and chunk size.

**Parameters:**
- `data`: The text data to build the tree from
- `chunk_size`: Size of each leaf chunk (default: 1)

#### `build_tree(data: str, chunk_size: int = 1) -> List[List[str]]`
Build the Merkle tree from the provided data.

**Returns:** The complete tree structure as nested lists

#### `generate_proof(substring: str) -> Optional[Tuple[List[Tuple[str, str]], List[int]]]`
Generate a Merkle proof for substring membership.

**Parameters:**
- `substring`: The substring to prove exists

**Returns:** Tuple of (sibling hashes with positions, leaf hashes) or None if not found

#### `verify_proof(substring: str, proof: Tuple[List[Tuple[str, str]], List[str]], root: str) -> bool`
Verify a Merkle proof against the root hash.

**Parameters:**
- `substring`: The substring being verified
- `proof`: The proof tuple from generate_proof
- `root`: The Merkle root hash to verify against

**Returns:** True if proof is valid, False otherwise

#### `get_root() -> str`
Get the Merkle root hash.

**Returns:** The root hash as a hex string

#### `test()`
Run built-in test suite.

**Returns:** Dictionary with test results including root, proof, and validity

## How It Works

1. **Tree Construction**: Text is split into chunks and hashed to form leaves
2. **Proof Generation**: For a substring, collect sibling hashes along the path to root
3. **Verification**: Recompute hashes from leaves to root using proof data
4. **Privacy**: Position information is not included in the proof

## Example Output

```
Root hash: a1b2c3d4e5f6...

Proof generated for 'merkle'
Proof size: 8 siblings
Proof valid: True
```

## Security Considerations

- Uses SHA-256 for cryptographic hashing
- Proof size grows logarithmically with text length
- First occurrence is used for proof (could be randomized for additional privacy)

## License

MIT

## Author

Built with passion by the mod team 🚀