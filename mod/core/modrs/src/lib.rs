//! # ModRS - Rust Implementation of Mod Framework
//!
//! Each module is a folder with a `mod.rs` containing one struct.
//! Create, load, list, and remove modules through the CLI or API.

pub mod cli;
pub mod config;
pub mod key;
pub mod error;
pub mod git;
pub mod module;
pub mod store;
pub mod server;
pub mod utils;

#[cfg(feature = "ai")]
pub mod ai;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::RwLock;
use serde_json::Value;

pub use error::{ModError, Result};
pub use module::{Module, ModuleInfo};

pub mod prelude {
    pub use crate::{Mod, ModError, Result};
    pub use crate::module::{Module, ModuleInfo, ModuleRegistry};
    pub use crate::key::{KeyPair, KeyType, Signature};
    pub use crate::store::{Store, SqliteStore, IpfsStore};
    pub use serde_json::{json, Value};
}

#[derive(Clone)]
pub struct Mod {
    config: Arc<config::Config>,
    registry: Arc<module::ModuleRegistry>,
    store: Arc<store::Store>,
    key_manager: Arc<key::KeyManager>,
    server_manager: Arc<RwLock<server::ServerManager>>,
}

impl Mod {
    pub async fn new() -> Result<Self> {
        Self::with_config(config::Config::load()?).await
    }

    pub async fn with_config(config: config::Config) -> Result<Self> {
        let store = store::create_store(&config)?;
        let key_manager = key::KeyManager::new(&config)?;
        let registry = module::ModuleRegistry::new(&config).await?;
        let server_manager = server::ServerManager::new();

        Ok(Self {
            config: Arc::new(config),
            registry: Arc::new(registry),
            store: Arc::new(store),
            key_manager: Arc::new(key_manager),
            server_manager: Arc::new(RwLock::new(server_manager)),
        })
    }

    // ========================================================================
    // MODULE OPERATIONS
    // ========================================================================

    pub async fn module(&self, name: &str) -> Result<Arc<dyn Module>> {
        self.registry.load(name).await
    }

    pub async fn call(&self, path: &str, params: Value) -> Result<Value> {
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() != 2 {
            return Err(ModError::InvalidPath(path.to_string()));
        }
        let module = self.module(parts[0]).await?;
        module.call(parts[1], params).await
    }

    pub async fn mods(&self) -> Result<Vec<String>> {
        self.registry.list().await
    }

    pub async fn mod_exists(&self, name: &str) -> bool {
        self.registry.exists(name).await
    }

    pub async fn info(&self, name: &str) -> Result<ModuleInfo> {
        let module = self.module(name).await?;
        module.info().await
    }

    pub async fn code(&self, name: &str) -> Result<String> {
        let module = self.module(name).await?;
        module.code().await
    }

    pub async fn dirpath(&self, name: &str) -> Result<PathBuf> {
        self.registry.dirpath(name).await
    }

    /// Create a new module — makes folder + scaffolds mod.rs with one struct
    pub fn create_mod(&self, name: &str, description: Option<&str>) -> Result<PathBuf> {
        self.registry.create(name, description)
    }

    /// Remove a module — deletes the folder entirely
    pub fn remove_mod(&self, name: &str) -> Result<()> {
        self.registry.remove(name)
    }

    // ========================================================================
    // CRYPTOGRAPHIC OPERATIONS
    // ========================================================================

    pub async fn key(&self, name: Option<&str>) -> Result<Arc<key::KeyPair>> {
        self.key_manager.get(name).await
    }

    pub async fn keys(&self) -> Result<Vec<String>> {
        self.key_manager.list().await
    }

    pub async fn address(&self, key_name: Option<&str>) -> Result<String> {
        let key = self.key(key_name).await?;
        Ok(key.ethereum_address())
    }

    pub async fn sign(&self, data: &Value, key_name: Option<&str>) -> Result<key::Signature> {
        let key = self.key(key_name).await?;
        key.sign(data)
    }

    pub async fn verify(&self, data: &Value, signature: &key::Signature, address: &str) -> Result<bool> {
        key::verify(data, signature, address)
    }

    pub async fn encrypt(&self, data: &[u8], key_name: Option<&str>) -> Result<Vec<u8>> {
        let key = self.key(key_name).await?;
        key.encrypt(data)
    }

