use serde::{Deserialize, Serialize};

/// Engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub rpc_endpoints: Vec<String>,
    pub health_check_interval_secs: u64,
    pub max_concurrent_requests: usize,
    pub request_timeout_ms: u64,
    pub blocks_per_day: u64,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            rpc_endpoints: vec![
                "wss://entrypoint-finney.opentensor.ai:443".into(),
                "wss://finney.opentensor.ai:443".into(),
                "wss://bittensor-finney.api.onfinality.io/public-ws".into(),
                "wss://finney.rpc.bittensor.com:443".into(),
                "https://entrypoint-finney.opentensor.ai".into(),
                "https://finney.opentensor.ai".into(),
                "https://bittensor-finney.api.onfinality.io/public".into(),
                "https://lite.chain.opentensor.ai".into(),
            ],
            health_check_interval_secs: 30,
            max_concurrent_requests: 8,
            request_timeout_ms: 15000,
            blocks_per_day: 7200,
        }
    }
}

/// Subnet scan result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub netuid: u16,
    pub name: String,
    pub price: f64,
    pub tao_in: f64,
    pub alpha_in: f64,
    pub alpha_out: f64,
    pub emission: f64,
    pub tempo: u16,
    pub owner: String,
    pub n_neurons: u16,
    pub max_n: u16,
    pub market_cap: f64,
    pub volume_24h: f64,
    pub price_change_24h: f64,
}

/// A single staking trade event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeRecord {
    pub block_number: u64,
    pub timestamp: u64,
    pub coldkey: String,
    pub hotkey: String,
    pub netuid: u16,
    pub action: TradeAction,
    pub amount_tao: f64,
    pub extrinsic_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TradeAction {
    Stake,
    Unstake,
    Swap,
    Move,
}

/// Leaderboard entry for top performers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: usize,
    pub coldkey: String,
    pub total_value_tao: f64,
    pub roi_30d: f64,
    pub trade_count: usize,
    pub win_rate: f64,
    pub avg_position_size: f64,
    pub top_subnets: Vec<SubnetPosition>,
    pub pnl_30d: f64,
}

/// Position in a specific subnet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubnetPosition {
    pub netuid: u16,
    pub name: String,
    pub stake: f64,
    pub value_tao: f64,
    pub price: f64,
    pub pnl: f64,
    pub weight: f64,
}

/// RPC endpoint health info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcHealth {
    pub url: String,
    pub latency_ms: u64,
    pub success_count: u64,
    pub error_count: u64,
    pub last_check: u64,
    pub healthy: bool,
}
