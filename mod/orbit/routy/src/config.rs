use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_host")]
    pub host: String,

    #[serde(default = "default_port")]
    pub port: u16,

    #[serde(default = "default_max_websites")]
    pub max_websites: usize,

    #[serde(default = "default_cpu_limit")]
    pub cpu_limit_percent: f32,

    #[serde(default = "default_memory_limit")]
    pub memory_limit_mb: usize,

    #[serde(default = "default_enable_monitoring")]
    pub enable_monitoring: bool,
}

fn default_host() -> String {
    "127.0.0.1".to_string()
}

fn default_port() -> u16 {
    3000
}

fn default_max_websites() -> usize {
    50
}

fn default_cpu_limit() -> f32 {
    80.0
}

fn default_memory_limit() -> usize {
    1024
}

fn default_enable_monitoring() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            max_websites: default_max_websites(),
            cpu_limit_percent: default_cpu_limit(),
            memory_limit_mb: default_memory_limit(),
            enable_monitoring: default_enable_monitoring(),
        }
    }
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let config_path = "routy.config.json";

        if let Ok(content) = fs::read_to_string(config_path) {
            let config: Config = serde_json::from_str(&content)?;
            Ok(config)
        } else {
            let config = Config::default();
            // Save default config for reference
            let json = serde_json::to_string_pretty(&config)?;
            fs::write(config_path, json)?;
            Ok(config)
        }
    }
}
