//! Configuration management — mirrors Python mod.py config patterns

use crate::error::{ModError, Result};
use crate::store::IpfsConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Orbits and their default search depths (matching Python orbit2depth)
pub const ORBIT_DEPTHS: &[(&str, usize)] = &[
    ("core", 10),
    ("inner", 10),
    ("outer", 5),
];

/// Folders to skip when scanning (matching Python avoid_folders)
pub const AVOID_FOLDERS: &[&str] = &[
    "__pycache__", ".git", ".ipynb_checkpoints", "node_modules",
    "egg-info", "private", ".venv", "venv", ".env", "target",
    ".next", "dist", "build",
];

/// Recognized file types for anchor resolution (matching Python file_types)
pub const FILE_TYPES: &[&str] = &["py", "rs", "ts", "sol"];

/// Anchor file names (matching Python anchor_names)
pub const ANCHOR_NAMES: &[&str] = &["agent", "mod", "block"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub name: String,
    pub version: String,
    pub paths: Paths,
    pub ports: PortConfig,
    pub crypto: CryptoConfig,
    pub store: StoreConfig,
    pub server: ServerConfig,
    #[cfg(feature = "ai")]
    pub ai: Option<AiConfig>,
    pub shortcuts: HashMap<String, String>,
    /// Module search depth per orbit
    #[serde(default = "default_orbit2depth")]
    pub orbit2depth: HashMap<String, usize>,
    /// Folders to avoid when scanning
    #[serde(default = "default_avoid_folders")]
    pub avoid_folders: Vec<String>,
    /// Recognized file types for anchor resolution
    #[serde(default = "default_file_types")]
    pub file_types: Vec<String>,
    /// Anchor file names
    #[serde(default = "default_anchor_names")]
    pub anchor_names: Vec<String>,
    /// Exposed endpoints / routes
    #[serde(default)]
    pub expose: HashMap<String, Vec<String>>,
    /// Port range for servers
    #[serde(default = "default_port_range")]
    pub port_range: (u16, u16),
}

fn default_orbit2depth() -> HashMap<String, usize> {
    ORBIT_DEPTHS.iter().map(|(k, v)| (k.to_string(), *v)).collect()
}

fn default_avoid_folders() -> Vec<String> {
    AVOID_FOLDERS.iter().map(|s| s.to_string()).collect()
}

fn default_file_types() -> Vec<String> {
    FILE_TYPES.iter().map(|s| s.to_string()).collect()
}

fn default_anchor_names() -> Vec<String> {
    ANCHOR_NAMES.iter().map(|s| s.to_string()).collect()
}

fn default_port_range() -> (u16, u16) {
    (8000, 9000)
}

