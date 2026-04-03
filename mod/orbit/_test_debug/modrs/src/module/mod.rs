//! Module system — each mod is a folder with an anchor file (mod.rs, agent.rs, etc.)
//!
//! Mirrors Python mod.py patterns:
//! - Anchor file resolution (agent.py, mod.py, block.py, or name-matching file)
//! - Tree-based module discovery via orbit paths
//! - Function/struct extraction from source without full AST parsing

use crate::config::Config;
use crate::error::{ModError, Result};
use crate::tree::ModuleTree;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInfo {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub path: PathBuf,
    pub functions: Vec<String>,
    pub anchor_file: Option<PathBuf>,
    pub files: Vec<PathBuf>,
}

#[async_trait]
pub trait Module: Send + Sync {
    async fn call(&self, fn_name: &str, params: Value) -> Result<Value>;
    async fn info(&self) -> Result<ModuleInfo>;
    async fn code(&self) -> Result<String>;
    async fn functions(&self) -> Result<Vec<String>>;
}

/// Module registry — discovers modules via the tree system and resolves anchor files
pub struct ModuleRegistry {
    modules: Arc<RwLock<HashMap<String, Arc<dyn Module>>>>,
    tree: Arc<ModuleTree>,
    config: Config,
}

impl ModuleRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        let tree = ModuleTree::new(config);

        Ok(Self {
            modules: Arc::new(RwLock::new(HashMap::new())),
            tree: Arc::new(tree),
            config: config.clone(),
        })
    }

    /// Access the underlying tree
    pub fn tree(&self) -> &ModuleTree {
        &self.tree
    }

    /// Load a module by name
    pub async fn load(&self, name: &str) -> Result<Arc<dyn Module>> {
        // Check cache first
        {
            let modules = self.modules.read();
            if let Some(module) = modules.get(name) {
                return Ok(Arc::clone(module));
            }
        }

        // Resolve path via tree
        let dir_path = self.tree.dirpath(name)?;

        // Find anchor file
        let anchor = self.anchor_file(&dir_path, name)?;

        let module = FolderModule::from_anchor(dir_path.clone(), name.to_string(), anchor)?;
        let module_arc = Arc::new(module) as Arc<dyn Module>;

        {
            let mut modules = self.modules.write();
            modules.insert(name.to_string(), Arc::clone(&module_arc));
        }

        Ok(module_arc)
    }

    /// Create a new module — makes folder + scaffolds anchor file
    pub fn create(&self, name: &str, description: Option<&str>) -> Result<PathBuf> {
        let mod_dir = self.config.paths.orbit.inner.join(name);
        if mod_dir.exists() {
            return Err(ModError::ModuleLoadError(format!("Module '{}' already exists", name)));
        }

        std::fs::create_dir_all(&mod_dir)?;
        Self::scaffold_with_desc(&mod_dir, name, description)?;

        // Clear tree cache so new module is discoverable
        self.tree.clear_cache();

        Ok(mod_dir)
    }

    /// Remove a module — deletes the folder
    pub fn remove(&self, name: &str) -> Result<()> {
        let path = self.tree.dirpath(name)?;
        std::fs::remove_dir_all(&path)?;

        // Evict from cache
        let mut modules = self.modules.write();
        modules.remove(name);
        self.tree.clear_cache();

        Ok(())
    }

    /// Check if a module exists
    pub async fn exists(&self, name: &str) -> bool {
        self.tree.mod_exists(name)
    }

    /// List all available modules
    pub async fn list(&self) -> Result<Vec<String>> {
        Ok(self.tree.mods(None))
    }

    /// Get module directory path
    pub async fn dirpath(&self, name: &str) -> Result<PathBuf> {
        self.tree.dirpath(name)
    }

    // ── Anchor file resolution (Python anchor_file) ─────────────────────

    /// Find the anchor/entry file in a module directory.
    ///
    /// Search order matches Python:
    /// 1. If only one matching file, return it
    /// 2. Look for {anchor_name}.{ext} where anchor_names includes
    ///    "agent", "mod", "block", and path segment names
    /// 3. Prefer shortest path
    fn anchor_file(&self, dir: &Path, name: &str) -> Result<PathBuf> {
        let file_types = &self.config.file_types;
        let mut anchor_names: Vec<String> = self.config.anchor_names.clone();

        // Add path-segment names as anchor candidates (Python pattern)
        let home_str = self.config.paths.home.to_string_lossy();
        let dir_str = dir.to_string_lossy();
        let relative = if dir_str.starts_with(home_str.as_ref()) {
            &dir_str[home_str.len()..]
        } else {
            &dir_str
        };
        for segment in relative.trim_start_matches('/').split('/') {
            if !segment.is_empty() && !anchor_names.contains(&segment.to_string()) {
                anchor_names.push(segment.to_string());
            }
        }

        // Also add the module name itself
        let name_parts: Vec<&str> = name.split('.').collect();
        for part in &name_parts {
            if !anchor_names.contains(&part.to_string()) {
                anchor_names.push(part.to_string());
            }
        }

        // Quick check: does mod.rs already exist? (most common case)
        let quick_check = dir.join("mod.rs");
        if quick_check.exists() {
            return Ok(quick_check);
        }

        // Get all matching files via tree scan
        let files = self.tree.files(dir, 4, None);
        // Also do a direct directory listing in case tree filtering misses files
        let mut all_files: Vec<PathBuf> = files;
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && !all_files.contains(&p) {
                    all_files.push(p);
                }
            }
        }

        let matching: Vec<PathBuf> = all_files.into_iter()
            .filter(|f| {
                if let Some(ext) = f.extension().and_then(|e| e.to_str()) {
                    file_types.iter().any(|ft| ft == ext)
                } else {
                    false
                }
            })
            .collect();

        if matching.is_empty() {
            // Auto-scaffold if no files found
            Self::scaffold_with_desc(&dir.to_path_buf(), name, None)?;
            return Ok(dir.join("mod.rs"));
        }

        if matching.len() == 1 {
            return Ok(matching[0].clone());
        }

        // Search by anchor name + file type priority
        let mut sorted = matching.clone();
        sorted.sort_by_key(|p| p.to_string_lossy().len());

        for ft in file_types {
            for anchor in &anchor_names {
                for f in &sorted {
                    let fname = format!("{}.{}", anchor, ft);
                    if f.to_string_lossy().ends_with(&format!("/{}", fname)) {
                        return Ok(f.clone());
                    }
                }
            }
        }

        // Fallback to shortest matching file
        Ok(sorted[0].clone())
    }

    /// Generate a scaffold mod.rs for a new module
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

