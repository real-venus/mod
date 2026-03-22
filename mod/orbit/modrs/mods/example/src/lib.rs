//! Example mod — demonstrates the full ModApi pattern
//!
//! Build native:  cargo build --release
//! Build WASM:    cargo build --target wasm32-unknown-unknown --release
//!
//! API routes:
//!   hello     — greet by name
//!   echo      — echo back params
//!   status    — mod status
//!   time      — current timestamp
//!   transform — transform input data (upper, lower, reverse, base64)

use mod_sdk::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ============================================================================
// MOD STRUCT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Example {
    pub name: String,
    pub version: String,
}

impl Example {
    pub fn new() -> Self {
        Self {
            name: "example".to_string(),
            version: "0.1.0".to_string(),
        }
    }

    // ========================================================================
    // API HANDLERS
    // ========================================================================

    pub fn hello(&self, params: Value) -> Result<Response, ModError> {
        let name = params.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("world");

        Ok(Response::ok(json!({
            "message": format!("hello, {}", name),
            "from": self.name
        })))
    }

    pub fn echo(&self, params: Value) -> Result<Response, ModError> {
        Ok(Response::ok(json!({
            "echo": params,
            "module": self.name
        })))
    }

    pub fn status(&self, _params: Value) -> Result<Response, ModError> {
        Ok(Response::ok(json!({
            "name": self.name,
            "version": self.version,
            "status": "running"
        })))
    }

    pub fn time(&self, _params: Value) -> Result<Response, ModError> {
        let now = chrono::Utc::now();
        Ok(Response::ok(json!({
            "timestamp": now.timestamp(),
            "iso": now.to_rfc3339(),
            "unix_ms": now.timestamp_millis()
        })))
    }

    pub fn transform(&self, params: Value) -> Result<Response, ModError> {
        let input = params.get("input")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ModError::bad_request("missing 'input' string"))?;

        let mode = params.get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("upper");

        let output = match mode {
            "upper"   => input.to_uppercase(),
            "lower"   => input.to_lowercase(),
            "reverse" => input.chars().rev().collect(),
            "len"     => input.len().to_string(),
            "words"   => input.split_whitespace().count().to_string(),
            "trim"    => input.trim().to_string(),
            _ => return Err(ModError::bad_request(
                format!("unknown mode '{}' — use upper, lower, reverse, len, words, trim", mode)
            )),
        };

        Ok(Response::ok(json!({
            "input": input,
            "mode": mode,
            "output": output
        })))
    }
}

// ============================================================================
// MOD API IMPLEMENTATION
// ============================================================================

impl ModApi for Example {
    fn name(&self) -> &str { &self.name }
    fn version(&self) -> &str { &self.version }
    fn description(&self) -> &str { "Example mod — demonstrates the full ModApi pattern" }

    fn handle(&self, req: Request) -> Result<Response, ModError> {
        match req.method.as_str() {
            "hello"     => self.hello(req.params),
            "echo"      => self.echo(req.params),
            "status"    => self.status(req.params),
            "time"      => self.time(req.params),
            "transform" => self.transform(req.params),
            "info"      => Ok(Response::ok(serde_json::to_value(self.info()).unwrap())),
            "routes"    => Ok(Response::ok(serde_json::to_value(self.routes()).unwrap())),
            _ => Err(ModError::not_found(format!("method '{}' not found", req.method))),
        }
    }

    fn routes(&self) -> Vec<Route> {
        vec![
            Route::new("hello", "Say hello")
                .with_params(vec![
                    Param::optional("name", "string").desc("Name to greet"),
                ]),
            Route::new("echo", "Echo back params"),
            Route::new("status", "Get mod status"),
            Route::new("time", "Get current timestamp"),
            Route::new("transform", "Transform input data")
                .with_params(vec![
                    Param::required("input", "string").desc("Input string"),
                    Param::optional("mode", "string").desc("upper | lower | reverse | len | words | trim"),
                ]),
        ]
    }
}

// ============================================================================
// WASM EXPORTS — compiled only for wasm32 targets
// ============================================================================

#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;
    use std::sync::Mutex;

    static MOD_INSTANCE: std::sync::LazyLock<Mutex<Example>> =
        std::sync::LazyLock::new(|| Mutex::new(Example::new()));

    #[wasm_bindgen]
    pub fn handle(method: &str, params_json: &str) -> String {
        let params = parse_params(params_json);
        let req = Request::new(method, params);
        let instance = MOD_INSTANCE.lock().unwrap();
        response_to_json(instance.handle(req))
    }

    #[wasm_bindgen]
    pub fn info() -> String {
        let instance = MOD_INSTANCE.lock().unwrap();
        serde_json::to_string(&instance.info()).unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn routes() -> String {
        let instance = MOD_INSTANCE.lock().unwrap();
        serde_json::to_string(&instance.routes()).unwrap_or_default()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        let m = Example::new();
        let req = Request::new("hello", json!({"name": "mod"}));
        let resp = m.handle(req).unwrap();
        assert_eq!(resp.status, 200);
        assert_eq!(resp.data["message"], "hello, mod");
    }

    #[test]
    fn test_echo() {
        let m = Example::new();
        let req = Request::new("echo", json!({"foo": "bar"}));
        let resp = m.handle(req).unwrap();
        assert_eq!(resp.status, 200);
        assert_eq!(resp.data["echo"]["foo"], "bar");
    }

    #[test]
    fn test_transform() {
        let m = Example::new();
        let req = Request::new("transform", json!({"input": "hello", "mode": "upper"}));
        let resp = m.handle(req).unwrap();
        assert_eq!(resp.data["output"], "HELLO");
    }

    #[test]
    fn test_transform_reverse() {
        let m = Example::new();
        let req = Request::new("transform", json!({"input": "hello", "mode": "reverse"}));
        let resp = m.handle(req).unwrap();
        assert_eq!(resp.data["output"], "olleh");
    }

    #[test]
    fn test_unknown_method() {
        let m = Example::new();
        let req = Request::new("nonexistent", json!({}));
        let err = m.handle(req).unwrap_err();
        assert_eq!(err.code, 404);
    }

    #[test]
    fn test_info() {
        let m = Example::new();
        let info = m.info();
        assert_eq!(info.name, "example");
        assert!(!info.routes.is_empty());
    }

    #[test]
    fn test_routes() {
        let m = Example::new();
        let routes = m.routes();
        let methods: Vec<&str> = routes.iter().map(|r| r.method.as_str()).collect();
        assert!(methods.contains(&"hello"));
        assert!(methods.contains(&"transform"));
    }
}
