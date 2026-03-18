//! Module system — each mod is a folder with a mod.rs containing one struct

use crate::config::Config;
use crate::error::{ModError, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInfo {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub path: PathBuf,
    pub functions: Vec<String>,
}

#[async_trait]
pub trait Module: Send + Sync {
    async fn call(&self, fn_name: &str, params: Value) -> Result<Value>;
    async fn info(&self) -> Result<ModuleInfo>;
    async fn code(&self) -> Result<String>;
    async fn functions(&self) -> Result<Vec<String>>;
}

/// Module registry — discovers, creates, and loads modules from orbit paths
pub struct ModuleRegistry {
    modules: Arc<RwLock<HashMap<String, Arc<dyn Module>>>>,
    orbit_paths: Vec<PathBuf>,
}

impl ModuleRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        let orbit_paths = vec![
            config.paths.lib.join("mods"),
            config.paths.orbit.clone(),
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
        {
            let modules = self.modules.read();
            if let Some(module) = modules.get(name) {
                return Ok(Arc::clone(module));
            }
        }

        let path = self.find_module(name)?;
        let mod_rs = path.join("mod.rs");

        // auto-scaffold if mod.rs missing
        if !mod_rs.exists() {
            Self::scaffold(&path, name)?;
        }

        let module = FolderModule::from_path(path.clone(), name.to_string())?;
        let module_arc = Arc::new(module) as Arc<dyn Module>;

        {
            let mut modules = self.modules.write();
            modules.insert(name.to_string(), Arc::clone(&module_arc));
        }

        Ok(module_arc)
    }

    /// Create a new module — makes folder + mod.rs with one struct
    pub fn create(&self, name: &str, description: Option<&str>) -> Result<PathBuf> {
        // put new mods in first orbit path
        let base = self.orbit_paths.first()
            .ok_or_else(|| ModError::Config("No orbit paths configured".to_string()))?;

        let mod_dir = base.join(name);
        if mod_dir.exists() {
            return Err(ModError::ModuleLoadError(format!("Module '{}' already exists", name)));
        }

        std::fs::create_dir_all(&mod_dir)?;
        Self::scaffold_with_desc(&mod_dir, name, description)?;

        Ok(mod_dir)
    }

    /// Remove a module — deletes the folder
    pub fn remove(&self, name: &str) -> Result<()> {
        let path = self.find_module(name)?;
        std::fs::remove_dir_all(&path)?;

        // evict from cache
        let mut modules = self.modules.write();
        modules.remove(name);

        Ok(())
    }

    /// Check if a module exists
    pub async fn exists(&self, name: &str) -> bool {
        self.find_module(name).is_ok()
    }

    /// List all available modules (folders that contain mod.rs or could be scaffolded)
    pub async fn list(&self) -> Result<Vec<String>> {
        let mut names = Vec::new();

        for orbit_path in &self.orbit_paths {
            if let Ok(entries) = std::fs::read_dir(orbit_path) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        if let Some(n) = p.file_name().and_then(|f| f.to_str()) {
                            // skip hidden dirs
                            if !n.starts_with('.') {
                                names.push(n.to_string());
                            }
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

    /// Generate a default mod.rs scaffold — one struct, one impl
    fn scaffold(dir: &PathBuf, name: &str) -> Result<()> {
        Self::scaffold_with_desc(dir, name, None)
    }

    fn scaffold_with_desc(dir: &PathBuf, name: &str, description: Option<&str>) -> Result<()> {
        let struct_name = to_pascal_case(name);
        let desc = description.unwrap_or("A mod module");
        let content = format!(
r#"//! {desc}

use serde::{{Deserialize, Serialize}};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct {struct_name} {{
    pub name: String,
    pub version: String,
}}

impl {struct_name} {{
    pub fn new() -> Self {{
        Self {{
            name: "{name}".to_string(),
            version: "0.1.0".to_string(),
        }}
    }}

    pub fn info(&self) -> Value {{
        serde_json::json!({{
            "name": self.name,
            "version": self.version,
        }})
    }}

    pub fn forward(&self, params: Value) -> Value {{
        serde_json::json!({{
            "module": self.name,
            "params": params,
            "result": "forwarded"
        }})
    }}
}}
"#);

        let mod_rs = dir.join("mod.rs");
        std::fs::write(&mod_rs, content)?;
        Ok(())
    }
}

/// A module loaded from a folder with mod.rs
struct FolderModule {
    path: PathBuf,
    name: String,
    info: ModuleInfo,
}

impl FolderModule {
    fn from_path(path: PathBuf, name: String) -> Result<Self> {
        let mod_rs = path.join("mod.rs");
        let source = std::fs::read_to_string(&mod_rs)?;
        let functions = parse_pub_fns(&source);

        let description = parse_doc_comment(&source);

        let info = ModuleInfo {
            name: name.clone(),
            version: parse_version_field(&source).unwrap_or_else(|| "0.1.0".to_string()),
            description,
            path: path.clone(),
            functions,
        };

        Ok(Self { path, name, info })
    }
}

#[async_trait]
impl Module for FolderModule {
    async fn call(&self, fn_name: &str, params: Value) -> Result<Value> {
        // dispatch based on parsed functions
        if !self.info.functions.contains(&fn_name.to_string()) {
            return Err(ModError::FunctionNotFound(format!(
                "{}/{}", self.name, fn_name
            )));
        }

        // For now return structured response — real impl would dlopen or interpret
        Ok(serde_json::json!({
            "module": self.name,
            "function": fn_name,
            "params": params,
            "status": "ok"
        }))
    }

    async fn info(&self) -> Result<ModuleInfo> {
        Ok(self.info.clone())
    }

    async fn code(&self) -> Result<String> {
        let mod_rs = self.path.join("mod.rs");
        std::fs::read_to_string(mod_rs).map_err(Into::into)
    }

    async fn functions(&self) -> Result<Vec<String>> {
        Ok(self.info.functions.clone())
    }
}

// ============================================================================
// Parsing helpers — extract info from mod.rs source without a full Rust parser
// ============================================================================

/// Extract public function names from `pub fn name(` patterns in impl blocks
fn parse_pub_fns(source: &str) -> Vec<String> {
    let mut fns = Vec::new();
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("pub fn ") {
            if let Some(name) = trimmed
                .strip_prefix("pub fn ")
                .and_then(|s| s.split('(').next())
            {
                let name = name.trim();
                if name != "new" {
                    fns.push(name.to_string());
                }
            }
        }
    }
    fns
}

/// Extract the first //! doc comment as description
fn parse_doc_comment(source: &str) -> Option<String> {
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("//!") {
            let comment = trimmed.trim_start_matches("//!").trim();
            if !comment.is_empty() {
                return Some(comment.to_string());
            }
        } else if !trimmed.is_empty() {
            break;
        }
    }
    None
}

/// Try to find version = "x.y.z" in the source
fn parse_version_field(source: &str) -> Option<String> {
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("version:") || trimmed.starts_with("\"version\"") {
            if let Some(start) = trimmed.find('"') {
                let rest = &trimmed[start + 1..];
                if let Some(end) = rest.find('"') {
                    let ver = &rest[..end];
                    // basic semver check
                    if ver.contains('.') {
                        return Some(ver.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Convert snake_case or kebab-case to PascalCase
fn to_pascal_case(s: &str) -> String {
    s.split(|c: char| c == '_' || c == '-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    upper + chars.as_str()
                }
                None => String::new(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pub_fns() {
        let src = r#"
impl Foo {
    pub fn new() -> Self { todo!() }
    pub fn info(&self) -> Value { todo!() }
    pub fn forward(&self, params: Value) -> Value { todo!() }
    fn private_thing(&self) {}
}
"#;
        let fns = parse_pub_fns(src);
        assert_eq!(fns, vec!["info", "forward"]);
    }

    #[test]
    fn test_parse_doc_comment() {
        let src = "//! My cool module\n\nuse foo;";
        assert_eq!(parse_doc_comment(src), Some("My cool module".to_string()));
    }

    #[test]
    fn test_to_pascal_case() {
        assert_eq!(to_pascal_case("my_cool_mod"), "MyCoolMod");
        assert_eq!(to_pascal_case("api"), "Api");
        assert_eq!(to_pascal_case("http-server"), "HttpServer");
    }
}
