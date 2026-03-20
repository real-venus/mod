use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChainId {
    Base,
    Polygon,
}

impl ChainId {
    pub fn id(&self) -> u64 {
        match self {
            ChainId::Base => 8453,
            ChainId::Polygon => 137,
        }
    }

    pub fn name(&self) -> &str {
        match self {
            ChainId::Base => "base",
            ChainId::Polygon => "polygon",
        }
    }

    pub fn explorer(&self) -> &str {
        match self {
            ChainId::Base => "https://basescan.org",
            ChainId::Polygon => "https://polygonscan.com",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "base" => Some(ChainId::Base),
            "polygon" | "matic" => Some(ChainId::Polygon),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub symbol: String,
    pub address: String,
    pub decimals: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolInfo {
    pub name: String,
    pub address: String,
    pub token0: String,
    pub token1: String,
    pub fee: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolState {
    pub address: String,
    pub chain: ChainId,
    pub sqrt_price_x96: String,
    pub tick: i32,
    pub liquidity: String,
    pub price: f64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResult {
    pub chain: ChainId,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: String,
    pub amount_out: String,
    pub price_impact: f64,
    pub gas_estimate: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StrategyKind {
    Dca,
    LimitOrder,
    RangeLp,
    Momentum,
    Arb,
    Rebalance,
    CopyTrade,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StrategyStatus {
    Active,
    Paused,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyRecord {
    pub id: Uuid,
    pub kind: StrategyKind,
    pub chain: ChainId,
    pub status: StrategyStatus,
    pub config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub executions: Vec<StrategyExecution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyExecution {
    pub timestamp: DateTime<Utc>,
    pub action: String,
    pub result: String,
    pub tx_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStrategyRequest {
    pub kind: StrategyKind,
    pub chain: ChainId,
    pub config: serde_json::Value,
}

// --- Copy Trading Types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchedWallet {
    pub address: String,
    pub nickname: Option<String>,
    pub added_at: DateTime<Utc>,
    pub last_synced: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletTrade {
    pub wallet: String,
    pub chain: ChainId,
    pub tx_hash: String,
    pub block_number: u64,
    pub timestamp: DateTime<Utc>,
    pub token_in: String,
    pub token_in_symbol: String,
    pub token_out: String,
    pub token_out_symbol: String,
    pub amount_in: String,
    pub amount_out: String,
    pub pool: String,
    pub fee: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletPerformance {
    pub wallet: String,
    pub total_trades: u32,
    pub tokens_bought: Vec<TokenSummary>,
    pub tokens_sold: Vec<TokenSummary>,
    pub most_traded: Vec<String>,
    pub avg_trade_size_usd: f64,
    pub total_volume_usd: f64,
    pub first_trade: Option<DateTime<Utc>>,
    pub last_trade: Option<DateTime<Utc>>,
    pub active_days: u32,
    pub trades_per_day: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenSummary {
    pub symbol: String,
    pub address: String,
    pub total_amount: String,
    pub trade_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhitelistToken {
    pub address: String,
    pub symbol: String,
    pub decimals: u8,
    pub chain: ChainId,
    pub added_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddWalletRequest {
    pub address: String,
    pub nickname: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddWhitelistRequest {
    pub chain: String,
    pub address: String,
    pub symbol: String,
    pub decimals: u8,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TradesQuery {
    pub chain: Option<String>,
    pub days: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub chains: Vec<ChainHealth>,
}

#[derive(Debug, Serialize)]
pub struct ChainHealth {
    pub chain: ChainId,
    pub connected: bool,
    pub block_number: Option<u64>,
}

// --- Top Traders Discovery Types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopTrader {
    pub rank: u32,
    pub address: String,
    pub trade_count: u32,
    pub total_volume_usd: f64,
    pub most_traded: Vec<String>,
    pub last_active: DateTime<Utc>,
    pub first_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryScanStatus {
    pub scanning: bool,
    pub chain: Option<ChainId>,
    pub days: Option<u32>,
    pub blocks_scanned: u64,
    pub blocks_total: u64,
    pub progress_pct: f64,
    pub wallets_found: u32,
    pub started_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopTradersCache {
    pub chain: ChainId,
    pub days: u32,
    pub scanned_at: DateTime<Utc>,
    pub from_block: u64,
    pub to_block: u64,
    pub traders: Vec<TopTrader>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScanRequest {
    pub chain: String,
    pub days: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TopTradersQuery {
    pub chain: String,
    pub days: Option<u32>,
    pub limit: Option<u32>,
}
