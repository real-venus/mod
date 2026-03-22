//! IPFS content-addressed store — distributed, immutable
//!
//! Talks to a local IPFS daemon via its HTTP API (default: http://127.0.0.1:5001)
//!
//! Operations:
//!   add(data)    → CID       upload content, get back content ID
//!   cat(cid)     → bytes     retrieve content by CID
//!   pin(cid)               pin content so it's not garbage collected
//!   unpin(cid)             unpin content
//!   pins()       → [CID]    list all pinned CIDs
//!   stat(cid)    → info     get object stats (size, links, etc.)
//!   id()         → info     get IPFS node identity

use crate::error::{ModError, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpfsConfig {
    pub endpoint: String,
    pub gateway: String,
    pub pin_by_default: bool,
}

impl Default for IpfsConfig {
    fn default() -> Self {
        Self {
            endpoint: "http://127.0.0.1:5001".to_string(),
            gateway: "http://127.0.0.1:8080".to_string(),
            pin_by_default: true,
        }
    }
}

pub struct IpfsStore {
    client: reqwest::Client,
    config: IpfsConfig,
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddResponse {
    #[serde(rename = "Hash")]
    pub hash: String,
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Size")]
    pub size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatResponse {
    #[serde(rename = "Hash")]
    pub hash: String,
    #[serde(rename = "NumLinks")]
    pub num_links: u64,
    #[serde(rename = "BlockSize")]
    pub block_size: u64,
    #[serde(rename = "LinksSize")]
    pub links_size: u64,
    #[serde(rename = "DataSize")]
    pub data_size: u64,
    #[serde(rename = "CumulativeSize")]
    pub cumulative_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdResponse {
    #[serde(rename = "ID")]
    pub id: String,
    #[serde(rename = "PublicKey")]
    pub public_key: String,
    #[serde(rename = "Addresses")]
    pub addresses: Vec<String>,
    #[serde(rename = "AgentVersion")]
    pub agent_version: String,
    #[serde(rename = "ProtocolVersion")]
    pub protocol_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PinLsResponse {
    #[serde(rename = "Keys")]
    keys: std::collections::HashMap<String, PinInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PinInfo {
    #[serde(rename = "Type")]
    pin_type: String,
}

// ============================================================================
// IPFS STORE
// ============================================================================

impl IpfsStore {
    pub fn new(config: &IpfsConfig) -> Self {
        Self {
            client: reqwest::Client::new(),
            config: config.clone(),
        }
    }

    fn api_url(&self, path: &str) -> String {
        format!("{}/api/v0/{}", self.config.endpoint, path)
    }

    fn gateway_url(&self, cid: &str) -> String {
        format!("{}/ipfs/{}", self.config.gateway, cid)
    }

    fn ipfs_err(msg: impl Into<String>) -> ModError {
        ModError::Ipfs(msg.into())
    }

    // ========================================================================
    // CORE OPERATIONS
    // ========================================================================

    /// Add content to IPFS, returns the CID
    pub async fn add(&self, data: &[u8]) -> Result<String> {
        let form = reqwest::multipart::Form::new()
            .part("file", reqwest::multipart::Part::bytes(data.to_vec()).file_name("data"));

        let url = if self.config.pin_by_default {
            self.api_url("add?pin=true")
        } else {
            self.api_url("add?pin=false")
        };

        let resp = self.client
            .post(&url)
            .multipart(form)
            .send()
            .await
            .map_err(|e| Self::ipfs_err(format!("add failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Self::ipfs_err(format!("add returned {}: {}", status, body)));
        }

        let add_resp: AddResponse = resp.json().await
            .map_err(|e| Self::ipfs_err(format!("failed to parse add response: {}", e)))?;

        Ok(add_resp.hash)
    }

    /// Add a string to IPFS, returns the CID
    pub async fn add_str(&self, content: &str) -> Result<String> {
        self.add(content.as_bytes()).await
    }

    /// Add JSON to IPFS, returns the CID
    pub async fn add_json<T: Serialize>(&self, value: &T) -> Result<String> {
        let bytes = serde_json::to_vec(value)?;
        self.add(&bytes).await
    }

    /// Retrieve content by CID
    pub async fn cat(&self, cid: &str) -> Result<Vec<u8>> {
        let resp = self.client
            .post(&self.api_url(&format!("cat?arg={}", cid)))
            .send()
            .await
            .map_err(|e| Self::ipfs_err(format!("cat failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Self::ipfs_err(format!("cat returned {}: {}", status, body)));
        }

        resp.bytes().await
            .map(|b| b.to_vec())
            .map_err(|e| Self::ipfs_err(format!("failed to read cat response: {}", e)))
    }

    /// Retrieve content as string
    pub async fn cat_str(&self, cid: &str) -> Result<String> {
        let bytes = self.cat(cid).await?;
        String::from_utf8(bytes)
            .map_err(|e| Self::ipfs_err(format!("content is not valid UTF-8: {}", e)))
    }

    /// Retrieve and deserialize JSON content
    pub async fn cat_json<T: serde::de::DeserializeOwned>(&self, cid: &str) -> Result<T> {
        let bytes = self.cat(cid).await?;
        serde_json::from_slice(&bytes).map_err(Into::into)
    }

    // ========================================================================
    // PIN OPERATIONS
    // ========================================================================

    /// Pin content so it persists across garbage collection
    pub async fn pin(&self, cid: &str) -> Result<()> {
        let resp = self.client
            .post(&self.api_url(&format!("pin/add?arg={}", cid)))
            .send()
            .await
            .map_err(|e| Self::ipfs_err(format!("pin failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Self::ipfs_err(format!("pin returned {}: {}", status, body)));
        }

        Ok(())
    }

    /// Unpin content
    pub async fn unpin(&self, cid: &str) -> Result<()> {
        let resp = self.client
            .post(&self.api_url(&format!("pin/rm?arg={}", cid)))
            .send()
            .await
            .map_err(|e| Self::ipfs_err(format!("unpin failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Self::ipfs_err(format!("unpin returned {}: {}", status, body)));
        }

        Ok(())
    }

    /// List all pinned CIDs
    pub async fn pins(&self) -> Result<Vec<String>> {
        let resp = self.client
            .post(&self.api_url("pin/ls?type=all"))
            .send()
            .await
            .map_err(|e| Self::ipfs_err(format!("pin ls failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Self::ipfs_err(format!("pin ls returned {}: {}", status, body)));
        }

        let pin_resp: PinLsResponse = resp.json().await
            .map_err(|e| Self::ipfs_err(format!("failed to parse pin ls response: {}", e)))?;

        Ok(pin_resp.keys.into_keys().collect())
    }

    // ========================================================================
    // INFO OPERATIONS
    // ========================================================================

    /// Get object stats (size, links, etc.)
    pub async fn stat(&self, cid: &str) -> Result<StatResponse> {
        let resp = self.client
            .post(&self.api_url(&format!("object/stat?arg={}", cid)))
            .send()
            .await
            .map_err(|e| Self::ipfs_err(format!("stat failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Self::ipfs_err(format!("stat returned {}: {}", status, body)));
        }

        resp.json().await
            .map_err(|e| Self::ipfs_err(format!("failed to parse stat response: {}", e)))
    }

    /// Get IPFS node identity
    pub async fn id(&self) -> Result<IdResponse> {
        let resp = self.client
            .post(&self.api_url("id"))
            .send()
            .await
            .map_err(|e| Self::ipfs_err(format!("id failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Self::ipfs_err(format!("id returned {}: {}", status, body)));
        }

        resp.json().await
            .map_err(|e| Self::ipfs_err(format!("failed to parse id response: {}", e)))
    }

    /// Check if IPFS daemon is reachable
    pub async fn is_online(&self) -> bool {
        self.id().await.is_ok()
    }

    /// Get the gateway URL for a CID (for browser access)
    pub fn url(&self, cid: &str) -> String {
        self.gateway_url(cid)
    }

    /// Get the endpoint this store is connected to
    pub fn endpoint(&self) -> &str {
        &self.config.endpoint
    }
}
