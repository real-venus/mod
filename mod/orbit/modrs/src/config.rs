//! Configuration management

use crate::error::{ModError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub name: String,
    pub version: String,
    pub paths: Paths,
    pub ports: PortConfig,
    pub crypto: CryptoConfig,
    pub storage: StorageConfig,
    pub server: ServerConfig,
    #[cfg(feature = "ai")]
    pub ai: Option<AiConfig>,
    pub shortcuts: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paths {
    pub home: PathBuf,
    pub lib: PathBuf,
    pub mod_dir: PathBuf,
    pub orbit: PathBuf,
    pub storage: PathBuf,
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
pub struct StorageConfig {
    pub backend: String,
    pub path: PathBuf,
    pub encrypt_by_default: bool,
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
            if path.extension().and_then(|s| s.to_str()) == Some("toml") {
                toml::from_str(&contents)
                    .map_err(|e| ModError::Config(format!("Failed to parse TOML: {}", e)))
            } else {
                serde_yaml::from_str(&contents)
                    .map_err(|e| ModError::Config(format!("Failed to parse YAML: {}", e)))
            }
        } else {
            Ok(Self::default())
        }
    }

    pub fn default_config_path() -> Result<PathBuf> {
        let home = dirs::home_dir()
            .ok_or_else(|| ModError::Config("Cannot determine home directory".to_string()))?;

        // Check for config in order: mod.toml, mod.yaml, mod.json
        for name in &["mod.toml", "mod.yaml", "mod.yml", "mod.json"] {
            let path = home.join(".mod").join(name);
            if path.exists() {
                return Ok(path);
            }
        }

        // Return default location
        Ok(home.join(".mod").join("mod.toml"))
    }

    pub fn save(&self, path: &PathBuf) -> Result<()> {
        let contents = if path.extension().and_then(|s| s.to_str()) == Some("toml") {
            toml::to_string_pretty(self)
                .map_err(|e| ModError::Config(format!("Failed to serialize TOML: {}", e)))?
        } else {
            serde_yaml::to_string(self)
                .map_err(|e| ModError::Config(format!("Failed to serialize YAML: {}", e)))?
        };

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(path, contents)?;
        Ok(())
    }
}

impl Default for Config {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
        let mod_home = home.join(".mod");

        Self {
            name: "mod".to_string(),
            version: "0.1.0".to_string(),
            paths: Paths {
                home: home.clone(),
                lib: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
                mod_dir: mod_home.clone(),
                orbit: mod_home.join("orbit"),
                storage: mod_home.join("storage"),
            },
            ports: PortConfig {
                range: (8000, 9000),
            },
            crypto: CryptoConfig {
                default_algorithm: "secp256k1".to_string(),
                key_storage_path: mod_home.join("keys"),
            },
            storage: StorageConfig {
                backend: "sqlite".to_string(),
                path: mod_home.join("storage"),
                encrypt_by_default: false,
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
        }
    }
}

// Need to add toml dependency
use serde_with::serde_as;

impl Config {
    pub fn get_port_range(&self) -> (u16, u16) {
        self.ports.range
    }
}
