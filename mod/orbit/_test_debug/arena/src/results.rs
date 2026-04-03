use crate::evaluator::Score;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use uuid::Uuid;

/// Complete result of a match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchResult {
    pub id: String,
    pub game: String,
    pub agents: Vec<String>,
    pub evaluator: String,
    pub scores: Vec<Score>,
    pub winner: Option<usize>,
    pub history: Value,
    pub final_state: Value,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: u64,
}

impl MatchResult {
    pub fn new(
        game: String,
        agents: Vec<String>,
        evaluator: String,
        scores: Vec<Score>,
        winner: Option<usize>,
        history: Value,
        final_state: Value,
        duration_ms: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            game,
            agents,
            evaluator,
            scores,
            winner,
            history,
            final_state,
            timestamp: Utc::now(),
            duration_ms,
        }
    }
}

/// Storage backend trait
#[async_trait::async_trait]
pub trait Storage: Send + Sync {
    async fn save(&self, result: &MatchResult) -> crate::Result<String>;
    async fn load(&self, id: &str) -> crate::Result<MatchResult>;
    async fn list(&self, limit: usize) -> crate::Result<Vec<MatchResult>>;
    async fn query(&self, game: Option<&str>, agent: Option<&str>) -> crate::Result<Vec<MatchResult>>;
}

/// Local filesystem storage
pub struct LocalStorage {
    path: PathBuf,
}

impl LocalStorage {
    pub fn new(path: PathBuf) -> crate::Result<Self> {
        std::fs::create_dir_all(&path)?;
        Ok(Self { path })
    }

    fn result_path(&self, id: &str) -> PathBuf {
        self.path.join(format!("{}.json", id))
    }
}

#[async_trait::async_trait]
impl Storage for LocalStorage {
    async fn save(&self, result: &MatchResult) -> crate::Result<String> {
        let path = self.result_path(&result.id);
        let json = serde_json::to_string_pretty(result)?;
        tokio::fs::write(&path, json).await?;
        Ok(result.id.clone())
    }

    async fn load(&self, id: &str) -> crate::Result<MatchResult> {
        let path = self.result_path(id);
        let json = tokio::fs::read_to_string(&path).await?;
        let result = serde_json::from_str(&json)?;
        Ok(result)
    }

    async fn list(&self, limit: usize) -> crate::Result<Vec<MatchResult>> {
        let mut results = Vec::new();
        let mut entries = tokio::fs::read_dir(&self.path).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(json) = tokio::fs::read_to_string(entry.path()).await {
                    if let Ok(result) = serde_json::from_str::<MatchResult>(&json) {
                        results.push(result);
                    }
                }
            }
        }

        // Sort by timestamp, newest first
        results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        results.truncate(limit);
        Ok(results)
    }

    async fn query(&self, game: Option<&str>, agent: Option<&str>) -> crate::Result<Vec<MatchResult>> {
        let all = self.list(1000).await?;
        let filtered = all
            .into_iter()
            .filter(|r| {
                let game_match = game.map_or(true, |g| r.game == g);
                let agent_match = agent.map_or(true, |a| r.agents.iter().any(|ag| ag == a));
                game_match && agent_match
            })
            .collect();
        Ok(filtered)
    }
}

/// IPFS storage
#[cfg(feature = "ipfs")]
pub struct IpfsStorage {
    local: LocalStorage,
    client: ipfs_api::IpfsClient,
}

#[cfg(feature = "ipfs")]
impl IpfsStorage {
    pub fn new(path: PathBuf, ipfs_url: &str) -> crate::Result<Self> {
        let local = LocalStorage::new(path)?;
        let client = ipfs_api::IpfsClient::from_str(ipfs_url)
            .map_err(|e| crate::ArenaError::Storage(format!("IPFS client error: {}", e)))?;
        Ok(Self { local, client })
    }
}

#[cfg(feature = "ipfs")]
#[async_trait::async_trait]
impl Storage for IpfsStorage {
    async fn save(&self, result: &MatchResult) -> crate::Result<String> {
        // Save locally first
        self.local.save(result).await?;

        // Upload to IPFS
        let json = serde_json::to_string_pretty(result)?;
        let cursor = std::io::Cursor::new(json.as_bytes());

        let response = self
            .client
            .add(cursor)
            .await
            .map_err(|e| crate::ArenaError::Storage(format!("IPFS add error: {}", e)))?;

        Ok(response.hash)
    }

    async fn load(&self, id: &str) -> crate::Result<MatchResult> {
        // Try local first
        if let Ok(result) = self.local.load(id).await {
            return Ok(result);
        }

        // Try IPFS if local fails (id is CID)
        let bytes = self
            .client
            .cat(id)
            .map_ok(|chunk: Bytes| chunk.to_vec())
            .try_concat()
            .await
            .map_err(|e| crate::ArenaError::Storage(format!("IPFS cat error: {}", e)))?;

        let result = serde_json::from_slice(&bytes)?;
        Ok(result)
    }

    async fn list(&self, limit: usize) -> crate::Result<Vec<MatchResult>> {
        self.local.list(limit).await
    }

    async fn query(&self, game: Option<&str>, agent: Option<&str>) -> crate::Result<Vec<MatchResult>> {
        self.local.query(game, agent).await
    }
}

// Re-export for convenience
#[cfg(feature = "ipfs")]
use futures::TryStreamExt;
#[cfg(feature = "ipfs")]
use ipfs_api::IpfsApi;
#[cfg(feature = "ipfs")]
use bytes::Bytes;