/// A module loaded from a folder with an anchor file
struct FolderModule {
    #[allow(dead_code)]
    path: PathBuf,
    name: String,
    anchor: PathBuf,
    info: ModuleInfo,
}

impl FolderModule {
    fn from_anchor(path: PathBuf, name: String, anchor: PathBuf) -> Result<Self> {
        let source = std::fs::read_to_string(&anchor)?;
        let functions = parse_pub_fns(&source);
        let description = parse_doc_comment(&source);

        // List all files in the module directory
        let files: Vec<PathBuf> = if path.is_dir() {
            walkdir::WalkDir::new(&path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .map(|e| e.path().to_path_buf())
                .collect()
        } else {
            vec![anchor.clone()]
        };

        let info = ModuleInfo {
            name: name.clone(),
            version: parse_version_field(&source).unwrap_or_else(|| "0.1.0".to_string()),
            description,
            path: path.clone(),
            functions,
            anchor_file: Some(anchor.clone()),
            files,
        };

        Ok(Self { path, name, anchor, info })
    }
}

#[async_trait]
impl Module for FolderModule {
    async fn call(&self, fn_name: &str, params: Value) -> Result<Value> {
        if !self.info.functions.contains(&fn_name.to_string()) {
            return Err(ModError::FunctionNotFound(format!(
                "{}/{}", self.name, fn_name
            )));
        }

        // Structured response — real impl would dlopen or interpret
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
        std::fs::read_to_string(&self.anchor).map_err(Into::into)
    }

