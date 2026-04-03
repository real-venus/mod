# ModRS API Reference

Complete API reference for the `Mod` struct — the single entry point for all operations.

## Initialization

```rust
use modrs::prelude::*;

// default config (loads from ~/.mod/)
let m = Mod::new().await?;

// custom config
let config = config::Config::load()?;
let m = Mod::with_config(config).await?;
```

---

## Module Operations

### `m.mods() -> Vec<String>`
List all discovered modules.

### `m.module(name) -> Arc<dyn Module>`
Load a module by name. Returns the module trait object.

### `m.call(path, params) -> Value`
Call a module function. Path format: `"module/function"`.

```rust
let result = m.call("example/hello", json!({"name": "world"})).await?;
// -> {"message": "hello, world", "from": "example"}
```

### `m.info(name) -> ModuleInfo`
Get module metadata — name, version, description, path, functions.

### `m.code(name) -> String`
Read the module's `mod.rs` source code.

### `m.dirpath(name) -> PathBuf`
Get the module's directory path on disk.

### `m.mod_exists(name) -> bool`
Check if a module exists.

### `m.create_mod(name, description) -> PathBuf`
Create a new module. Scaffolds a folder with `mod.rs` containing one struct.

### `m.remove_mod(name)`
Delete a module's folder entirely.

---

## Cryptographic Operations

All crypto uses secp256k1 (Ethereum-compatible).

### `m.key(name) -> Arc<KeyPair>`
Get a keypair by name. `None` returns the default key.

### `m.keys() -> Vec<String>`
List all key names.

### `m.address(key_name) -> String`
Get the Ethereum address derived from a key's public key.

### `m.sign(data, key_name) -> Signature`
Sign a JSON value. Returns `Signature { r, s, v }`.

```rust
let sig = m.sign(&json!({"action": "transfer"}), None).await?;
```

### `m.verify(data, signature, address) -> bool`
Verify a signature against an address.

```rust
let valid = m.verify(&data, &sig, "0x...").await?;
```

### `m.encrypt(data, key_name) -> Vec<u8>`
AES-GCM encrypt bytes using a key.

### `m.decrypt(data, key_name) -> Vec<u8>`
AES-GCM decrypt bytes using a key.

---

## Storage — SQLite KV

Local key-value store backed by SQLite.

### `m.put(key, value, encrypt)`
Store a JSON value. Set `encrypt: true` to encrypt before storing.

### `m.get(key, decrypt) -> Option<Value>`
Retrieve a value by key.

### `m.delete(key)`
Delete a key.

---

## Storage — IPFS

Distributed content-addressed storage. Requires IPFS daemon running.

### `m.ipfs_add(data) -> String`
Add bytes to IPFS. Returns CID.

### `m.ipfs_cat(cid) -> Vec<u8>`
Get content from IPFS by CID.

### `m.ipfs_pin(cid)`
Pin content so it persists.

### `m.ipfs_unpin(cid)`
Unpin content.

### `m.ipfs_pins() -> Vec<String>`
List all pinned CIDs.

### `m.ipfs_stat(cid) -> StatResponse`
Get IPFS object stats (size, links, etc).

### `m.ipfs_online() -> bool`
Check if the IPFS daemon is reachable.

### `m.ipfs_url(cid) -> String`
Get the gateway URL for a CID.

### `m.store() -> &Store`
Access the raw store (both `kv` and `ipfs`).

---

## Server Operations

Serve any module as an HTTP API using Axum.

### `m.serve(module_name, port)`
Start an HTTP server for a module.

```rust
m.serve("example", 8000).await?;
```

Endpoints created:
- `POST /:function` — call with `{"params": {...}}`
- `GET /info` — module info

### `m.kill(module_name)`
Stop a running server.

### `m.servers() -> Vec<ServerInfo>`
List running servers. Returns `ServerInfo { name, port, url }`.

### `m.server_exists(module_name) -> bool`
Check if a server is running.

---

## Git Operations

### `m.push(message)`
Stage all changes, commit, and push.

### `m.clone(url, dest)`
Clone a git repository.

### `m.repos() -> Vec<String>`
List repositories in the home directory.

---

## AI Operations

Requires the `ai` feature flag.

### `m.ask(prompt) -> String`
Send a prompt to OpenRouter and get a response.

```rust
let answer = m.ask("explain modular architecture").await?;
```

---

## Utility Operations

### `m.time() -> u64`
Current UTC timestamp (seconds).

### `m.config() -> &Config`
Access the loaded configuration.

### `m.hash(data, mode) -> String`
Hash bytes. Modes: `sha256`, `sha3`, `blake3`, `keccak256`.

### `m.print(text, color)`
Print colored text to terminal.
