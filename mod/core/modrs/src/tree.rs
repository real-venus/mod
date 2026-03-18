//! Module tree discovery — mirrors Python mod.py tree/search/orbit patterns
//!
//! The tree maps module names to directory paths. Modules are discovered
//! by scanning orbit directories (core, inner, outer, local) at configurable
//! depths. Names are normalized by stripping avoid-terms and deduplicating
//! path segments.

use crate::config::Config;
use crate::error::{ModError, Result};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Module tree — name → absolute path mapping with caching
pub struct ModuleTree {
    config: Config,
    /// cache_key → (name → path)
    cache: RwLock<HashMap<String, HashMap<String, PathBuf>>>,
}

impl ModuleTree {
    pub fn new(config: &Config) -> Self {
        // Ensure orbit directories exist
        let orbits = &config.paths.orbit;
        for dir in [&orbits.inner, &orbits.outer, &orbits.core] {
            let _ = std::fs::create_dir_all(dir);
        }

        Self {
            config: config.clone(),
            cache: RwLock::new(HashMap::new()),
        }
    }

    // ── Name normalization (Python get_name) ────────────────────────────

    /// Normalize a module path/name to a canonical dot-separated name.
    /// Strips avoid terms like "src", "mods", "_mods", "core", "modules", etc.
    pub fn get_name(&self, name: &str) -> String {
        let name = name.trim();
        if name.is_empty() {
            return self.config.name.clone();
        }

        let mut name = name.to_string();

        // If it starts with a path prefix, convert to relative name
        if name.starts_with('/') || name.starts_with('~') || name.starts_with('.') {
            name = self.path2name(&name);
        }

        // Normalize separators
        name = name.replace('/', ".");

        let avoid_terms: Vec<&str> = vec![
            "src", "mods", "_mods", "core", "modules", "_exp", "ext", "orbit", "_outer",
        ];

        let chunks: Vec<&str> = name.split('.')
            .filter(|chunk| !chunk.is_empty() && !avoid_terms.contains(chunk))
            .collect();

        if chunks.is_empty() {
            return self.config.name.clone();
        }

        // Strip leading "mod" if it matches the framework name
        let result: Vec<&str> = if chunks[0] == self.config.name {
            chunks[1..].to_vec()
        } else {
            chunks
        };

        if result.is_empty() {
            self.config.name.clone()
        } else {
            result.join(".").to_lowercase()
        }
    }

    /// Convert an absolute path to a module name
    fn path2name(&self, path: &str) -> String {
        let path = shellexpand::tilde(path).to_string();
        let path = std::fs::canonicalize(&path)
            .unwrap_or_else(|_| PathBuf::from(&path));
        let path_str = path.to_string_lossy();

        // Strip known prefixes
        let prefixes = [
            self.config.paths.lib.to_string_lossy().to_string(),
            self.config.paths.home.to_string_lossy().to_string(),
        ];

        let mut result = path_str.to_string();
        for prefix in &prefixes {
            if result.starts_with(prefix) {
                result = result[prefix.len()..].trim_start_matches('/').to_string();
                break;
            }
        }

        // Strip file extension
        if result.ends_with(".py") || result.ends_with(".rs") || result.ends_with(".ts") {
            result = result.rsplit_once('.').map(|(s, _)| s.to_string()).unwrap_or(result);
        }

        result.replace("__init__.", ".").replace('/', ".")
    }

    // ── Path processing (Python process_path) ───────────────────────────

    /// Dedup trailing path segments: model/openrouter/openrouter → model/openrouter
    fn process_path(&self, path: &str) -> String {
        let ignore_suffixes = ["/src", "/core"];
        let mut x = path.to_string();

        for suffix in &ignore_suffixes {
            if x.ends_with(suffix) {
                x = x[..x.len() - suffix.len()].to_string();
            }
        }

        let parts: Vec<&str> = x.split('/').collect();
        if parts.len() >= 2 {
            let mut parts = parts.to_vec();
            if parts.len() > 2 && parts[parts.len() - 1] == parts[parts.len() - 2] {
                parts.pop();
            }
            if parts.len() >= 3 && parts[parts.len() - 2].contains(parts[parts.len() - 1]) {
                parts.truncate(parts.len() - 2);
            }
            x = parts.join("/");
        }

        x
    }

    // ── Directory scanning ──────────────────────────────────────────────

    /// List directory entries (Python ls)
    fn ls(&self, path: &Path) -> Vec<PathBuf> {
        match std::fs::read_dir(path) {
            Ok(entries) => {
                let mut files: Vec<PathBuf> = entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .collect();
                files.sort();
                files
            }
            Err(_) => Vec::new(),
        }
    }

