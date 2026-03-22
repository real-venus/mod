//! mod_sdk — shared interface for building mods
//!
//! Every mod implements `ModApi` to expose functions as a callable API.
//! Mods can be compiled to native or WASM targets.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ============================================================================
// ERRORS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[error("[{code}] {message}")]
pub struct ModError {
    pub code: u16,
    pub message: String,
}

impl ModError {
    pub fn new(code: u16, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::new(404, msg)
    }

    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::new(400, msg)
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::new(500, msg)
    }
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    pub method: String,
    pub params: Value,
    #[serde(default)]
    pub headers: HashMap<String, String>,
}

impl Request {
    pub fn new(method: &str, params: Value) -> Self {
        Self {
            method: method.to_string(),
            params,
            headers: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub status: u16,
    pub data: Value,
    #[serde(default)]
    pub headers: HashMap<String, String>,
}

impl Response {
    pub fn ok(data: Value) -> Self {
        Self { status: 200, data, headers: HashMap::new() }
    }

    pub fn created(data: Value) -> Self {
        Self { status: 201, data, headers: HashMap::new() }
    }

    pub fn error(code: u16, message: &str) -> Self {
        Self {
            status: code,
            data: serde_json::json!({ "error": message }),
            headers: HashMap::new(),
        }
    }
}

// ============================================================================
// ROUTE / PARAM DEFINITIONS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub method: String,
    pub description: String,
    #[serde(default)]
    pub params: Vec<Param>,
}

impl Route {
    pub fn new(method: &str, description: &str) -> Self {
        Self {
            method: method.to_string(),
            description: description.to_string(),
            params: vec![],
        }
    }

    pub fn with_params(mut self, params: Vec<Param>) -> Self {
        self.params = params;
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Param {
    pub name: String,
    pub kind: String,
    pub required: bool,
    #[serde(default)]
    pub description: String,
}

impl Param {
    pub fn required(name: &str, kind: &str) -> Self {
        Self { name: name.into(), kind: kind.into(), required: true, description: String::new() }
    }

    pub fn optional(name: &str, kind: &str) -> Self {
        Self { name: name.into(), kind: kind.into(), required: false, description: String::new() }
    }

    pub fn desc(mut self, description: &str) -> Self {
        self.description = description.to_string();
        self
    }
}

// ============================================================================
// MOD INFO
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub routes: Vec<Route>,
}

// ============================================================================
// MOD API TRAIT — every mod implements this
// ============================================================================

pub trait ModApi: Send + Sync {
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn description(&self) -> &str;

    /// Handle an incoming request — dispatch to the right method
    fn handle(&self, req: Request) -> Result<Response, ModError>;

    /// List all available routes
    fn routes(&self) -> Vec<Route>;

    /// Module info (auto-derived)
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
// WASM HELPERS
// ============================================================================

/// Serialize a response to JSON string (used by WASM exports)
pub fn response_to_json(result: Result<Response, ModError>) -> String {
    match result {
        Ok(resp) => serde_json::to_string(&resp).unwrap_or_default(),
        Err(e) => serde_json::to_string(&Response::error(e.code, &e.message)).unwrap_or_default(),
    }
}

/// Parse a JSON string into params (used by WASM exports)
pub fn parse_params(json: &str) -> Value {
    serde_json::from_str(json).unwrap_or(serde_json::json!({}))
}
