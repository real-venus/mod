# ModSDK Reference

The `mod_sdk` crate provides the shared interface for building mods. Every crate-based mod depends on it.

## Dependency

```toml
[dependencies]
mod_sdk = { path = "../mod_sdk" }
```

## ModApi Trait

The core trait every mod implements:

```rust
pub trait ModApi: Send + Sync {
    /// Module name
    fn name(&self) -> &str;

    /// Module version (semver)
    fn version(&self) -> &str;

    /// One-line description
    fn description(&self) -> &str;

    /// Dispatch incoming request to the right handler
    fn handle(&self, req: Request) -> Result<Response, ModError>;

    /// List all available routes with descriptions and param schemas
    fn routes(&self) -> Vec<Route>;

    /// Module info — auto-derived from name/version/description/routes
    fn info(&self) -> ModInfo { ... }
}
```

## Request

```rust
pub struct Request {
    pub method: String,
    pub params: Value,
    pub headers: HashMap<String, String>,
}

// create
Request::new("hello", json!({"name": "world"}))
```

## Response

```rust
pub struct Response {
    pub status: u16,
    pub data: Value,
    pub headers: HashMap<String, String>,
}

// constructors
Response::ok(json!({"result": "success"}))     // 200
Response::created(json!({"id": "abc"}))        // 201
Response::error(500, "something went wrong")   // error
```

## ModError

```rust
pub struct ModError {
    pub code: u16,
    pub message: String,
}

ModError::new(code, "message")
ModError::not_found("resource not found")     // 404
ModError::bad_request("missing param 'x'")    // 400
ModError::internal("unexpected failure")       // 500
```

Implements `thiserror::Error` — formats as `[{code}] {message}`.

## Route

```rust
pub struct Route {
    pub method: String,
    pub description: String,
    pub params: Vec<Param>,
}

Route::new("transform", "Transform input text")
    .with_params(vec![
        Param::required("input", "string").desc("Text to transform"),
        Param::optional("mode", "string").desc("upper | lower | reverse"),
    ])
```

## Param

```rust
pub struct Param {
    pub name: String,
    pub kind: String,       // "string", "u64", "f64", "bool", "object", etc.
    pub required: bool,
    pub description: String,
}

Param::required("input", "string")
Param::optional("limit", "u64").desc("Max results to return")
```

## ModInfo

Auto-generated from `ModApi::info()`:

```rust
pub struct ModInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub routes: Vec<Route>,
}
```

## WASM Helpers

For WASM-compiled mods:

```rust
/// Serialize Result<Response, ModError> to JSON string
pub fn response_to_json(result: Result<Response, ModError>) -> String;

/// Parse JSON string into Value (defaults to {} on failure)
pub fn parse_params(json: &str) -> Value;
```

## Complete Example

```rust
use mod_sdk::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Calculator {
    pub name: String,
    pub version: String,
}

impl Calculator {
    pub fn new() -> Self {
        Self { name: "calculator".into(), version: "0.1.0".into() }
    }

    pub fn add(&self, params: Value) -> Result<Response, ModError> {
        let a = params["a"].as_f64().ok_or(ModError::bad_request("missing 'a'"))?;
        let b = params["b"].as_f64().ok_or(ModError::bad_request("missing 'b'"))?;
        Ok(Response::ok(json!({"result": a + b})))
    }

    pub fn multiply(&self, params: Value) -> Result<Response, ModError> {
        let a = params["a"].as_f64().ok_or(ModError::bad_request("missing 'a'"))?;
        let b = params["b"].as_f64().ok_or(ModError::bad_request("missing 'b'"))?;
        Ok(Response::ok(json!({"result": a * b})))
    }
}

impl ModApi for Calculator {
    fn name(&self) -> &str { &self.name }
    fn version(&self) -> &str { &self.version }
    fn description(&self) -> &str { "basic math operations" }

    fn handle(&self, req: Request) -> Result<Response, ModError> {
        match req.method.as_str() {
            "add"      => self.add(req.params),
            "multiply" => self.multiply(req.params),
            "info"     => Ok(Response::ok(serde_json::to_value(self.info()).unwrap())),
            _ => Err(ModError::not_found(format!("'{}' not found", req.method))),
        }
    }

    fn routes(&self) -> Vec<Route> {
        vec![
            Route::new("add", "Add two numbers")
                .with_params(vec![
                    Param::required("a", "f64").desc("First number"),
                    Param::required("b", "f64").desc("Second number"),
                ]),
            Route::new("multiply", "Multiply two numbers")
                .with_params(vec![
                    Param::required("a", "f64").desc("First number"),
                    Param::required("b", "f64").desc("Second number"),
                ]),
        ]
    }
}
```

Call from CLI:
```bash
m call calculator/add --params '{"a": 5, "b": 3}'
# -> {"result": 8.0}
```

Serve as HTTP:
```bash
m serve calculator --port 8001
curl -X POST http://0.0.0.0:8001/multiply -d '{"params":{"a":4,"b":7}}'
# -> {"result": 28.0}
```
