//! Full mod implementation — shows the complete pattern for building a mod
//! with custom routes, params, error handling.
//!
//! This file is a standalone reference. Copy it to build your own mod.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ============================================================================
// Minimal SDK types (inline for standalone example)
// ============================================================================

pub struct Request {
    pub method: String,
    pub params: Value,
}

pub struct Response {
    pub status: u16,
    pub data: Value,
}

impl Response {
    pub fn ok(data: Value) -> Self {
        Self { status: 200, data }
    }
}

#[derive(Debug)]
pub struct ModError {
    pub code: u16,
    pub message: String,
}

impl ModError {
    pub fn bad_request(msg: &str) -> Self { Self { code: 400, message: msg.to_string() } }
    pub fn not_found(msg: String) -> Self { Self { code: 404, message: msg } }
}

pub struct Param {
    pub name: String,
    pub kind: String,
    pub required: bool,
    pub description: String,
}

impl Param {
    pub fn optional(name: &str, kind: &str) -> Self {
        Self { name: name.to_string(), kind: kind.to_string(), required: false, description: String::new() }
    }
    pub fn desc(mut self, d: &str) -> Self { self.description = d.to_string(); self }
}

pub struct Route {
    pub method: String,
    pub description: String,
    pub params: Vec<Param>,
}

impl Route {
    pub fn new(method: &str, desc: &str) -> Self {
        Self { method: method.to_string(), description: desc.to_string(), params: vec![] }
    }
    pub fn with_params(mut self, params: Vec<Param>) -> Self { self.params = params; self }
}

pub struct ModInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub routes: Vec<Route>,
}

pub trait ModApi {
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn description(&self) -> &str;
    fn handle(&self, req: Request) -> Result<Response, ModError>;
    fn routes(&self) -> Vec<Route>;
    fn info(&self) -> ModInfo {
        ModInfo {
            name: self.name().to_string(),
            version: self.version().to_string(),
            description: self.description().to_string(),
            routes: self.routes(),
        }
    }
}

// ============================================================================
// 1. Define your struct
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Counter {
    pub name: String,
    pub version: String,
    count: u64,
}

impl Counter {
    pub fn new() -> Self {
        Self {
            name: "counter".to_string(),
            version: "0.1.0".to_string(),
            count: 0,
        }
    }

    pub fn get(&self, _params: Value) -> Result<Response, ModError> {
        Ok(Response::ok(json!({ "count": self.count })))
    }

    pub fn increment(&mut self, params: Value) -> Result<Response, ModError> {
        let amount = params.get("amount").and_then(|v| v.as_u64()).unwrap_or(1);
        self.count += amount;
        Ok(Response::ok(json!({ "count": self.count, "added": amount })))
    }

    pub fn decrement(&mut self, params: Value) -> Result<Response, ModError> {
        let amount = params.get("amount").and_then(|v| v.as_u64()).unwrap_or(1);
        if amount > self.count {
            return Err(ModError::bad_request("cannot go below zero"));
        }
        self.count -= amount;
        Ok(Response::ok(json!({ "count": self.count, "removed": amount })))
    }

    pub fn reset(&mut self, _params: Value) -> Result<Response, ModError> {
        let was = self.count;
        self.count = 0;
        Ok(Response::ok(json!({ "count": 0, "was": was })))
    }
}

impl ModApi for Counter {
    fn name(&self) -> &str { &self.name }
    fn version(&self) -> &str { &self.version }
    fn description(&self) -> &str { "Simple counter mod with get/increment/decrement/reset" }

    fn handle(&self, req: Request) -> Result<Response, ModError> {
        match req.method.as_str() {
            "get"       => self.get(req.params),
            "increment" => { let mut c = self.clone(); c.increment(req.params) }
            "decrement" => { let mut c = self.clone(); c.decrement(req.params) }
            "reset"     => { let mut c = self.clone(); c.reset(req.params) }
            _ => Err(ModError::not_found(format!("method '{}' not found", req.method))),
        }
    }

    fn routes(&self) -> Vec<Route> {
        vec![
            Route::new("get", "Get current count"),
            Route::new("increment", "Increase count")
                .with_params(vec![Param::optional("amount", "u64").desc("Amount to add (default 1)")]),
            Route::new("decrement", "Decrease count")
                .with_params(vec![Param::optional("amount", "u64").desc("Amount to subtract (default 1)")]),
            Route::new("reset", "Reset count to zero"),
        ]
    }
}

fn main() {
    let c = Counter::new();
    let info = c.info();
    println!("Module: {} v{}", info.name, info.version);
    println!("Description: {}", info.description);
    println!("Routes:");
    for route in &info.routes {
        println!("  {} — {}", route.method, route.description);
    }
}
