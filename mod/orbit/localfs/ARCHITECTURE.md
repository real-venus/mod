# LocalFS Architecture

## Overview

LocalFS is a content-addressable storage system that provides IPFS-like functionality without requiring IPFS. It uses SHA-256 hashing with base58 encoding to generate CIDs (Content Identifiers) compatible with IPFS's Qm... format.

## Design Goals

1. **No External Dependencies**: Works without IPFS daemon or network
2. **IPFS-Compatible API**: Drop-in replacement for basic IPFS operations
3. **High Performance**: Optional Rust bindings for speed-critical operations
4. **Pure Python Fallback**: Works without Rust if needed
5. **Content Deduplication**: Automatic via content-addressing
6. **Simple Storage**: Plain filesystem, no database required

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   LocalFS Client                    │
│                    (Python API)                     │
└──────────────┬────────────────────┬─────────────────┘
               │                    │
               ▼                    ▼
     ┌─────────────────┐  ┌──────────────────┐
     │  Pure Python    │  │  Rust Bindings   │
     │  Implementation │  │  (Optional)      │
     └─────────────────┘  └──────────────────┘
               │                    │
               └────────┬───────────┘
                        ▼
              ┌──────────────────┐
              │  Storage Layer   │
              │  (Filesystem)    │
              └──────────────────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
      ┌─────────┐ ┌─────────┐ ┌──────────┐
      │ blocks/ │ │  pins/  │ │index.json│
      └─────────┘ └─────────┘ └──────────┘
```

## Core Components

### 1. CID Generation

```python
def _compute_cid(self, data: bytes) -> str:
    # SHA-256 hash
    hash_bytes = hashlib.sha256(data).digest()

    # Multihash format: [hash_function, length, hash]
    # 0x12 = SHA-256, 0x20 = 32 bytes
    multihash = b'\x12\x20' + hash_bytes

    # Base58 encode (IPFS Qm... format)
    return base58.b58encode(multihash).decode('ascii')
```

**Rust Implementation:**
```rust
fn compute_cid(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let hash_bytes = hasher.finalize();

    let mut multihash = vec![0x12, 0x20];
    multihash.extend_from_slice(&hash_bytes);

    bs58::encode(multihash).into_string()
}
```

### 2. Storage Layer

#### Block Storage

Blocks are stored in a sharded directory structure:

```
~/.localfs/blocks/
├── QmXx/
│   ├── QmXx1234...  # Block file
│   └── QmXx5678...
├── QmYy/
│   └── QmYy1234...
└── QmZz/
    └── QmZz1234...
```

**Sharding Strategy:**
- Uses first 4 characters of CID as shard key
- Prevents too many files in single directory
- Improves filesystem performance

#### Index Structure

```json
{
  "blocks": {
    "QmXx...": {
      "size": 1234,
      "type": "dict"
    }
  },
  "pins": ["QmXx...", "QmYy..."]
}
```

**Index Operations:**
- Loaded on init
- Saved after each modification
- Can be rebuilt from blocks if corrupted

### 3. Pin Management

Pinning prevents garbage collection:

```python
class LocalFS:
    def pin_add(self, cid: str):
        self.index['pins'].add(cid)
        self._save_index()

    def pin_rm(self, cid: str):
        self.index['pins'].remove(cid)
        self._save_index()

    def gc(self, aggressive=False):
        for cid in self.index['blocks']:
            if cid not in self.index['pins']:
                # Remove unpinned block
                self._remove_block(cid)
```

### 4. Data Serialization

**Input → Bytes:**
```python
if isinstance(data, dict) or isinstance(data, list):
    data_bytes = json.dumps(data).encode('utf-8')
elif isinstance(data, str):
    data_bytes = data.encode('utf-8')
elif isinstance(data, bytes):
    data_bytes = data
else:
    data_bytes = str(data).encode('utf-8')
```

**Bytes → Output:**
```python
try:
    return json.loads(data_bytes.decode('utf-8'))
except (json.JSONDecodeError, UnicodeDecodeError):
    return data_bytes  # Return raw bytes if not JSON
