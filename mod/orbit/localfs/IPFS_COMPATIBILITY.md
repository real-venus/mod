# IPFS CID Compatibility

This document explains how LocalFS achieves 100% CIDv0 compatibility with IPFS.

## Overview

LocalFS generates **identical CIDs** to IPFS for the same content by implementing the exact same encoding pipeline:

```
Raw Data → UnixFS Encoding → DAG-PB Encoding → SHA-256 → Multihash → Base58 → CID
```

## CID Format Breakdown

### Example: "hello world"

Let's trace how `b'hello world'` becomes `Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD`:

#### Step 1: Raw Data
```
Data: hello world
Hex:  68656c6c6f20776f726c64
```

#### Step 2: UnixFS Protobuf Encoding

IPFS wraps all file data in a UnixFS protobuf structure:

```protobuf
message Data {
  enum DataType {
    Raw = 0;
    Directory = 1;
    File = 2;          // ← We use this for files
    Metadata = 3;
    Symlink = 4;
    HAMTShard = 5;
  }
  required DataType Type = 1;
  optional bytes Data = 2;
  optional uint64 filesize = 3;
  repeated uint64 blocksizes = 4;
  optional uint64 hashType = 5;
  optional uint64 fanout = 6;
}
```

**Encoded result:**
```
Hex:  08 02 12 0b 68656c6c6f20776f726c64 18 0b
      │  │  │  │  └─── "hello world" data
      │  │  │  └─ length = 11 bytes
      │  │  └─ field 2 (Data), wire type 2 (length-delimited)
      │  └─ value = 2 (File type)
      └─ field 1 (Type), wire type 0 (varint)
         field 3 (filesize), wire type 0 (varint)
         value = 11
```

#### Step 3: DAG-PB Protobuf Encoding

The UnixFS data is then wrapped in a DAG-PB node:

```protobuf
message PBNode {
  repeated PBLink Links = 2;  // Empty for simple files
  optional bytes Data = 1;     // Contains UnixFS data
}
```

**Encoded result:**
```
Hex:  0a 11 0802120b68656c6c6f20776f726c64180b
      │  │  └─── UnixFS data from step 2
      │  └─ length = 17 bytes
      └─ field 1 (Data), wire type 2 (length-delimited)
```

#### Step 4: SHA-256 Hash

Hash the DAG-PB encoded data:

```
SHA-256: f852c7fa62f971817f54d8a80dcd63fcf7098b3cbde9ae8ec1ee449013ec5db0
```

#### Step 5: Multihash Format

Add multihash prefix indicating hash function and length:

```
Hex:  12 20 f852c7fa62f971817f54d8a80dcd63fcf7098b3cbde9ae8ec1ee449013ec5db0
      │  │  └─── SHA-256 hash (32 bytes)
      │  └─ length = 0x20 = 32 bytes
      └─ hash function = 0x12 = SHA-256
```

#### Step 6: Base58 Encoding

Encode the multihash in base58:

```
Result: Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD
```

✅ **This exactly matches IPFS!**

## Protobuf Wire Types

Understanding protobuf encoding is key to CID compatibility:

| Wire Type | Meaning | Used For |
|-----------|---------|----------|
| 0 | Varint | int32, int64, uint32, uint64, bool, enum |
| 1 | 64-bit | fixed64, double |
| 2 | Length-delimited | string, bytes, embedded messages |
| 3 | Start group | (deprecated) |
| 4 | End group | (deprecated) |
| 5 | 32-bit | fixed32, float |

### Field Encoding

Each field is encoded as:
```
(field_number << 3) | wire_type
```

Examples:
- Field 1, varint: `(1 << 3) | 0 = 0x08`
- Field 2, length-delimited: `(2 << 3) | 2 = 0x12`
- Field 3, varint: `(3 << 3) | 0 = 0x18`

### Varint Encoding

Protobuf uses variable-length encoding for integers:

- Values 0-127: single byte
- Values > 127: MSB set to 1, continue reading
- Little-endian 7-bit chunks

Example: 300
```
300 = 0b100101100
Split into 7-bit chunks: [0000010 0101100]
Encode: [10101100 00000010] = 0xac02
```

## Verification

You can verify CID compatibility with:

```bash
python3 verify_ipfs_compat.py
```

This compares LocalFS CIDs against known IPFS CIDv0 values:

| Content | CID | Status |
|---------|-----|--------|
| `b'hello world'` | `Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD` | ✅ |
| `b''` (empty) | `QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH` | ✅ |

## Implementation

Both Python and Rust implementations use the same encoding logic:

### Python (localfs/mod.py)

```python
def _compute_cid(self, data: bytes) -> str:
    # 1. Wrap in UnixFS format
    unixfs_data = self._encode_unixfs_data(data)

    # 2. Wrap in DAG-PB format
    dag_pb_node = self._encode_dagpb_node(unixfs_data)

    # 3. Hash the DAG-PB node
    hash_bytes = hashlib.sha256(dag_pb_node).digest()

    # 4. Add multihash prefix
    multihash = b'\x12\x20' + hash_bytes

    # 5. Base58 encode
    return base58.b58encode(multihash).decode('ascii')
```

### Rust (localfs/rust/src/lib.rs)

```rust
fn compute_cid(data: &[u8]) -> PyResult<String> {
    // 1. Wrap in UnixFS format
    let unixfs_data = encode_unixfs_data(data);

    // 2. Wrap in DAG-PB format
    let dag_pb_node = encode_dagpb_node(&unixfs_data);

    // 3. Hash the DAG-PB node
    let mut hasher = Sha256::new();
    hasher.update(&dag_pb_node);
    let hash_bytes = hasher.finalize();

    // 4. Add multihash prefix
    let mut multihash = vec![0x12, 0x20];
    multihash.extend_from_slice(&hash_bytes);

    // 5. Base58 encode
    Ok(bs58::encode(multihash).into_string())
}
```

## References

- [IPFS Specs - CID](https://github.com/multiformats/cid)
- [Multihash Specification](https://github.com/multiformats/multihash)
- [UnixFS Specification](https://github.com/ipfs/specs/blob/master/UNIXFS.md)
- [DAG-PB Specification](https://github.com/ipld/specs/blob/master/block-layer/codecs/dag-pb.md)
- [Protobuf Encoding](https://developers.google.com/protocol-buffers/docs/encoding)

## Limitations

- **CIDv0 only**: LocalFS only supports CIDv0 (Qm...) format, not CIDv1
- **Single blocks**: Large files are not chunked (IPFS chunks files > 256KB)
- **No DAG links**: Complex DAG structures with links are not supported
- **File type only**: Only UnixFS File type is supported (not Directory, Symlink, etc.)

For simple content-addressable storage with IPFS-compatible CIDs, these limitations are acceptable. For full IPFS functionality, use IPFS itself.
