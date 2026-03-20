use std::collections::HashMap;
use std::sync::Arc;
use alloy::providers::RootProvider;
use alloy::network::Ethereum;
use crate::config::ChainConfig;
use crate::types::ChainId;

pub type Provider = RootProvider<Ethereum>;

pub struct ChainManager {
    providers: HashMap<ChainId, Arc<Provider>>,
    configs: HashMap<ChainId, ChainConfig>,
}

impl ChainManager {
    pub fn new(configs: HashMap<ChainId, ChainConfig>) -> eyre::Result<Self> {
        let mut providers = HashMap::new();

        for (chain_id, config) in &configs {
            let url: reqwest::Url = config.rpc_url.parse()
                .map_err(|e| eyre::eyre!("Invalid RPC URL for {}: {}", chain_id.name(), e))?;
            let provider = RootProvider::new_http(url);
            providers.insert(*chain_id, Arc::new(provider));
        }

        Ok(Self { providers, configs })
    }

    pub fn provider(&self, chain: &ChainId) -> Option<Arc<Provider>> {
        self.providers.get(chain).cloned()
    }

    pub fn config(&self, chain: &ChainId) -> Option<&ChainConfig> {
        self.configs.get(chain)
    }

    pub fn chains(&self) -> Vec<ChainId> {
        self.configs.keys().copied().collect()
    }

    pub fn all_configs(&self) -> &HashMap<ChainId, ChainConfig> {
        &self.configs
    }
}
