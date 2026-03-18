//! # ModRS - Rust Implementation of Mod Framework
//!
//! Mirrors Python mod.py: module discovery via orbit tree, anchor file resolution,
//! content introspection, crypto, storage, servers, git, and AI.

pub mod cli;
pub mod config;
pub mod key;
pub mod error;
pub mod git;
pub mod module;
pub mod store;
pub mod server;
pub mod tree;
pub mod utils;

#[cfg(feature = "ai")]
pub mod ai;

use std::collections::HashMap;
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
    pub use crate::tree::ModuleTree;
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

    /// Load a module by name
    pub async fn module(&self, name: &str) -> Result<Arc<dyn Module>> {
        self.registry.load(name).await
    }

    /// Call a module function: "module/fn" with params
    pub async fn call(&self, path: &str, params: Value) -> Result<Value> {
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() != 2 {
            return Err(ModError::InvalidPath(path.to_string()));
        }
        let module = self.module(parts[0]).await?;
        module.call(parts[1], params).await
    }

    /// Forward a function call by name (Python forward)
    pub async fn forward(&self, fn_name: &str, params: Value) -> Result<Value> {
        if fn_name.contains('/') {
            self.call(fn_name, params).await
        } else {
            // Try calling on self (dispatch to known methods)
            self.dispatch_builtin(fn_name, params).await
        }
    }

    /// Dispatch built-in methods by name
    async fn dispatch_builtin(&self, fn_name: &str, params: Value) -> Result<Value> {
        match fn_name {
            "info" => {
                let name = params.get("mod").and_then(|v| v.as_str()).unwrap_or("mod");
                let info = self.info(name).await?;
                Ok(serde_json::to_value(info)?)
            }
            "mods" => {
                let search = params.get("search").and_then(|v| v.as_str());
                let mods = self.mods(search).await?;
                Ok(serde_json::to_value(mods)?)
            }
            "tree" => {
                let search = params.get("search").and_then(|v| v.as_str());
                let tree = self.tree(search);
                let map: HashMap<String, String> = tree.into_iter()
                    .map(|(k, v)| (k, v.to_string_lossy().to_string()))
                    .collect();
                Ok(serde_json::to_value(map)?)
            }
            "env" => {
                let key = params.get("key").and_then(|v| v.as_str());
                Ok(utils::env(key))
            }
            "time" => {
                let mode = params.get("mode").and_then(|v| v.as_str()).unwrap_or("float");
                Ok(utils::time(mode))
            }
            "owner" => {
                let addr = self.owner().await?;
                Ok(Value::String(addr))
            }
            _ => Err(ModError::FunctionNotFound(fn_name.to_string())),
        }
    }

    /// List all modules (Python mods)
    pub async fn mods(&self, search: Option<&str>) -> Result<Vec<String>> {
        match search {
            Some(s) => Ok(self.registry.tree().mods(Some(s))),
            None => self.registry.list().await,
        }
    }

    /// Check if module exists
    pub async fn mod_exists(&self, name: &str) -> bool {
        self.registry.exists(name).await
    }

    /// Get module info (Python info)
    pub async fn info(&self, name: &str) -> Result<ModuleInfo> {
        let module = self.module(name).await?;
        module.info().await
    }

    /// Get module source code (Python code)
    pub async fn code(&self, name: &str) -> Result<String> {
        let module = self.module(name).await?;
        module.code().await
    }

    /// Get module directory path (Python dirpath / dp)
    pub async fn dirpath(&self, name: &str) -> Result<PathBuf> {
        self.registry.dirpath(name).await
    }

    /// Get module functions list (Python fns)
    pub async fn fns(&self, name: &str) -> Result<Vec<String>> {
        let module = self.module(name).await?;
        module.functions().await
    }

    /// Create a new module (Python new / create)
    pub fn create_mod(&self, name: &str, description: Option<&str>) -> Result<PathBuf> {
        self.registry.create(name, description)
    }

    /// Remove a module (Python rmmod)
    pub fn remove_mod(&self, name: &str) -> Result<()> {
        self.registry.remove(name)
    }

    // ========================================================================
    // TREE / SEARCH OPERATIONS
    // ========================================================================

    /// Get the full module tree (Python tree)
    pub fn tree(&self, search: Option<&str>) -> HashMap<String, PathBuf> {
        self.registry.tree().tree(search, None, None)
    }

    /// Search for modules (Python search)
    pub fn search(&self, query: &str) -> HashMap<String, PathBuf> {
        self.registry.tree().search(query, None, 6, None)
    }

    /// Normalize a module name (Python get_name)
    pub fn get_name(&self, name: &str) -> String {
        self.registry.tree().get_name(name)
    }

    /// Update/refresh the tree cache (Python update)
    pub fn update(&self) -> Value {
        let tree = self.registry.tree().update();
        serde_json::json!({
            "success": true,
            "message": "Mod tree updated",
            "mods": tree.len()
        })
    }

    // ========================================================================
    // CONTENT / INTROSPECTION OPERATIONS
    // ========================================================================

    /// Get module content as path→text map (Python content)
    pub async fn content(&self, name: &str) -> Result<HashMap<String, String>> {
        let dir = self.dirpath(name).await?;
        Ok(utils::content(&dir, 10, &self.config.avoid_folders))
    }

    /// List files in a module (Python content_files)
    pub async fn content_files(&self, name: &str) -> Result<Vec<String>> {
        let content = self.content(name).await?;
        Ok(content.keys().cloned().collect())
    }

    /// Get module content size (Python size)
    pub async fn size(&self, name: &str) -> Result<usize> {
        let content = self.content(name).await?;
        Ok(content.values().map(|v| v.len()).sum())
    }

    /// Extract function names from a file path (Python path2fns)
    pub fn path2fns(&self, path: &Path) -> HashMap<PathBuf, Vec<String>> {
        let mut result = HashMap::new();

        let path = utils::abspath(&path.to_string_lossy());

        if path.is_dir() {
            let files = utils::files(&path, None, 10, false, &self.config.avoid_folders);
            for f in files {
                if is_source_file(&f) {
                    if let Ok(source) = std::fs::read_to_string(&f) {
                        let fns = module::parse_pub_fns(&source);
                        if !fns.is_empty() {
                            result.insert(f, fns);
                        }
                    }
                }
            }
        } else if path.is_file() && is_source_file(&path) {
            if let Ok(source) = std::fs::read_to_string(&path) {
                let fns = module::parse_pub_fns(&source);
                result.insert(path, fns);
            }
        }

        result
    }

    /// Extract struct/class names from a file path (Python path2classes)
    pub fn path2classes(&self, path: &Path) -> HashMap<PathBuf, Vec<String>> {
        let mut result = HashMap::new();

        let path = utils::abspath(&path.to_string_lossy());

        if path.is_dir() {
            let files = utils::files(&path, None, 10, false, &self.config.avoid_folders);
            for f in files {
                if is_source_file(&f) {
                    if let Ok(source) = std::fs::read_to_string(&f) {
                        let classes = module::parse_structs(&source);
                        if !classes.is_empty() {
                            result.insert(f, classes);
                        }
                    }
                }
            }
        } else if path.is_file() && is_source_file(&path) {
            if let Ok(source) = std::fs::read_to_string(&path) {
                let classes = module::parse_structs(&source);
                result.insert(path, classes);
            }
        }

        result
    }

    /// Find and read README files (Python readme)
    pub async fn readme(&self, name: &str) -> Result<Option<String>> {
        let dir = self.dirpath(name).await?;
        let readmes = utils::readmes(&dir, 3, &self.config.avoid_folders);
        if readmes.is_empty() {
            return Ok(None);
        }
        Ok(Some(std::fs::read_to_string(&readmes[0])?))
    }

    // ========================================================================
    // FILE OPERATIONS
    // ========================================================================

    /// List directory (Python ls)
    pub fn ls(&self, path: &str, search: Option<&str>) -> Vec<PathBuf> {
        utils::ls(&utils::abspath(path), search)
    }

    /// Recursive file listing (Python files)
    pub fn files(&self, path: &str, search: Option<&str>, depth: usize) -> Vec<PathBuf> {
        utils::files(&utils::abspath(path), search, depth, false, &self.config.avoid_folders)
    }

    /// Recursive folder listing (Python folders)
    pub fn folders(&self, path: &str, depth: usize, search: Option<&str>) -> Vec<PathBuf> {
        utils::folders(&utils::abspath(path), depth, search, false, &self.config.avoid_folders)
    }

    /// Read file to string (Python text)
    pub fn text(&self, path: &str) -> Result<String> {
        utils::text(&utils::abspath(path))
    }

    /// Write string to file (Python put_text)
    pub fn put_text(&self, path: &str, content: &str) -> Result<Value> {
        utils::put_text(&utils::abspath(path), content)
    }

    /// Read JSON file (Python get_json)
    pub fn get_json(&self, path: &str) -> Result<Option<Value>> {
        utils::get_json(&utils::abspath(path))
    }

    /// Write JSON file (Python put_json)
    pub fn put_json(&self, path: &str, data: &Value) -> Result<PathBuf> {
        utils::put_json(&utils::abspath(path), data)
    }

    /// Safe remove (Python rm)
    pub fn rm(&self, path: &str) -> Result<Value> {
        utils::rm(&utils::abspath(path))
    }

    /// Glob files recursively (Python glob)
    pub fn glob(&self, path: &str, depth: usize) -> Vec<PathBuf> {
        utils::glob_files(&utils::abspath(path), depth, true, false, &self.config.avoid_folders)
    }

    /// Resolve path (Python get_path)
    pub fn get_path(&self, path: Option<&str>) -> PathBuf {
        utils::get_path(path, &self.config.storage_dir())
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

    /// Get owner address — default key address (Python owner)
    pub async fn owner(&self) -> Result<String> {
        self.address(None).await
    }

    /// Check if address matches owner (Python is_owner)
    pub async fn is_owner(&self, address: &str) -> Result<bool> {
        let owner = self.owner().await?;
        Ok(address.to_lowercase() == owner.to_lowercase())
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

    pub async fn ipfs_add(&self, data: &[u8]) -> Result<String> {
        self.store.ipfs.add(data).await
    }

    pub async fn ipfs_cat(&self, cid: &str) -> Result<Vec<u8>> {
        self.store.ipfs.cat(cid).await
    }

    pub async fn ipfs_pin(&self, cid: &str) -> Result<()> {
        self.store.ipfs.pin(cid).await
    }

    pub async fn ipfs_unpin(&self, cid: &str) -> Result<()> {
        self.store.ipfs.unpin(cid).await
    }

    pub async fn ipfs_pins(&self) -> Result<Vec<String>> {
        self.store.ipfs.pins().await
    }

    pub async fn ipfs_stat(&self, cid: &str) -> Result<store::ipfs::StatResponse> {
        self.store.ipfs.stat(cid).await
    }

    pub async fn ipfs_online(&self) -> bool {
        self.store.ipfs.is_online().await
    }

    pub fn ipfs_url(&self, cid: &str) -> String {
        self.store.ipfs.url(cid)
    }

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

    pub fn serve_bg(&self, module_name: &str, port: u16) -> Result<()> {
        let mut manager = self.server_manager.write();
        manager.start_bg(module_name, port)
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

    pub async fn repos(&self, search: Option<&str>) -> Result<Vec<String>> {
        let repos = utils::repo2path(&self.config.paths.home, search);
        Ok(repos.keys().cloned().collect())
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

    /// Get current time in various formats (Python time)
    pub fn time(&self, mode: &str) -> Value {
        utils::time(mode)
    }

    /// Get environment variable(s) (Python env)
    pub fn env(&self, key: Option<&str>) -> Value {
        utils::env(key)
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

    /// Check if string is an IPFS CID
    pub fn is_cid(&self, text: &str) -> bool {
        utils::is_cid(text)
    }

    /// Get the storage directory
    pub fn storage_dir(&self) -> PathBuf {
        self.config.storage_dir()
    }

    /// Absolute path resolution
    pub fn abspath(&self, path: &str) -> PathBuf {
        utils::abspath(path)
    }

    /// Relative path from home
    pub fn relpath(&self, path: &Path) -> String {
        utils::relpath(path, &self.config.paths.home)
    }

    /// Current working directory
    pub fn pwd(&self) -> PathBuf {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    }
}

/// Check if a file is a source file
fn is_source_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("py" | "rs" | "ts" | "js" | "sol" | "tsx" | "jsx")
    )
}
