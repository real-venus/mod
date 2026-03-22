//! Example mod — demonstrates the full ModApi pattern
//!
//! API routes: hello, echo, status, time, transform

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

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

    pub fn info(&self) -> Value {
        serde_json::json!({
            "name": self.name,
            "version": self.version,
            "description": "Example mod — demonstrates the full ModApi pattern",
            "routes": ["hello", "echo", "status", "time", "transform"]
        })
    }

    pub fn hello(&self, params: Value) -> Value {
        let name = params.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("world");
        serde_json::json!({
            "message": format!("hello, {}", name),
            "from": self.name
        })
    }

    pub fn echo(&self, params: Value) -> Value {
        serde_json::json!({
            "echo": params,
            "module": self.name
        })
    }

    pub fn status(&self) -> Value {
        serde_json::json!({
            "name": self.name,
            "version": self.version,
            "status": "running"
        })
    }

    pub fn time(&self) -> Value {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        serde_json::json!({
            "timestamp": now.as_secs(),
            "unix_ms": now.as_millis() as u64
        })
    }

    pub fn transform(&self, params: Value) -> Value {
        let input = params.get("input")
            .and_then(|v| v.as_str())
            .unwrap_or("");
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
            _         => format!("unknown mode: {}", mode),
        };
        serde_json::json!({
            "input": input,
            "mode": mode,
            "output": output
        })
    }

    pub fn forward(&self, params: Value) -> Value {
        serde_json::json!({
            "module": self.name,
            "params": params,
            "result": "forwarded"
        })
    }
}
