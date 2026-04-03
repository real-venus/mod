use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapEvent {
    pub chain_id: u64,
    pub tx_hash: String,
    pub block_number: u64,
    pub timestamp: u64,
    pub trader: String,
    pub pool: String,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: String,
    pub amount_out: String,
    pub dex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraderScore {
    pub address: String,
    pub pnl_1h: f64,
    pub pnl_24h: f64,
    pub pnl_7d: f64,
    pub win_rate: f64,
    pub trade_count: u64,
    pub volume_usd: f64,
    pub last_trade: u64,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeRecord {
    pub timestamp: u64,
    pub chain_id: u64,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: String,
    pub amount_out: String,
    pub tx_hash: String,
    pub usd_value: f64,
    pub pnl_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub name: String,
    pub enabled: bool,
    pub rpc_urls: Vec<String>,
    pub routers: Vec<RouterConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterConfig {
    pub address: String,
    pub name: String,
    #[serde(rename = "type")]
    pub dex_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub chains: Vec<ChainConfig>,
    pub wallets: Vec<WalletEntry>,
    #[serde(default = "default_max_trade")]
    pub max_trade_usd: f64,
    #[serde(default = "default_slippage")]
    pub slippage_bps: u64,
    #[serde(default = "default_daily_limit")]
    pub daily_limit_usd: f64,
    #[serde(default = "default_min_score")]
    pub min_score: f64,
    #[serde(default = "default_min_trades")]
    pub min_trades: u64,
    #[serde(default = "default_poll_interval")]
    pub poll_interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum WalletEntry {
    Simple(String),
    Labeled { address: String, label: String },
}

impl WalletEntry {
    pub fn address(&self) -> &str {
        match self {
            WalletEntry::Simple(a) => a,
            WalletEntry::Labeled { address, .. } => address,
        }
    }
    pub fn label(&self) -> &str {
        match self {
            WalletEntry::Simple(a) => a,
            WalletEntry::Labeled { label, .. } => label,
        }
    }
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            chains: Vec::new(),
            wallets: Vec::new(),
            max_trade_usd: 100.0,
            slippage_bps: 50,
            daily_limit_usd: 1000.0,
            min_score: 70.0,
            min_trades: 5,
            poll_interval_ms: 4000,
        }
    }
}

fn default_max_trade() -> f64 { 100.0 }
fn default_slippage() -> u64 { 50 }
fn default_daily_limit() -> f64 { 1000.0 }
fn default_min_score() -> f64 { 70.0 }
fn default_min_trades() -> u64 { 5 }
fn default_poll_interval() -> u64 { 4000 }

/// Scan result for a single trader
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraderResult {
    pub address: String,
    pub chains: Vec<String>,
    pub pnl_usd: f64,
    pub pnl_pct: f64,
    pub trade_count: u64,
    pub total_swaps: u64,
    pub win_rate: f64,
    pub volume_usd: f64,
    pub tokens_traded: Vec<String>,
    pub first_trade: String,
    pub last_trade: String,
    pub score: f64,
}

/// Poll result from direct RPC scan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollResult {
    pub chain: String,
    pub chain_id: u64,
    pub from_block: u64,
    pub to_block: u64,
    pub v2_events: u64,
    pub v3_events: u64,
    pub unique_traders: Vec<String>,
}
