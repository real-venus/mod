use serde::Deserialize;
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize)]
pub struct EngineConfig {
    pub port: u16,
    pub rpc_url: String,
    pub chain_id: u64,
    pub private_key: Option<String>,
    pub evo_token: String,
    pub hub_exchange: String,
    pub evo_registry: String,
    pub token_factory: String,
    pub log_level: String,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            port: 8420,
            rpc_url: "https://sepolia.base.org".into(),
            chain_id: 84532,
            private_key: None,
            evo_token: String::new(),
            hub_exchange: String::new(),
            evo_registry: String::new(),
            token_factory: String::new(),
            log_level: "info".into(),
        }
    }
}

pub fn load_config() -> EngineConfig {
    // Try config.json first
    let config_paths = [
        PathBuf::from("config.json"),
        PathBuf::from("../config.json"),
    ];

    for path in &config_paths {
        if path.exists() {
            if let Ok(contents) = std::fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                    let engine = json.get("engine").cloned().unwrap_or_default();
                    let contracts = json.get("contracts").cloned().unwrap_or_default();

                    return EngineConfig {
                        port: engine.get("port").and_then(|v| v.as_u64()).unwrap_or(8420) as u16,
                        rpc_url: std::env::var("BASE_TESTNET_RPC_URL")
                            .or_else(|_| std::env::var("RPC_URL"))
                            .unwrap_or_else(|_|
                                engine.get("rpc_url")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("https://sepolia.base.org")
                                    .to_string()
                            ),
                        chain_id: engine.get("chain_id").and_then(|v| v.as_u64()).unwrap_or(84532),
                        private_key: std::env::var("PRIVATE_KEY").ok()
                            .or_else(|| engine.get("private_key").and_then(|v| v.as_str()).map(String::from)),
                        evo_token: contracts.get("EvoToken").and_then(|v| v.get("address")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        hub_exchange: contracts.get("HubExchange").and_then(|v| v.get("address")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        evo_registry: contracts.get("EvoRegistry").and_then(|v| v.get("address")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        token_factory: contracts.get("TokenFactory").and_then(|v| v.get("address")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        log_level: engine.get("log_level").and_then(|v| v.as_str()).unwrap_or("info").to_string(),
                    };
                }
            }
        }
    }

    // Fallback to env vars
    EngineConfig {
        port: std::env::var("PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(8420),
        rpc_url: std::env::var("RPC_URL").unwrap_or_else(|_| "https://sepolia.base.org".into()),
        chain_id: std::env::var("CHAIN_ID").ok().and_then(|v| v.parse().ok()).unwrap_or(84532),
        private_key: std::env::var("PRIVATE_KEY").ok(),
        evo_token: std::env::var("EVO_TOKEN").unwrap_or_default(),
        hub_exchange: std::env::var("HUB_EXCHANGE").unwrap_or_default(),
        evo_registry: std::env::var("EVO_REGISTRY").unwrap_or_default(),
        token_factory: std::env::var("TOKEN_FACTORY").unwrap_or_default(),
        log_level: std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
    }
}
