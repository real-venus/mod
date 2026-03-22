# Building Modules

How to create modules for ModRS. Every mod is a folder with a struct.

## Two Formats

### 1. File-based (`mod.rs`)

The simplest format. Drop a `mod.rs` in a folder — the module registry auto-discovers it by scanning for `pub fn` patterns.

```
orbit/
└── mymod/
    └── mod.rs      <- your module
```

```rust
//! mymod — one-line description here

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyMod {
    pub name: String,
    pub version: String,
}

impl MyMod {
    pub fn new() -> Self {
        Self {
            name: "mymod".into(),
            version: "0.1.0".into(),
        }
    }

    pub fn hello(&self, params: Value) -> Value {
        let name = params.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("world");
        serde_json::json!({ "message": format!("hello, {}", name) })
    }

    pub fn status(&self) -> Value {
        serde_json::json!({
            "name": self.name,
            "version": self.version,
            "status": "running"
        })
    }
}
```

Every `pub fn` on the struct becomes a callable route:
```bash
m call mymod/hello --params '{"name": "test"}'
m call mymod/status
```

### 2. Crate-based (`src/lib.rs` + ModApi trait)

For compiled modules (native + WASM). Lives in `mods/` workspace.

```
mods/
└── mymod/
    ├── Cargo.toml
    ├── mod.rs          <- file-based (for module registry)
    └── src/
        └── lib.rs      <- crate-based (for compilation)
```

**Cargo.toml:**
```toml
[package]
name = "mod_mymod"
version = "0.1.0"
edition.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
mod_sdk = { path = "../mod_sdk" }
serde = { workspace = true }
serde_json = { workspace = true }

[target.'cfg(target_arch = "wasm32")'.dependencies]
wasm-bindgen = "0.2"
```

**src/lib.rs:**
```rust
use mod_sdk::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyMod {
    pub name: String,
    pub version: String,
}

impl MyMod {
    pub fn new() -> Self {
        Self { name: "mymod".into(), version: "0.1.0".into() }
    }

    pub fn hello(&self, params: Value) -> Result<Response, ModError> {
        let name = params.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("world");
        Ok(Response::ok(json!({ "message": format!("hello, {}", name) })))
    }

    pub fn compute(&self, params: Value) -> Result<Response, ModError> {
        let x = params.get("x")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| ModError::bad_request("missing 'x'"))?;
        let y = params.get("y")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| ModError::bad_request("missing 'y'"))?;

        Ok(Response::ok(json!({
            "sum": x + y,
            "product": x * y
        })))
    }
}

impl ModApi for MyMod {
    fn name(&self) -> &str { &self.name }
    fn version(&self) -> &str { &self.version }
    fn description(&self) -> &str { "my mod" }

    fn handle(&self, req: Request) -> Result<Response, ModError> {
        match req.method.as_str() {
            "hello"   => self.hello(req.params),
            "compute" => self.compute(req.params),
            "info"    => Ok(Response::ok(serde_json::to_value(self.info()).unwrap())),
            _ => Err(ModError::not_found(format!("method '{}' not found", req.method))),
        }
    }

    fn routes(&self) -> Vec<Route> {
        vec![
            Route::new("hello", "Say hello")
                .with_params(vec![
                    Param::optional("name", "string").desc("Name to greet"),
                ]),
            Route::new("compute", "Math operations")
                .with_params(vec![
                    Param::required("x", "f64").desc("First number"),
                    Param::required("y", "f64").desc("Second number"),
                ]),
        ]
    }
}
```

## WASM Support

Add a `wasm` module to your `src/lib.rs` for WebAssembly compilation:

```rust
#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;
    use std::sync::Mutex;

    static INSTANCE: std::sync::LazyLock<Mutex<MyMod>> =
        std::sync::LazyLock::new(|| Mutex::new(MyMod::new()));

    #[wasm_bindgen]
    pub fn handle(method: &str, params_json: &str) -> String {
        let params = parse_params(params_json);
        let req = Request::new(method, params);
        let instance = INSTANCE.lock().unwrap();
        response_to_json(instance.handle(req))
    }

    #[wasm_bindgen]
    pub fn info() -> String {
        let instance = INSTANCE.lock().unwrap();
        serde_json::to_string(&instance.info()).unwrap_or_default()
    }
}
```

Build:
```bash
make wasm-mymod
```

## Scaffold a New Module

```bash
# from CLI
m new mymod --description "my new module"

# from mods/ directory
make new NAME=mymod
```

Both create the folder structure with boilerplate code.

## Module Discovery

The `ModuleRegistry` scans these paths (in order):

1. `config.paths.orbit` — first orbit (new mods go here)
2. `config.paths.mod_dir/core` — core modules
3. `config.paths.lib/mods` — library modules

Each folder containing a `mod.rs` is registered as a module. The registry parses:
- `//!` first line — module description
- `pub fn` patterns — available functions
- `version: "x.y.z"` — version field

## SDK Types

### Request
```rust
pub struct Request {
    pub method: String,                    // function to call
    pub params: Value,                     // JSON parameters
    pub headers: HashMap<String, String>,  // optional headers
}
```

### Response
```rust
pub struct Response {
    pub status: u16,                       // HTTP status code
    pub data: Value,                       // JSON response body
    pub headers: HashMap<String, String>,  // optional headers
}

// constructors
Response::ok(data)          // 200
Response::created(data)     // 201
Response::error(code, msg)  // any code
```

### ModError
```rust
pub struct ModError {
    pub code: u16,
    pub message: String,
}

// constructors
ModError::not_found("msg")     // 404
ModError::bad_request("msg")   // 400
ModError::internal("msg")      // 500
ModError::new(code, "msg")     // custom
```

### Route
```rust
pub struct Route {
    pub method: String,
    pub description: String,
    pub params: Vec<Param>,
}

Route::new("hello", "Say hello")
    .with_params(vec![
        Param::required("name", "string").desc("Name to greet"),
        Param::optional("format", "string").desc("Response format"),
    ])
```

### Param
```rust
Param::required("name", "string")   // must be provided
Param::optional("name", "string")   // can be omitted
    .desc("Description")            // add description
```

## Testing Modules

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        let m = MyMod::new();
        let req = Request::new("hello", json!({"name": "test"}));
        let resp = m.handle(req).unwrap();
        assert_eq!(resp.status, 200);
        assert_eq!(resp.data["message"], "hello, test");
    }

    #[test]
    fn test_not_found() {
        let m = MyMod::new();
        let req = Request::new("nonexistent", json!({}));
        let err = m.handle(req).unwrap_err();
        assert_eq!(err.code, 404);
    }
}
```

Run tests:
```bash
make test           # all mods
make test-mymod     # specific mod
```

## Serving as HTTP

Any module can be served as an HTTP API:

```bash
m serve mymod --port 8000
```

This creates:
- `POST /:function` — call with `{"params": {...}}`
- `GET /info` — module metadata

```bash
curl -X POST http://0.0.0.0:8000/hello \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "world"}}'

curl http://0.0.0.0:8000/info
```
