# ModRS

Rust implementation of the Mod framework. Each module is a folder with a `mod.rs` containing one struct — every public function becomes an API route.

## Install

```bash
cargo build --release
```

Binary installs as `m`.

## Quick Start

```bash
# list all modules
m mods

# get module info
m info example

# call a function
m call example/hello --params '{"name": "world"}'

# create a new module
m new mymod --description "my first mod"

# serve a module as HTTP API
m serve example --port 8000
```

## Architecture

```
modrs/
├── src/
│   ├── lib.rs          # Mod struct — main API entry point
│   ├── bin/main.rs     # CLI binary (m)
│   ├── module/mod.rs   # Module registry & discovery
│   ├── server/mod.rs   # Axum HTTP server per module
│   ├── config/mod.rs   # Config loading (toml/yaml/json)
│   ├── crypto/mod.rs   # secp256k1 keys, sign, verify, encrypt
│   ├── store/mod.rs    # Unified storage layer
│   │   ├── sqlite.rs   # Local KV store
│   │   └── ipfs.rs     # Distributed content store
│   ├── git/mod.rs      # Git operations
│   ├── error/mod.rs    # Error types
│   ├── utils/mod.rs    # Utilities
│   └── ai/mod.rs       # AI integration (optional)
└── mods/               # Module implementations
    ├── mod_sdk/        # Shared ModApi trait
    └── example/        # Reference implementation
```

## API

The `Mod` struct is the single entry point. Everything goes through it.

### Modules

```rust
use modrs::prelude::*;

let m = Mod::new().await?;

// list modules
let mods = m.mods().await?;

// call module/function
let result = m.call("example/hello", json!({"name": "mod"})).await?;

// get module info
let info = m.info("example").await?;

// view source
let code = m.code("example").await?;

// create / remove
m.create_mod("mymod", Some("does things"))?;
m.remove_mod("mymod")?;
```

### Crypto

```rust
// get key address (ethereum-compatible)
let addr = m.address(None).await?;

// sign data
let sig = m.sign(&json!({"tx": "data"}), None).await?;

// verify
let valid = m.verify(&json!({"tx": "data"}), &sig, &addr).await?;

// encrypt / decrypt
let encrypted = m.encrypt(b"secret", None).await?;
let decrypted = m.decrypt(&encrypted, None).await?;

// list keys
let keys = m.keys().await?;
```

### Storage (SQLite KV)

```rust
m.put("key", &json!({"data": 1}), false)?;
let val = m.get("key", false)?;
m.delete("key")?;
```

### Storage (IPFS)

```rust
let cid = m.ipfs_add(b"content").await?;
let data = m.ipfs_cat(&cid).await?;
m.ipfs_pin(&cid).await?;
m.ipfs_unpin(&cid).await?;
let pins = m.ipfs_pins().await?;
let url = m.ipfs_url(&cid);
```

### Server

```rust
// serve module as HTTP API on port
m.serve("example", 8000).await?;

// list running servers
let servers = m.servers().await;

// stop server
m.kill("example").await?;
```

Once served, call functions via HTTP:

```bash
curl -X POST http://0.0.0.0:8000/hello \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "world"}}'
```

### Git

```rust
m.push("commit message").await?;
m.clone("https://github.com/user/repo", "dest").await?;
let repos = m.repos().await?;
```

### AI (optional, enable `ai` feature)

```rust
let answer = m.ask("what is mod?").await?;
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `m mods [--search term]` | List modules |
| `m info <module>` | Module info (JSON) |
| `m code <module>` | View mod.rs source |
| `m dp <module>` | Module directory path |
| `m fns <module>` | List public functions |
| `m call <module/fn> [--params json]` | Call a function |
| `m new <name> [--description text]` | Create module |
| `m rm <name> [--force]` | Remove module |
| `m serve <module> [--port 8000]` | Start HTTP server |
| `m servers` | List running servers |
| `m kill <module>` | Stop server |
| `m sign <data> [--key name]` | Sign JSON data |
| `m verify <data> <sig> <addr>` | Verify signature |
| `m address [--key name]` | Get key address |
| `m keys` | List keys |
| `m put <key> <value> [--encrypt]` | Store value |
| `m get <key> [--decrypt]` | Retrieve value |
| `m ipfs-add <data>` | Add to IPFS |
| `m ipfs-cat <cid>` | Get from IPFS |
| `m ipfs-pin <cid>` | Pin on IPFS |
| `m ipfs-pins` | List pinned CIDs |
| `m ipfs-status` | Check IPFS daemon |
| `m push <message>` | Git commit + push |
| `m clone <url> [dest]` | Clone repo |
| `m repos` | List repositories |
| `m hash <data> [--mode sha256]` | Hash data |
| `m sys-info` | System information |

## Building Mods

### Module Structure

Every mod is a folder with a struct. Two formats:

**File-based** (`mod.rs`) — auto-discovered by the module registry:

```rust
//! mymod — does things
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyMod {
    pub name: String,
    pub version: String,
}

impl MyMod {
    pub fn new() -> Self {
        Self { name: "mymod".into(), version: "0.1.0".into() }
    }

    pub fn hello(&self, params: Value) -> Value {
        serde_json::json!({ "message": format!("hello from {}", self.name) })
    }
}
```

**Crate-based** (`src/lib.rs`) — compiles to native + WASM:

```rust
use mod_sdk::*;
use serde_json::{json, Value};

pub struct MyMod { pub name: String, pub version: String }

impl ModApi for MyMod {
    fn name(&self) -> &str { &self.name }
    fn version(&self) -> &str { &self.version }
    fn description(&self) -> &str { "my mod" }

    fn handle(&self, req: Request) -> Result<Response, ModError> {
        match req.method.as_str() {
            "hello" => Ok(Response::ok(json!({"msg": "hello"}))),
            _ => Err(ModError::not_found(format!("method '{}' not found", req.method))),
        }
    }

    fn routes(&self) -> Vec<Route> {
        vec![Route::new("hello", "Say hello")]
    }
}
```

### SDK Types

```rust
// Request coming in
pub struct Request {
    pub method: String,        // function name
    pub params: Value,         // JSON params
    pub headers: HashMap<String, String>,
}

// Response going out
pub struct Response {
    pub status: u16,           // 200, 400, 404, 500
    pub data: Value,           // JSON response
    pub headers: HashMap<String, String>,
}

// Error
pub struct ModError {
    pub code: u16,
    pub message: String,
}

// Route definition
pub struct Route {
    pub method: String,
    pub description: String,
    pub params: Vec<Param>,
}
```

### Build Commands

```bash
cd mods/

# build all mods native
make

# build all mods as WASM
make wasm

# build specific mod as WASM
make wasm-example

# create new mod scaffold
make new NAME=mymod

# run tests
make test

# list mods
make list
```

## Config

Searches `~/.mod/` for `mod.toml`, `mod.yaml`, `mod.yml`, or `mod.json`:

```toml
[paths]
home = "~/.mod"
orbit = "~/.mod/orbit"
mod_dir = "~/.mod/mod"

[ports]
default = 8000

[crypto]
default_key = "main"

[store]
backend = "sqlite"
encrypt_by_default = false

[store.ipfs]
endpoint = "http://127.0.0.1:5001"
gateway = "https://ipfs.io"
```

## License

MIT