    /// Check if path should be filtered out (Python filter_path)
    fn filter_path(&self, path: &Path, include_hidden: bool, search: Option<&str>) -> bool {
        let path_str = path.to_string_lossy();

        if !include_hidden && path_str.contains("/.") {
            return false;
        }

        for af in &self.config.avoid_folders {
            if path_str.contains(&format!("/{}", af)) {
                return false;
            }
        }

        if let Some(s) = search {
            if !path_str.contains(s) {
                return false;
            }
        }

        true
    }

    /// Recursively list folders (Python folders)
    pub fn folders(&self, path: &Path, depth: usize, search: Option<&str>) -> Vec<PathBuf> {
        if depth == 0 {
            return Vec::new();
        }

        let mut paths = Vec::new();
        for entry in self.ls(path) {
            if !self.filter_path(&entry, false, None) {
                continue;
            }
            if entry.is_dir() {
                paths.push(entry.clone());
                if depth > 1 {
                    paths.extend(self.folders(&entry, depth - 1, search));
                }
            }
        }

        paths.retain(|p| self.filter_path(p, false, search));
        paths.sort();
        paths.dedup();
        paths
    }

    /// Recursively list files (Python files)
    pub fn files(&self, path: &Path, depth: usize, search: Option<&str>) -> Vec<PathBuf> {
        if depth == 0 {
            return Vec::new();
        }

        let mut result = Vec::new();
        for entry in self.ls(path) {
            if entry.is_dir() {
                result.extend(self.files(&entry, depth - 1, search));
            } else if entry.is_file() {
                result.push(entry);
            }
        }

        result.retain(|p| self.filter_path(p, false, search));
        result.sort();
        result
    }

    // ── Tree building (Python get_tree) ─────────────────────────────────

    /// Build module tree for a given path at given depth
    pub fn get_tree(
        &self,
        path: &Path,
        search: Option<&str>,
        depth: usize,
        update: bool,
    ) -> HashMap<String, PathBuf> {
        let cache_key = format!("{}::{}", path.display(), depth);

        if !update {
            let cache = self.cache.read();
            if let Some(tree) = cache.get(&cache_key) {
                if search.is_none() {
                    return tree.clone();
                }
                // Apply search filter
                return self.filter_tree(tree, search);
            }
        }

        // Build tree by scanning folders
        let mut tree: HashMap<String, PathBuf> = HashMap::new();
        let folders = self.folders(path, depth, None);

        for p in folders {
            let name = self.get_name(&p.to_string_lossy());
            let processed = self.process_path(&p.to_string_lossy());
            let processed_path = PathBuf::from(&processed);

            // Keep shortest path for duplicate names
            if let Some(existing) = tree.get(&name) {
                let existing_str: String = existing.to_string_lossy().to_string();
                if processed.len() < existing_str.len() {
                    tree.insert(name, processed_path);
                }
            } else {
                tree.insert(name, processed_path);
            }
        }

        // Add shortcuts
        for (shortcut, target) in &self.config.shortcuts {
            if let Some(path) = tree.get(target).cloned() {
                tree.insert(shortcut.clone(), path);
            }
        }

        // Cache
        {
            let mut cache = self.cache.write();
            cache.insert(cache_key, tree.clone());
        }

        if search.is_some() {
            self.filter_tree(&tree, search)
        } else {
            tree
        }
    }

    /// Get tree for a single orbit
    pub fn orbit(
        &self,
        orbit_name: &str,
        search: Option<&str>,
        depth: Option<usize>,
    ) -> HashMap<String, PathBuf> {
        let orbit_path = match orbit_name {
            "core" => &self.config.paths.orbit.core,
            "inner" => &self.config.paths.orbit.inner,
            "outer" => &self.config.paths.orbit.outer,
            "local" => &self.config.paths.orbit.local,
            _ => return HashMap::new(),
        };

        let depth = depth.unwrap_or_else(|| self.config.orbit_depth(orbit_name));
        self.get_tree(orbit_path, search, depth, false)
    }

    /// Get the full merged tree across all orbits (Python tree)
    pub fn tree(
        &self,
        search: Option<&str>,
        depth: Option<usize>,
        orbit: Option<&str>,
    ) -> HashMap<String, PathBuf> {
        let mut tree = HashMap::new();

        let orbits: Vec<&str> = match orbit {
            Some("all") | None => vec!["outer", "inner", "core"],
            Some(o) => vec![o],
        };

        // Merge in reverse priority order (core last = highest priority for shortest names)
        for orbit_name in orbits.iter().rev() {
            tree.extend(self.orbit(orbit_name, search, depth));
        }

        // Sort by name length (shortest first)
        let mut sorted: Vec<(String, PathBuf)> = tree.into_iter().collect();
        sorted.sort_by(|a, b| a.0.len().cmp(&b.0.len()).then_with(|| a.0.cmp(&b.0)));
        sorted.into_iter().collect()
    }

    // ── Search (Python search) ──────────────────────────────────────────

