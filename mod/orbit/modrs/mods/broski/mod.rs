//! A mod module

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Broski {
    pub name: String,
    pub version: String,
}

impl Broski {
    pub fn new() -> Self {
        Self {
            name: "broski".to_string(),
            version: "0.1.0".to_string(),
        }
    }

    pub fn info(&self) -> Value {
        serde_json::json!({
            "name": self.name,
            "version": self.version,
        })
    }

    pub fn forward(&self, params: Value) -> Value {
        serde_json::json!({
            "module": self.name,
            "bro": params,
            "result": "forwarded"
        })
    }
}