    async fn functions(&self) -> Result<Vec<String>> {
        Ok(self.info.functions.clone())
    }
}

// ============================================================================
// Source parsing helpers
// ============================================================================

/// Extract public function names from source (works for Rust and Python)
pub fn parse_pub_fns(source: &str) -> Vec<String> {
    let mut fns = Vec::new();
    for line in source.lines() {
        let trimmed = line.trim();

        // Rust: pub fn name(
        if trimmed.starts_with("pub fn ") || trimmed.starts_with("pub async fn ") {
            let after_fn = if trimmed.starts_with("pub async fn ") {
                trimmed.strip_prefix("pub async fn ")
            } else {
                trimmed.strip_prefix("pub fn ")
            };
            if let Some(name) = after_fn.and_then(|s| s.split('(').next()) {
                let name = name.trim();
                if name != "new" && !name.is_empty() {
                    fns.push(name.to_string());
                }
            }
        }

        // Python: def name( or async def name(
        if trimmed.starts_with("def ") || trimmed.starts_with("async def ") {
            let after_def = if trimmed.starts_with("async def ") {
                trimmed.strip_prefix("async def ")
            } else {
                trimmed.strip_prefix("def ")
            };
            if let Some(name) = after_def.and_then(|s| s.split('(').next()) {
                let name = name.trim();
                if !name.starts_with('_') && !name.is_empty() {
                    fns.push(name.to_string());
                }
            }
        }

        // TypeScript: export function name( or export async function name(
        if trimmed.starts_with("export function ") || trimmed.starts_with("export async function ") {
            let after = trimmed.replace("export async function ", "").replace("export function ", "");
            if let Some(name) = after.split('(').next() {
                let name = name.trim();
                if !name.is_empty() {
                    fns.push(name.to_string());
                }
            }
        }
    }
    fns
}

/// Extract struct/class names from source (Rust structs, Python/TS classes)
pub fn parse_structs(source: &str) -> Vec<String> {
    let mut structs = Vec::new();
    for line in source.lines() {
        let trimmed = line.trim();

        // Rust: pub struct Name {  or  struct Name {
        if trimmed.starts_with("pub struct ") || trimmed.starts_with("struct ") {
            let after = if trimmed.starts_with("pub struct ") {
                trimmed.strip_prefix("pub struct ")
            } else {
                trimmed.strip_prefix("struct ")
            };
            if let Some(name) = after.and_then(|s| s.split(|c: char| !c.is_alphanumeric() && c != '_').next()) {
                if !name.is_empty() {
                    structs.push(name.to_string());
                }
            }
        }

        // Python: class Name:  or  class Name(
        if trimmed.starts_with("class ") {
            let after = trimmed.strip_prefix("class ").unwrap_or("");
            if let Some(name) = after.split(|c: char| !c.is_alphanumeric() && c != '_').next() {
                if !name.is_empty() {
                    structs.push(name.to_string());
                }
            }
        }

        // TypeScript: export class Name {  or  class Name {
        if trimmed.starts_with("export class ") {
            let after = trimmed.strip_prefix("export class ").unwrap_or("");
            if let Some(name) = after.split(|c: char| !c.is_alphanumeric() && c != '_').next() {
                if !name.is_empty() {
                    structs.push(name.to_string());
                }
            }
        }
    }
    structs
}

/// Extract the first //! or """ doc comment as description
pub fn parse_doc_comment(source: &str) -> Option<String> {
    for line in source.lines() {
        let trimmed = line.trim();
        // Rust //! doc comment
        if trimmed.starts_with("//!") {
            let comment = trimmed.trim_start_matches("//!").trim();
            if !comment.is_empty() {
                return Some(comment.to_string());
            }
        }
        // Python """ docstring (first line)
        else if trimmed.starts_with("\"\"\"") || trimmed.starts_with("'''") {
            let doc = trimmed.trim_start_matches("\"\"\"").trim_start_matches("'''").trim();
            let doc = doc.trim_end_matches("\"\"\"").trim_end_matches("'''").trim();
            if !doc.is_empty() {
                return Some(doc.to_string());
            }
        }
        else if !trimmed.is_empty()
            && !trimmed.starts_with("//")
            && !trimmed.starts_with('#')
            && !trimmed.starts_with("use ")
            && !trimmed.starts_with("import ")
            && !trimmed.starts_with("from ")
        {
            break;
        }
    }
    None
}

/// Try to find version = "x.y.z" in the source
pub fn parse_version_field(source: &str) -> Option<String> {
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("version:") || trimmed.starts_with("\"version\"") || trimmed.contains("version =") {
            if let Some(start) = trimmed.find('"') {
                let rest = &trimmed[start + 1..];
                if let Some(end) = rest.find('"') {
                    let ver = &rest[..end];
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
pub fn to_pascal_case(s: &str) -> String {
    s.split(|c: char| c == '_' || c == '-' || c == '.')
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
    fn test_parse_pub_fns_rust() {
        let src = r#"
impl Foo {
    pub fn new() -> Self { todo!() }
    pub fn info(&self) -> Value { todo!() }
    pub fn forward(&self, params: Value) -> Value { todo!() }
    pub async fn fetch(&self) -> Value { todo!() }
    fn private_thing(&self) {}
}
"#;
        let fns = parse_pub_fns(src);
        assert_eq!(fns, vec!["info", "forward", "fetch"]);
    }

    #[test]
    fn test_parse_pub_fns_python() {
        let src = r#"
class Store:
    def __init__(self):
        pass

    def get(self, key):
        pass

    def put(self, key, value):
        pass

    def _private(self):
        pass

    async def async_get(self, key):
        pass
"#;
        let fns = parse_pub_fns(src);
        assert_eq!(fns, vec!["get", "put", "async_get"]);
    }

    #[test]
    fn test_parse_structs() {
        let src = r#"
pub struct MyModule {
    name: String,
}

class Store:
    pass

export class Treasury {
}
"#;
        let structs = parse_structs(src);
        assert_eq!(structs, vec!["MyModule", "Store", "Treasury"]);
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
        assert_eq!(to_pascal_case("model.openrouter"), "ModelOpenrouter");
    }
}
