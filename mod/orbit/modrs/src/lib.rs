//! # ModRS - Rust Implementation of Mod Framework
//!
//! A complete modular development ecosystem in Rust, maintaining the ethos
//! and functionality of the Python mod framework while leveraging Rust's
//! safety guarantees and performance characteristics.
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use modrs::prelude::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<()> {
//!     let m = Mod::new().await?;
//!     let module = m.module("api").await?;
//!     let result = module.call("info", json!({})).await?;
//!     Ok(())
//! }
//! ```

pub mod config;
pub mod crypto;
pub mod error;
pub mod git;
pub mod module;
pub mod storage;
pub mod server;
pub mod utils;

#[cfg(feature = "ai")]
pub mod ai;

#[cfg(feature = "ipfs")]
pub mod ipfs;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::RwLock;
use serde_json::{json, Value};

pub use error::{ModError, Result};
pub use module::{Module, ModuleInfo};

/// Prelude module for convenient imports
pub mod prelude {
    pub use crate::{Mod, ModError, Result};
    pub use crate::module::{Module, ModuleInfo, ModuleRegistry};
    pub use crate::crypto::{KeyPair, Signature};
    pub use crate::storage::{Storage, StorageBackend};
    pub use serde_json::{json, Value};
}

/// Core Mod framework struct
///
/// This is the main entry point for the ModRS framework, providing
/// module management, cryptography, storage, and server operations.
#[derive(Clone)]
pub struct Mod {
    config: Arc<config::Config>,
    registry: Arc<module::ModuleRegistry>,
    storage: Arc<dyn storage::Storage>,
    key_manager: Arc<crypto::KeyManager>,
    server_manager: Arc<RwLock<server::ServerManager>>,
}

impl Mod {
    /// Create a new Mod instance with default configuration
    ///
    /// # Examples
    ///
    /// ```rust,no_run
    /// # use modrs::Mod;
    /// # #[tokio::main]
    /// # async fn main() -> modrs::Result<()> {
    /// let m = Mod::new().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn new() -> Result<Self> {
        Self::with_config(config::Config::load()?).await
    }

    /// Create a new Mod instance with custom configuration
    pub async fn with_config(config: config::Config) -> Result<Self> {
        let storage = storage::create_storage(&config).await?;
        let key_manager = crypto::KeyManager::new(&config)?;
        let registry = module::ModuleRegistry::new(&config).await?;
        let server_manager = server::ServerManager::new();

        Ok(Self {
            config: Arc::new(config),
            registry: Arc::new(registry),
            storage: Arc::new(storage),
            key_manager: Arc::new(key_manager),
            server_manager: Arc::new(RwLock::new(server_manager)),
        })
    }

    // ========================================================================
    // MODULE OPERATIONS
    // ========================================================================

    /// Load a module by name
    ///
    /// # Examples
    ///
    /// ```rust,no_run
    /// # use modrs::Mod;
    /// # #[tokio::main]
    /// # async fn main() -> modrs::Result<()> {
    /// let m = Mod::new().await?;
    /// let api = m.module("api").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn module(&self, name: &str) -> Result<Arc<dyn Module>> {
        self.registry.load(name).await
    }

    /// Get a function from a module and call it
    ///
    /// Format: "module/function"
    pub async fn call(&self, path: &str, params: Value) -> Result<Value> {
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() != 2 {
            return Err(ModError::InvalidPath(path.to_string()));
        }

        let module = self.module(parts[0]).await?;
        module.call(parts[1], params).await
    }

    /// List all available modules
    pub async fn mods(&self) -> Result<Vec<String>> {
        self.registry.list().await
    }

    /// Check if a module exists
    pub async fn mod_exists(&self, name: &str) -> bool {
        self.registry.exists(name).await
    }

    /// Get module information
    pub async fn info(&self, name: &str) -> Result<ModuleInfo> {
        let module = self.module(name).await?;
        module.info().await
    }

    /// Get module source code
    pub async fn code(&self, name: &str) -> Result<String> {
        let module = self.module(name).await?;
        module.code().await
    }

    /// Get module directory path
    pub async fn dirpath(&self, name: &str) -> Result<PathBuf> {
        self.registry.dirpath(name).await
    }

    // ========================================================================
    // CRYPTOGRAPHIC OPERATIONS
    // ========================================================================

    /// Get a key by name (or default key if None)
    pub async fn key(&self, name: Option<&str>) -> Result<Arc<crypto::KeyPair>> {
        self.key_manager.get(name).await
    }

    /// List all key names
    pub async fn keys(&self) -> Result<Vec<String>> {
        self.key_manager.list().await
    }

    /// Get the Ethereum address for a key
    pub async fn address(&self, key_name: Option<&str>) -> Result<String> {
        let key = self.key(key_name).await?;
        Ok(key.ethereum_address())
    }

    /// Sign data with a key
    pub async fn sign(&self, data: &Value, key_name: Option<&str>) -> Result<crypto::Signature> {
        let key = self.key(key_name).await?;
        key.sign(data)
    }

    /// Verify a signature
    pub async fn verify(&self, data: &Value, signature: &crypto::Signature, address: &str) -> Result<bool> {
        crypto::verify(data, signature, address)
    }

    /// Encrypt data with a key
    pub async fn encrypt(&self, data: &[u8], key_name: Option<&str>) -> Result<Vec<u8>> {
        let key = self.key(key_name).await?;
        key.encrypt(data)
    }

    /// Decrypt data with a key
    pub async fn decrypt(&self, data: &[u8], key_name: Option<&str>) -> Result<Vec<u8>> {
        let key = self.key(key_name).await?;
        key.decrypt(data)
    }

    // ========================================================================
    // STORAGE OPERATIONS
    // ========================================================================

    /// Store a value with optional encryption
    pub async fn put<T: serde::Serialize>(&self, key: &str, value: &T, encrypt: bool) -> Result<()> {
        if encrypt {
            let bytes = serde_json::to_vec(value)?;
            let encrypted = self.encrypt(&bytes, None).await?;
            self.storage.put_bytes(key, &encrypted).await
        } else {
            self.storage.put(key, value).await
        }
    }

    /// Retrieve a value with optional decryption
    pub async fn get<T: serde::de::DeserializeOwned>(&self, key: &str, decrypt: bool) -> Result<Option<T>> {
        if decrypt {
            let encrypted = self.storage.get_bytes(key).await?;
            match encrypted {
                Some(bytes) => {
                    let decrypted = self.decrypt(&bytes, None).await?;
                    Ok(Some(serde_json::from_slice(&decrypted)?))
                }
                None => Ok(None),
            }
        } else {
            self.storage.get(key).await
        }
    }

    /// Delete a key from storage
    pub async fn delete(&self, key: &str) -> Result<()> {
        self.storage.delete(key).await
    }

    // ========================================================================
    // SERVER OPERATIONS
    // ========================================================================

    /// Start a module server
    ///
    /// # Examples
    ///
    /// ```rust,no_run
    /// # use modrs::Mod;
    /// # #[tokio::main]
    /// # async fn main() -> modrs::Result<()> {
    /// let m = Mod::new().await?;
    /// m.serve("api", 8000).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn serve(&self, module_name: &str, port: u16) -> Result<()> {
        let module = self.module(module_name).await?;
        let mut manager = self.server_manager.write();
        manager.start(module_name, module, port).await
    }

    /// Stop a running server
    pub async fn kill(&self, module_name: &str) -> Result<()> {
        let mut manager = self.server_manager.write();
        manager.stop(module_name).await
    }

    /// Check if a server is running
    pub async fn server_exists(&self, module_name: &str) -> bool {
        let manager = self.server_manager.read();
        manager.is_running(module_name)
    }

    /// List all running servers
    pub async fn servers(&self) -> Vec<server::ServerInfo> {
        let manager = self.server_manager.read();
        manager.list()
    }

    // ========================================================================
    // GIT OPERATIONS
    // ========================================================================

    /// Commit and push changes
    pub async fn push(&self, message: &str) -> Result<()> {
        git::push(message, &self.config.paths.lib).await
    }

    /// Clone a repository
    pub async fn clone(&self, url: &str, dest: impl AsRef<Path>) -> Result<()> {
        git::clone(url, dest).await
    }

    /// List Git repositories in home directory
    pub async fn repos(&self) -> Result<Vec<String>> {
        git::list_repos(&self.config.paths.home).await
    }

    // ========================================================================
    // AI OPERATIONS (optional feature)
    // ========================================================================

    #[cfg(feature = "ai")]
    /// Ask AI a question
    pub async fn ask(&self, prompt: &str) -> Result<String> {
        let client = ai::OpenRouterClient::new(&self.config)?;
        client.ask(prompt).await
    }

    // ========================================================================
    // IPFS OPERATIONS (optional feature)
    // ========================================================================

    #[cfg(feature = "ipfs")]
    /// Put content on IPFS
    pub async fn ipfs_put(&self, data: &[u8]) -> Result<String> {
        let client = ipfs::Client::new(&self.config)?;
        client.put(data).await
    }

    #[cfg(feature = "ipfs")]
    /// Get content from IPFS
    pub async fn ipfs_get(&self, cid: &str) -> Result<Vec<u8>> {
        let client = ipfs::Client::new(&self.config)?;
        client.get(cid).await
    }

    // ========================================================================
    // UTILITY OPERATIONS
    // ========================================================================

    /// Get current timestamp
    pub fn time(&self) -> u64 {
        chrono::Utc::now().timestamp() as u64
    }

    /// Get configuration
    pub fn config(&self) -> &config::Config {
        &self.config
    }

    /// Print colored output
    pub fn print(&self, text: &str, color: Option<&str>) {
        utils::print_colored(text, color);
    }

    /// Hash data
    pub fn hash(&self, data: &[u8], mode: &str) -> Result<String> {
        utils::hash(data, mode)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mod_creation() {
        let m = Mod::new().await;
        assert!(m.is_ok());
    }

    #[tokio::test]
    async fn test_storage() {
        let m = Mod::new().await.unwrap();
        let test_data = json!({"test": "data"});

        m.put("test_key", &test_data, false).await.unwrap();
        let retrieved: Option<Value> = m.get("test_key", false).await.unwrap();

        assert_eq!(retrieved, Some(test_data));
    }
}