/// Multi-orbit path structure mirroring Python's self.paths['orbit']
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrbitPaths {
    pub inner: PathBuf,   // mod/orbit/
    pub outer: PathBuf,   // mod/orbit/_outer/
    pub core: PathBuf,    // mod/core/
    pub local: PathBuf,   // cwd
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paths {
    pub home: PathBuf,
    pub lib: PathBuf,           // repo root (parent of mod/)
    pub mod_dir: PathBuf,       // mod/ directory
    pub orbit: OrbitPaths,      // multi-orbit paths
    pub store: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortConfig {
    pub range: (u16, u16),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoConfig {
    pub default_algorithm: String,
    pub key_storage_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreConfig {
    pub backend: String,
    pub path: PathBuf,
    pub encrypt_by_default: bool,
    pub ipfs: IpfsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub default_host: String,
    pub cors_enabled: bool,
}

#[cfg(feature = "ai")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: String,
    pub api_key_env: String,
    pub model: Option<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        Self::from_path(&Self::default_config_path()?)
    }

    pub fn from_path(path: &PathBuf) -> Result<Self> {
        if path.exists() {
            let contents = std::fs::read_to_string(path)?;
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            match ext {
                "toml" => toml::from_str(&contents)
                    .map_err(|e| ModError::Config(format!("Failed to parse TOML: {}", e))),
                "json" => serde_json::from_str(&contents)
                    .map_err(|e| ModError::Config(format!("Failed to parse JSON: {}", e))),
                _ => serde_yaml::from_str(&contents)
                    .map_err(|e| ModError::Config(format!("Failed to parse YAML: {}", e))),
            }
        } else {
            Ok(Self::default())
        }
    }

    pub fn default_config_path() -> Result<PathBuf> {
        let home = dirs::home_dir()
            .ok_or_else(|| ModError::Config("Cannot determine home directory".to_string()))?;

        // Check for config in order: mod.toml, mod.yaml, mod.json, then repo config.json
        for name in &["mod.toml", "mod.yaml", "mod.yml", "mod.json"] {
            let path = home.join(".mod").join(name);
            if path.exists() {
                return Ok(path);
            }
        }

        // Check for repo-level config.json (Python pattern)
        if let Ok(cwd) = std::env::current_dir() {
            let repo_config = cwd.join("config.json");
            if repo_config.exists() {
                return Ok(repo_config);
            }
        }

        // Return default location
        Ok(home.join(".mod").join("mod.toml"))
    }

    pub fn save(&self, path: &PathBuf) -> Result<()> {
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        let contents = match ext {
            "toml" => toml::to_string_pretty(self)
                .map_err(|e| ModError::Config(format!("Failed to serialize TOML: {}", e)))?,
            "json" => serde_json::to_string_pretty(self)
                .map_err(|e| ModError::Config(format!("Failed to serialize JSON: {}", e)))?,
            _ => serde_yaml::to_string(self)
                .map_err(|e| ModError::Config(format!("Failed to serialize YAML: {}", e)))?,
        };

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(path, contents)?;
        Ok(())
    }

    pub fn get_port_range(&self) -> (u16, u16) {
        self.port_range
    }

    pub fn orbit_depth(&self, orbit: &str) -> usize {
        self.orbit2depth.get(orbit).copied().unwrap_or(5)
    }

    /// Get the storage directory (~/.mod by default, or ~/.{name})
    pub fn storage_dir(&self) -> PathBuf {
        self.paths.home.join(format!(".{}", self.name))
    }
}

impl Default for Config {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
        let mod_home = home.join(".mod");
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

        // Detect mod_dir and lib from cwd or fallback
        // Python: mod_path = dirname(dirname(__file__)) i.e. mod/
        //         lib_path = dirname(mod_path) i.e. repo root
        let (lib_path, mod_dir) = detect_mod_paths(&cwd);

        Self {
            name: "mod".to_string(),
            version: "0.1.0".to_string(),
            paths: Paths {
                home: home.clone(),
                lib: lib_path.clone(),
                mod_dir: mod_dir.clone(),
                orbit: OrbitPaths {
                    inner: mod_dir.join("orbit"),
                    outer: mod_dir.join("orbit").join("_outer"),
                    core: mod_dir.join("core"),
                    local: cwd,
                },
                store: mod_home.join("store"),
            },
            ports: PortConfig {
                range: (8000, 9000),
            },
            crypto: CryptoConfig {
                default_algorithm: "secp256k1".to_string(),
                key_storage_path: mod_home.join("keys"),
            },
            store: StoreConfig {
                backend: "sqlite".to_string(),
                path: mod_home.join("store"),
                encrypt_by_default: false,
                ipfs: IpfsConfig::default(),
            },
            server: ServerConfig {
                default_host: "0.0.0.0".to_string(),
                cors_enabled: true,
            },
            #[cfg(feature = "ai")]
            ai: Some(AiConfig {
                provider: "openrouter".to_string(),
                api_key_env: "OPENROUTER_API_KEY".to_string(),
                model: Some("anthropic/claude-3.5-sonnet".to_string()),
            }),
            shortcuts: {
                let mut map = HashMap::new();
                map.insert("m".to_string(), "mod".to_string());
                map.insert("c".to_string(), "mod".to_string());
                map
            },
            orbit2depth: default_orbit2depth(),
            avoid_folders: default_avoid_folders(),
            file_types: default_file_types(),
            anchor_names: default_anchor_names(),
            expose: HashMap::new(),
            port_range: (8000, 9000),
        }
    }
}

/// Detect mod paths by looking for the mod/ directory structure
fn detect_mod_paths(cwd: &PathBuf) -> (PathBuf, PathBuf) {
    // Walk up from cwd to find a directory containing mod/core/mod.py or mod/orbit/
    let mut current = cwd.clone();
    for _ in 0..5 {
        let candidate = current.join("mod");
        if candidate.join("core").exists() || candidate.join("orbit").exists() {
            return (current, candidate);
        }
        if !current.pop() {
            break;
        }
    }
    // Fallback
    (cwd.clone(), cwd.join("mod"))
}
