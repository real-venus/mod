use std::collections::HashMap;
use std::sync::RwLock;
use chrono::Utc;

use crate::config::ChainConfig;
use crate::types::{ChainId, WhitelistToken};

pub struct WhitelistManager {
    tokens: RwLock<HashMap<ChainId, Vec<WhitelistToken>>>,
    data_path: String,
}

impl WhitelistManager {
    pub fn new(data_path: &str, chain_configs: &HashMap<ChainId, ChainConfig>) -> Self {
        let manager = Self {
            tokens: RwLock::new(HashMap::new()),
            data_path: data_path.to_string(),
        };
        manager.load(chain_configs);
        manager
    }

    fn file_path(&self) -> String {
        format!("{}/whitelist.json", self.data_path)
    }

    fn load(&self, chain_configs: &HashMap<ChainId, ChainConfig>) {
        let path = self.file_path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(loaded) = serde_json::from_str::<HashMap<ChainId, Vec<WhitelistToken>>>(&data) {
                *self.tokens.write().unwrap() = loaded;
                return;
            }
        }

        // Seed defaults from chain configs
        let mut defaults: HashMap<ChainId, Vec<WhitelistToken>> = HashMap::new();
        for (chain_id, config) in chain_configs {
            let tokens: Vec<WhitelistToken> = config.tokens.values().map(|t| WhitelistToken {
                address: t.address.clone(),
                symbol: t.symbol.clone(),
                decimals: t.decimals,
                chain: *chain_id,
                added_at: Utc::now(),
            }).collect();
            defaults.insert(*chain_id, tokens);
        }
        *self.tokens.write().unwrap() = defaults;
        self.save();
    }

    fn save(&self) {
        let tokens = self.tokens.read().unwrap();
        if let Ok(json) = serde_json::to_string_pretty(&*tokens) {
            let _ = std::fs::write(self.file_path(), json);
        }
    }

    pub fn get_whitelist(&self, chain: ChainId) -> Vec<WhitelistToken> {
        self.tokens.read().unwrap()
            .get(&chain)
            .cloned()
            .unwrap_or_default()
    }

    pub fn get_all(&self) -> HashMap<ChainId, Vec<WhitelistToken>> {
        self.tokens.read().unwrap().clone()
    }

    pub fn is_whitelisted(&self, chain: ChainId, address: &str) -> bool {
        let addr = address.to_lowercase();
        self.tokens.read().unwrap()
            .get(&chain)
            .map(|tokens| tokens.iter().any(|t| t.address.to_lowercase() == addr))
            .unwrap_or(false)
    }

    pub fn add_token(&self, chain: ChainId, address: String, symbol: String, decimals: u8) -> WhitelistToken {
        let token = WhitelistToken {
            address,
            symbol,
            decimals,
            chain,
            added_at: Utc::now(),
        };
        let mut tokens = self.tokens.write().unwrap();
        tokens.entry(chain).or_insert_with(Vec::new).push(token.clone());
        drop(tokens);
        self.save();
        token
    }

    pub fn remove_token(&self, chain: ChainId, address: &str) -> bool {
        let addr = address.to_lowercase();
        let mut tokens = self.tokens.write().unwrap();
        if let Some(list) = tokens.get_mut(&chain) {
            let before = list.len();
            list.retain(|t| t.address.to_lowercase() != addr);
            let removed = list.len() < before;
            drop(tokens);
            if removed {
                self.save();
            }
            removed
        } else {
            false
        }
    }

    /// Get symbol for a token address on a chain
    pub fn get_symbol(&self, chain: ChainId, address: &str) -> Option<String> {
        let addr = address.to_lowercase();
        self.tokens.read().unwrap()
            .get(&chain)
            .and_then(|tokens| tokens.iter().find(|t| t.address.to_lowercase() == addr))
            .map(|t| t.symbol.clone())
    }
}