    /// Match filter: exact, contains, starts_with, ends_with (Python filter_fn)
    fn filter_fn(key: &str, search: &str) -> bool {
        let k = key.to_lowercase();
        let s = search.to_lowercase();
        k == s
            || k.contains(&s)
            || k.ends_with(&format!(".{}", s))
            || k.starts_with(&format!("{}.", s))
    }

    /// Filter a tree by search term
    fn filter_tree(&self, tree: &HashMap<String, PathBuf>, search: Option<&str>) -> HashMap<String, PathBuf> {
        let search = match search {
            Some(s) => s,
            None => return tree.clone(),
        };

        tree.iter()
            .filter(|(k, _)| Self::filter_fn(k, search))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }

    /// Progressive depth search (Python search) — increases depth until found or max_depth
    pub fn search(
        &self,
        query: &str,
        depth: Option<usize>,
        max_depth: usize,
        orbit: Option<&str>,
    ) -> HashMap<String, PathBuf> {
        let query = query.to_lowercase().replace('/', ".");
        let depth = depth.unwrap_or(2);

        let tree = self.tree(None, Some(depth), orbit);
        let matches: HashMap<String, PathBuf> = tree.iter()
            .filter(|(k, _)| Self::filter_fn(k, &query))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        if !matches.is_empty() {
            // Sort by name length
            let mut sorted: Vec<(String, PathBuf)> = matches.into_iter().collect();
            sorted.sort_by(|a, b| a.0.len().cmp(&b.0.len()));
            return sorted.into_iter().collect();
        }

        // Progressive deepening
        if depth < max_depth {
            return self.search(&query, Some(depth + 1), max_depth, orbit);
        }

        HashMap::new()
    }

    /// Resolve a module name to its directory path (Python dirpath)
    pub fn dirpath(&self, name: &str) -> Result<PathBuf> {
        if name.is_empty() || name == self.config.name {
            return Ok(self.config.paths.lib.clone());
        }

        // Direct check: look for the module folder in orbit directories
        let name_path = name.replace('.', "/");
        let orbit_dirs = [
            &self.config.paths.orbit.inner,
            &self.config.paths.orbit.core,
            &self.config.paths.orbit.outer,
            &self.config.paths.orbit.local,
        ];
        for orbit_dir in &orbit_dirs {
            let candidate = orbit_dir.join(&name_path);
            if candidate.exists() && candidate.is_dir() {
                return Ok(candidate);
            }
        }

        // Fallback to tree search
        let results = self.search(name, None, 6, None);
        if results.is_empty() {
            return Err(ModError::ModuleNotFound(name.to_string()));
        }

        // Take first (shortest name) match
        let mut sorted: Vec<(String, PathBuf)> = results.into_iter().collect();
        sorted.sort_by(|a, b| a.0.len().cmp(&b.0.len()));

        let path = sorted[0].1.clone();
        if path.is_file() {
            Ok(path.parent().unwrap_or(&path).to_path_buf())
        } else {
            Ok(path)
        }
    }

    /// Check if a module exists
    pub fn mod_exists(&self, name: &str) -> bool {
        self.dirpath(name).is_ok()
    }

    /// List all module names — direct scan + tree merge
    pub fn mods(&self, search: Option<&str>) -> Vec<String> {
        let mut names = Vec::new();

        // Direct scan of orbit directories (fast, accurate)
        let orbit_dirs = [
            &self.config.paths.orbit.inner,
            &self.config.paths.orbit.core,
            &self.config.paths.orbit.outer,
        ];
        for orbit_dir in &orbit_dirs {
            if let Ok(entries) = std::fs::read_dir(orbit_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        if let Some(n) = p.file_name().and_then(|f| f.to_str()) {
                            if !n.starts_with('.') {
                                names.push(n.to_string());
                            }
                        }
                    }
                }
            }
        }

        // Also include tree-discovered modules
        let tree = self.tree(None, None, None);
        for name in tree.keys() {
            if !names.contains(name) {
                names.push(name.clone());
            }
        }

        // Apply search filter
        if let Some(s) = search {
            let s = s.to_lowercase();
            names.retain(|n| n.to_lowercase().contains(&s));
        }

        names.sort();
        names.dedup();
        names
    }

    /// Clear all cached trees
    pub fn clear_cache(&self) {
        self.cache.write().clear();
    }

    /// Update/refresh the tree (clear cache and rebuild)
    pub fn update(&self) -> HashMap<String, PathBuf> {
        self.clear_cache();
        self.tree(None, None, None)
    }

    /// Get relative path from home
    pub fn relpath(&self, path: &Path) -> String {
        let home_str = self.config.paths.home.to_string_lossy();
        let path_str = path.to_string_lossy();
        if path_str.starts_with(home_str.as_ref()) {
            format!("~{}", &path_str[home_str.len()..])
        } else {
            path_str.to_string()
        }
    }
}
