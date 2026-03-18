//! Full mod implementation — shows the complete pattern for building a mod
//! with ModApi trait, routes, params, error handling, and WASM support
//!
//! This file is a standalone reference. Copy it to build your own mod.

use mod_sdk::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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

    // ========================================================================
    // 2. Define your API handlers — each one takes params, returns Response
    // ========================================================================

    pub fn get(&self, _params: Value) -> Result<Response, ModError> {
        Ok(Response::ok(json!({
            "count": self.count
        })))
    }

    pub fn increment(&mut self, params: Value) -> Result<Response, ModError> {
        let amount = params.get("amount")
            .and_then(|v| v.as_u64())
            .unwrap_or(1);

        self.count += amount;

        Ok(Response::ok(json!({
            "count": self.count,
            "added": amount
        })))
    }

    pub fn decrement(&mut self, params: Value) -> Result<Response, ModError> {
        let amount = params.get("amount")
            .and_then(|v| v.as_u64())
            .unwrap_or(1);

        if amount > self.count {
            return Err(ModError::bad_request("cannot go below zero"));
        }

        self.count -= amount;

        Ok(Response::ok(json!({
            "count": self.count,
            "removed": amount
        })))
    }

    pub fn reset(&mut self, _params: Value) -> Result<Response, ModError> {
        let was = self.count;
        self.count = 0;

        Ok(Response::ok(json!({
            "count": 0,
            "was": was
        })))
    }
}

// ============================================================================
// 3. Implement ModApi — wire up handle() and define routes()
// ============================================================================

impl ModApi for Counter {
    fn name(&self) -> &str { &self.name }
    fn version(&self) -> &str { &self.version }
    fn description(&self) -> &str { "Simple counter mod with get/increment/decrement/reset" }

    fn handle(&self, req: Request) -> Result<Response, ModError> {
        // NOTE: for mutable operations in production, use interior mutability
        // (Arc<Mutex<T>> or similar). This example keeps it simple.
        match req.method.as_str() {
            "get"       => self.get(req.params),
            "increment" => {
                // clone + mutate pattern for demo
                let mut copy = self.clone();
                copy.increment(req.params)
            }
            "decrement" => {
                let mut copy = self.clone();
                copy.decrement(req.params)
            }
            "reset"     => {
                let mut copy = self.clone();
                copy.reset(req.params)
            }
            "info"      => Ok(Response::ok(serde_json::to_value(self.info()).unwrap())),
            _ => Err(ModError::not_found(format!("method '{}' not found", req.method))),
        }
    }

    fn routes(&self) -> Vec<Route> {
        vec![
            Route::new("get", "Get current count"),
            Route::new("increment", "Increase count")
                .with_params(vec![
                    Param::optional("amount", "u64").desc("Amount to add (default 1)"),
                ]),
            Route::new("decrement", "Decrease count")
                .with_params(vec![
                    Param::optional("amount", "u64").desc("Amount to subtract (default 1)"),
                ]),
            Route::new("reset", "Reset count to zero"),
        ]
    }
}

// ============================================================================
// 4. Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter_flow() {
        let m = Counter::new();
        let info = m.info();
        assert_eq!(info.name, "counter");
        assert_eq!(info.routes.len(), 4);
    }
}

fn main() {
    let c = Counter::new();
    let info = c.info();
    println!("{}", serde_json::to_string_pretty(&info).unwrap());

    println!("\nThis is a reference implementation.");
    println!("Copy the pattern to mods/yourmod/src/lib.rs and implement ModApi.");
}
