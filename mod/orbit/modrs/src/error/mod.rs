//! Error types for ModRS

use std::path::PathBuf;

pub type Result<T> = std::result::Result<T, ModError>;

#[derive(Debug, thiserror::Error)]
pub enum ModError {
    // Module errors
    #[error("Module not found: {0}")]
    ModuleNotFound(String),

    #[error("Function not found: {0}")]
    FunctionNotFound(String),

    #[error("Invalid module path: {0}")]
    InvalidPath(String),

    #[error("Module load error: {0}")]
    ModuleLoadError(String),

    // Store errors
    #[error("Storage error: {0}")]
    Storage(String),

    #[error("IPFS error: {0}")]
    Ipfs(String),

    #[error("Key not found: {0}")]
    KeyNotFound(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    // Crypto errors
    #[error("Cryptographic error: {0}")]
    Crypto(String),

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Key generation failed: {0}")]
    KeyGeneration(String),

    // Server errors
    #[error("Server error: {0}")]
    Server(String),

    #[error("Server already running: {0}")]
    ServerAlreadyRunning(String),

    #[error("Server not running: {0}")]
    ServerNotRunning(String),

    // Git errors
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),

    // IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Path error: {0:?}")]
    PathError(PathBuf),

    // Network errors
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    // Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),

    // Other errors
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<String> for ModError {
    fn from(s: String) -> Self {
        ModError::Unknown(s)
    }
}

impl From<&str> for ModError {
    fn from(s: &str) -> Self {
        ModError::Unknown(s.to_string())
    }
}