```

## Performance Optimizations

### 1. Rust Bindings

**Why Rust?**
- 10-50x faster SHA-256 hashing
- 2-5x faster file I/O
- Zero-cost abstractions
- Memory safety without GC

**Critical Path Operations:**
- `compute_cid()` - Most called, benefits most
- `write_block()` - File I/O bottleneck
- `read_block()` - Hot path for retrieval

### 2. Sharding

Without sharding, a directory with 100,000+ files becomes slow:
- Linux ext4: Degrades after ~10,000 files
- macOS APFS: Better, but still degrades
- Windows NTFS: Similar issues

With sharding (4 char prefix):
- 46^4 = ~4.5M possible shards
- ~25 files per shard for 100K total files
- Maintains O(1) filesystem operations

### 3. Index Caching

Index is loaded once and cached in memory:
- No repeated JSON parsing
- Fast pin lookups (set operations)
- Only written on modifications

## Comparison with IPFS

| Feature | IPFS | LocalFS |
|---------|------|---------|
| **Network** | P2P distributed | Local only |
| **CID Format** | CIDv0/v1 | CIDv0 (Qm...) |
| **Hash Function** | SHA-256 + others | SHA-256 only |
| **Storage** | Datastore + Filestore | Filesystem only |
| **Daemon Required** | Yes | No |
| **Language** | Go | Python + Rust |
| **Size** | ~50MB | ~50KB |

## Thread Safety

**Current Status:** Not thread-safe

**Issues:**
- Index writes not atomic
- Race conditions in pin management
- File operations not locked

**Future Improvements:**
```python
import threading

class LocalFS:
    def __init__(self):
        self._lock = threading.RLock()

    def put(self, data):
        with self._lock:
            # Safe operations
            pass
```

## Error Handling

### Missing Blocks

```python
def get(self, cid):
    block_path = self._block_path(cid)
    if not block_path.exists():
        raise FileNotFoundError(f"Block not found: {cid}")
```

### Corrupted Index

```python
def _load_index(self):
    try:
        with open(self.index_path, 'r') as f:
            self.index = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # Rebuild from blocks
        self._rebuild_index()
```

## Future Enhancements

### 1. Compression

```python
import zlib

def put(self, data, compress=True):
    data_bytes = self._serialize(data)
    if compress:
        data_bytes = zlib.compress(data_bytes)
    # ... store compressed
```

### 2. Encryption

```python
from cryptography.fernet import Fernet

class EncryptedLocalFS(LocalFS):
    def __init__(self, key=None):
        self.cipher = Fernet(key or Fernet.generate_key())

    def put(self, data, encrypt=True):
        data_bytes = self._serialize(data)
        if encrypt:
            data_bytes = self.cipher.encrypt(data_bytes)
        # ... store encrypted
```

### 3. Merkle DAG

Support for IPFS-style linked data structures:

```python
def put_dag(self, obj):
    # Recursively store nested objects
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, (dict, list)):
                obj[key] = {'/' : self.put_dag(value)}
    return self.put(obj)
```

### 4. Async I/O

```python
import asyncio

class AsyncLocalFS(LocalFS):
    async def put(self, data):
        data_bytes = self._serialize(data)
        cid = await self._compute_cid_async(data_bytes)
        await self._write_block_async(cid, data_bytes)
        return cid
```

## Testing Strategy

### Unit Tests
- CID computation correctness
- Serialization/deserialization
- Pin management
- Index persistence

### Integration Tests
- Multi-instance access
- Large file handling
- Garbage collection
- Index rebuilding

### Performance Tests
- Throughput benchmarks
- Latency measurements
- Memory usage profiling
- Rust vs Python comparison

## Security Considerations

### 1. Path Traversal

CIDs are base58, can't contain path separators:
- No `../` possible
- Sharding uses CID prefix only

### 2. Storage Limits

No built-in limits:
- Disk space is the limit
- Could add quotas if needed

### 3. Index Security

Index is plain JSON:
- No authentication
- World-readable if permissions allow
- Could encrypt if needed

## Maintenance

### Rebuilding Index

```bash
# Delete corrupted index
rm ~/.localfs/index.json

# Rebuild on next init
python -c "from localfs import LocalFS; LocalFS()"
```

### Migrating Storage

```bash
# Copy entire directory
cp -r ~/.localfs /new/location

# Update path
lfs = LocalFS(storage_path="/new/location")
```

### Backup Strategy

```bash
# Backup blocks only (can rebuild index)
tar -czf localfs-backup.tar.gz ~/.localfs/blocks

# Restore
tar -xzf localfs-backup.tar.gz -C ~/.localfs/
```

## References

- [IPFS Specifications](https://github.com/ipfs/specs)
- [Multihash](https://github.com/multiformats/multihash)
- [Base58 Encoding](https://en.wikipedia.org/wiki/Base58)
- [Content Addressing](https://en.wikipedia.org/wiki/Content-addressable_storage)
