//! IPFS integration

use crate::config::Config;
use crate::error::{ModError, Result};

pub struct Client {
    endpoint: String,
}

impl Client {
    pub fn new(_config: &Config) -> Result<Self> {
        Ok(Self {
            endpoint: "http://127.0.0.1:5001".to_string(),
        })
    }

    pub async fn put(&self, data: &[u8]) -> Result<String> {
        // IPFS implementation would go here
        Err(ModError::Unknown("IPFS not yet fully implemented".to_string()))
    }

    pub async fn get(&self, _cid: &str) -> Result<Vec<u8>> {
        // IPFS implementation would go here
        Err(ModError::Unknown("IPFS not yet fully implemented".to_string()))
    }
}
