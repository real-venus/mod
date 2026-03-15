# ModRS Quick Start Guide

## Installation

### From Source
```bash
cd /Users/broski/mod/mod/orbit/modrs
cargo build --release
```

### Install CLI Globally
```bash
cargo install --path .
```

## Basic Usage

### 1. Initialize Mod
```rust
use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    let m = Mod::new().await?;
    Ok(())
}
```

### 2. Module Operations
```bash
# List modules
m mods

# Get module info
m info api

# View module code
m code api

# Call module function
m call api/info --params '{}'
```

### 3. Cryptographic Operations
```bash
# Get address
m address

# Sign data
m sign '{"message":"hello"}' --key mykey

# List keys
m keys
```

### 4. Storage Operations
```bash
# Store value
m put mykey '{"data":"value"}'

# Retrieve value
m get mykey

# Store encrypted
m put secret '{"password":"1234"}' --encrypt
m get secret --decrypt
```

### 5. Server Operations
```bash
# Start server
m serve api --port 8000

# List servers
m servers

# Stop server
m kill api
```

### 6. Git Operations
```bash
# Commit and push
m push "feat: add new feature"

# Clone repository
m clone https://github.com/user/repo

# List repos
m repos
```

### 7. AI Operations (with ai feature)
```bash
# Set API key
export OPENROUTER_API_KEY="your-key"

# Ask AI
m ask "How do I implement a module?"
```

## Library Usage

### Module Loading
```rust
let m = Mod::new().await?;
let module = m.module("api").await?;
let result = module.call("info", json!({})).await?;
```

### Crypto
```rust
let key = m.key(Some("mykey")).await?;
let address = key.ethereum_address();
let signature = key.sign(&json!({"data": "test"}))?;
```

### Storage
```rust
m.put("key", &json!({"value": 123}), false).await?;
let value: Option<Value> = m.get("key", false).await?;
```

### Server
```rust
m.serve("api", 8000).await?;
let servers = m.servers().await;
m.kill("api").await?;
```

## Configuration

Create `~/.mod/mod.toml`:
```toml
[mod]
name = "my-project"
version = "0.1.0"

[mod.paths]
orbit = "~/.mod/orbit"
storage = "~/.mod/storage"

[mod.ports]
range = [8000, 9000]

[mod.crypto]
default_algorithm = "secp256k1"

[mod.storage]
backend = "sqlite"
encrypt_by_default = false

[mod.server]
default_host = "0.0.0.0"
cors_enabled = true
```

## Examples

Run examples:
```bash
cargo run --example basic
cargo run --example server
```

## Testing

```bash
# Run all tests
cargo test

# Run with all features
cargo test --all-features

# Run specific test
cargo test test_key_generation

# Run benchmarks
cargo bench
```

## Development

```bash
# Format code
cargo fmt

# Run linter
cargo clippy -- -D warnings

# Generate docs
cargo doc --open

# Build release
cargo build --release
```

## Features

Enable optional features:
```toml
[dependencies]
modrs = { path = "...", features = ["ai", "ipfs", "rocksdb-storage"] }
```

Available features:
- `full` - All features (default)
- `ai` - AI integration (OpenRouter)
- `ipfs` - IPFS storage
- `rocksdb-storage` - RocksDB backend

## Troubleshooting

### Port already in use
```bash
# Kill server
m kill api

# Or use different port
m serve api --port 8001
```

### Missing API key
```bash
export OPENROUTER_API_KEY="your-key"
```

### Build errors
```bash
# Clean and rebuild
cargo clean
cargo build
```

## Next Steps

- Read the full [README](README.md)
- Check [API Documentation](https://docs.rs/modrs)
- Review [Examples](examples/)
- Join our community

---

**Need Help?**
- Open an issue on GitHub
- Check the documentation
- Ask in discussions
