use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Website {
    pub name: String,
    pub target_url: String,
    pub description: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub name: String,
    pub target_url: String,
    pub description: Option<String>,
}

#[derive(Error, Debug)]
pub enum RegistryError {
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Website already exists: {0}")]
    AlreadyExists(String),
}

pub struct WebsiteRegistry {
    websites: Arc<DashMap<String, Website>>,
}

impl WebsiteRegistry {
    pub fn new() -> Self {
        Self {
            websites: Arc::new(DashMap::new()),
        }
    }

    pub async fn register(&self, req: RegisterRequest) -> Result<(), RegistryError> {
        // Validate URL
        Url::parse(&req.target_url)
            .map_err(|e| RegistryError::InvalidUrl(e.to_string()))?;

        // Validate name (alphanumeric and hyphens only)
        if !req
            .name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return Err(RegistryError::InvalidUrl(
                "Name must be alphanumeric with hyphens/underscores only".to_string(),
            ));
        }

        // Check if already exists
        if self.websites.contains_key(&req.name) {
            return Err(RegistryError::AlreadyExists(req.name));
        }

        let website = Website {
            name: req.name.clone(),
            target_url: req.target_url,
            description: req.description,
            created_at: chrono::Utc::now().timestamp(),
        };

        self.websites.insert(req.name, website);

        Ok(())
    }

    pub async fn get(&self, name: &str) -> Option<Website> {
        self.websites.get(name).map(|entry| entry.value().clone())
    }

    pub async fn list(&self) -> Vec<Website> {
        self.websites
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    pub async fn remove(&self, name: &str) -> Option<Website> {
        self.websites.remove(name).map(|(_, website)| website)
    }
}

impl Default for WebsiteRegistry {
    fn default() -> Self {
        Self::new()
    }
}