    pub async fn decrypt(&self, data: &[u8], key_name: Option<&str>) -> Result<Vec<u8>> {
        let key = self.key(key_name).await?;
        key.decrypt(data)
    }

    // ========================================================================
    // STORE OPERATIONS — local KV (SQLite)
    // ========================================================================

    pub fn put(&self, key: &str, value: &Value, encrypt: bool) -> Result<()> {
        if encrypt {
            let bytes = serde_json::to_vec(value)?;
            self.store.kv.put_bytes(key, &bytes)
        } else {
            self.store.kv.put(key, value)
        }
    }

    pub fn get(&self, key: &str, _decrypt: bool) -> Result<Option<Value>> {
        self.store.kv.get(key)
    }

    pub fn delete(&self, key: &str) -> Result<()> {
        self.store.kv.delete(key)
    }

    // ========================================================================
    // STORE OPERATIONS — IPFS (distributed)
    // ========================================================================

    /// Add content to IPFS, returns CID
    pub async fn ipfs_add(&self, data: &[u8]) -> Result<String> {
        self.store.ipfs.add(data).await
    }

    /// Retrieve content from IPFS by CID
    pub async fn ipfs_cat(&self, cid: &str) -> Result<Vec<u8>> {
        self.store.ipfs.cat(cid).await
    }

    /// Pin content on IPFS
    pub async fn ipfs_pin(&self, cid: &str) -> Result<()> {
        self.store.ipfs.pin(cid).await
    }

    /// Unpin content on IPFS
    pub async fn ipfs_unpin(&self, cid: &str) -> Result<()> {
        self.store.ipfs.unpin(cid).await
    }

    /// List all pinned CIDs
    pub async fn ipfs_pins(&self) -> Result<Vec<String>> {
        self.store.ipfs.pins().await
    }

    /// Get IPFS object stats
    pub async fn ipfs_stat(&self, cid: &str) -> Result<store::ipfs::StatResponse> {
        self.store.ipfs.stat(cid).await
    }

    /// Check if IPFS daemon is reachable
    pub async fn ipfs_online(&self) -> bool {
        self.store.ipfs.is_online().await
    }

    /// Get gateway URL for a CID
    pub fn ipfs_url(&self, cid: &str) -> String {
        self.store.ipfs.url(cid)
    }

    /// Access the full store (kv + ipfs)
    pub fn store(&self) -> &store::Store {
        &self.store
    }

    // ========================================================================
    // SERVER OPERATIONS
    // ========================================================================

    pub async fn serve(&self, module_name: &str, port: u16) -> Result<()> {
        let module = self.module(module_name).await?;
        let mut manager = self.server_manager.write();
        manager.start(module_name, module, port).await
    }

    pub async fn kill(&self, module_name: &str) -> Result<()> {
        let mut manager = self.server_manager.write();
        manager.stop(module_name).await
    }

    pub async fn server_exists(&self, module_name: &str) -> bool {
        let manager = self.server_manager.read();
        manager.is_running(module_name)
    }

    pub async fn servers(&self) -> Vec<server::ServerInfo> {
        let manager = self.server_manager.read();
        manager.list()
    }

    // ========================================================================
    // GIT OPERATIONS
    // ========================================================================

    pub async fn push(&self, message: &str) -> Result<()> {
        git::push(message, &self.config.paths.lib).await
    }

    pub async fn clone(&self, url: &str, dest: impl AsRef<Path>) -> Result<()> {
        git::clone(url, dest).await
    }

    pub async fn repos(&self) -> Result<Vec<String>> {
        git::list_repos(&self.config.paths.home).await
    }

    // ========================================================================
    // AI OPERATIONS (optional feature)
    // ========================================================================

    #[cfg(feature = "ai")]
    pub async fn ask(&self, prompt: &str) -> Result<String> {
        let client = ai::OpenRouterClient::new(&self.config)?;
        client.ask(prompt).await
    }

    // ========================================================================
    // UTILITY OPERATIONS
    // ========================================================================

    pub fn time(&self) -> u64 {
        chrono::Utc::now().timestamp() as u64
    }

    pub fn config(&self) -> &config::Config {
        &self.config
    }

    pub fn print(&self, text: &str, color: Option<&str>) {
        utils::print_colored(text, color);
    }

    pub fn hash(&self, data: &[u8], mode: &str) -> Result<String> {
        utils::hash(data, mode)
    }
}
