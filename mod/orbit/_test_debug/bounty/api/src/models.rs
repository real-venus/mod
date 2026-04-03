use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bounty {
    pub id: String,
    pub source: BountySource,
    pub source_id: String,
    pub title: String,
    pub description: String,
    pub url: String,
    pub reward_amount: Option<f64>,
    pub reward_token: Option<String>,
    pub reward_usd: Option<f64>,
    pub status: BountyStatus,
    pub skills: Vec<String>,
    pub chain: Option<String>,
    pub project_name: Option<String>,
    pub deadline: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub scraped_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BountySource {
    Gitcoin,
    Immunefi,
    Github,
    BountyTargets,
}

impl fmt::Display for BountySource {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Gitcoin => write!(f, "gitcoin"),
            Self::Immunefi => write!(f, "immunefi"),
            Self::Github => write!(f, "github"),
            Self::BountyTargets => write!(f, "bountytargets"),
        }
    }
}

impl BountySource {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "gitcoin" => Some(Self::Gitcoin),
            "immunefi" => Some(Self::Immunefi),
            "github" => Some(Self::Github),
            "bountytargets" => Some(Self::BountyTargets),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BountyStatus {
    Open,
    InProgress,
    Completed,
    Expired,
    Unknown,
}

impl fmt::Display for BountyStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Open => write!(f, "open"),
            Self::InProgress => write!(f, "in_progress"),
            Self::Completed => write!(f, "completed"),
            Self::Expired => write!(f, "expired"),
            Self::Unknown => write!(f, "unknown"),
        }
    }
}

impl BountyStatus {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "open" => Self::Open,
            "in_progress" | "inprogress" | "started" => Self::InProgress,
            "completed" | "done" => Self::Completed,
            "expired" => Self::Expired,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceInfo {
    pub name: String,
    pub enabled: bool,
    pub last_scraped: Option<i64>,
    pub bounty_count: u64,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub total_bounties: u64,
    pub open_bounties: u64,
    pub total_value_usd: f64,
    pub by_source: Vec<SourceStats>,
    pub by_chain: Vec<ChainStats>,
    pub top_tokens: Vec<TokenStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceStats {
    pub source: String,
    pub count: u64,
    pub total_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainStats {
    pub chain: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenStats {
    pub token: String,
    pub count: u64,
    pub total_amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct BountyFilters {
    pub source: Option<String>,
    pub token: Option<String>,
    pub min_reward: Option<f64>,
    pub max_reward: Option<f64>,
    pub status: Option<String>,
    pub skills: Option<String>,
    pub chain: Option<String>,
    pub search: Option<String>,
    pub sort: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}
