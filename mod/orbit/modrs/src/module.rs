//! Module system for dynamic loading and execution

use crate::config::Config;
use crate::error::{ModError, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::RwLock;

/// Module information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInfo {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub path: PathBuf,
    pub functions: Vec<String>,
}

/// Module trait - all modules must implement this
#[async_trait]
pub trait Module: Send + Sync {
    /// Call a function in the module
    async fn call(&self, fn_name: &str, params: Value) -> Result<Value>;

    /// Get module information
    async fn info(&self) -> Result<ModuleInfo>;

    /// Get module source code
    async fn code(&self) -> Result<String>;

    /// List available functions
    async fn functions(&self) -> Result<Vec<String>>;
}

/// Module registry for discovering and loading modules
pub struct ModuleRegistry {
    modules: Arc<RwLock<HashMap<String, Arc<dyn Module>>>>,
    orbit_paths: Vec<PathBuf>,
}

impl ModuleRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        let orbit_paths = vec![
            config.paths.orbit.join("inner"),
            config.paths.orbit.join("outer"),
            config.paths.mod_dir.join("core"),
        ];

        for path in &orbit_paths {
            std::fs::create_dir_all(path)?;
        }

        Ok(Self {
            modules: Arc::new(RwLock::new(HashMap::new())),
            orbit_paths,
        })
    }

    /// Load a module by name
    pub async fn load(&self, name: &str) -> Result<Arc<dyn Module>> {
        // Check cache
        {
            let modules = self.modules.read();
            if let Some(module) = modules.get(name) {
                return Ok(Arc::clone(module));
            }
        }

        // Find and load module
        let path = self.find_module(name)?;
        let module = self.load_from_path(&path, name).await?;
        let module_arc = Arc::new(module) as Arc<dyn Module>;

        // Cache it
        {
            let mut modules = self.modules.write();
            modules.insert(name.to_string(), Arc::clone(&module_arc));
        }

        Ok(module_arc)
    }

    /// Check if a module exists
    pub async fn exists(&self, name: &str) -> bool {
        self.find_module(name).is_ok()
    }

    /// List all available modules
    pub async fn list(&self) -> Result<Vec<String>> {
        let mut names = Vec::new();

        for orbit_path in &self.orbit_paths {
            if let Ok(entries) = std::fs::read_dir(orbit_path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Some(name) = entry.file_name().to_str() {
                            names.push(name.to_string());
                        }
                    }
                }
            }
        }

        names.sort();
        names.dedup();
        Ok(names)
    }

    /// Get module directory path
    pub async fn dirpath(&self, name: &str) -> Result<PathBuf> {
        self.find_module(name)
    }

    fn find_module(&self, name: &str) -> Result<PathBuf> {
        let name_parts: Vec<&str> = name.split('.').collect();

        for orbit_path in &self.orbit_paths {
            let mut module_path = orbit_path.clone();
            for part in &name_parts {
                module_path = module_path.join(part);
            }

            if module_path.exists() && module_path.is_dir() {
                return Ok(module_path);
            }
        }

        Err(ModError::ModuleNotFound(name.to_string()))
    }

    async fn load_from_path(&self, path: &PathBuf, name: &str) -> Result<Box<dyn Module>> {
        // Create a basic module implementation
        // In a real implementation, this would use dynamic loading (dlopen, libloading, etc.)
        Ok(Box::new(BasicModule::new(path.clone(), name.to_string())))
    }
}

/// Basic module implementation for Rust modules
struct BasicModule {
    path: PathBuf,
    name: String,
    info: ModuleInfo,
}

impl BasicModule {
    fn new(path: PathBuf, name: String) -> Self {
        let info = ModuleInfo {
            name: name.clone(),
            version: "0.1.0".to_string(),
            description: None,
            path: path.clone(),
            functions: vec!["info", "forward"].iter().map(|s| s.to_string()).collect(),
        };

        Self { path, name, info }
    }

    fn find_anchor_file(&self) -> Result<PathBuf> {
        let anchor_names = vec!["mod.rs", "mod.py", "agent.py", "block.py"];

        for name in anchor_names {
            let path = self.path.join(name);
            if path.exists() {
                return Ok(path);
            }
        }

        // Check for file matching module name
        for ext in &["rs", "py", "ts"] {
            let path = self.path.join(format!("{}.{}", self.name.split('.').last().unwrap_or(&self.name), ext));
            if path.exists() {
                return Ok(path);
            }
        }

        Err(ModError::ModuleLoadError(format!(
            "No anchor file found in {}",
            self.path.display()
        )))
    }
}

#[async_trait]
impl Module for BasicModule {
    async fn call(&self, fn_name: &str, params: Value) -> Result<Value> {
        // Basic implementation - in real use would dispatch to actual functions
        match fn_name {
            "info" => Ok(serde_json::to_value(&self.info)?),
            "forward" => {
                // Default forward function
                Ok(serde_json::json!({
                    "module": self.name,
                    "function": fn_name,
                    "params": params,
                    "result": "forwarded"
                }))
            }
            _ => Err(ModError::FunctionNotFound(fn_name.to_string())),
        }
    }

    async fn info(&self) -> Result<ModuleInfo> {
        Ok(self.info.clone())
    }

    async fn code(&self) -> Result<String> {
        let anchor = self.find_anchor_file()?;
        std::fs::read_to_string(anchor).map_err(Into::into)
    }

    async fn functions(&self) -> Result<Vec<String>> {
        Ok(self.info.functions.clone())
    }
}
