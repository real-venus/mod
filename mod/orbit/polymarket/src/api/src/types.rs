use serde::{Deserialize, Serialize};

/// Per-market breakdown of a trader's activity within the analysis window.
/// Stored in memory cache only (`#[serde(skip)]` on parent) — used by
/// `apply_pagination` to recompute aggregate stats when a search/category
/// filter narrows the view to specific markets.
#[derive(Debug, Clone)]
pub struct MarketMetric {
    pub title: String,
    pub volume: f64,
    pub buy_volume: f64,
    pub sell_volume: f64,
    pub pnl: f64,
    pub trades: u32,
    pub wins: u32,
    pub sells: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trader {
    pub address: String,
    pub volume: f64,
    #[serde(rename = "buyVolume")]
    pub buy_volume: f64,
    #[serde(rename = "sellVolume")]
    pub sell_volume: f64,
    pub pnl: f64,
    #[serde(rename = "winRate")]
    pub win_rate: f64,
    pub positions: u32,
    #[serde(rename = "marketTitles")]
    pub market_titles: Vec<String>,
    #[serde(rename = "recentTrades")]
    pub recent_trades: u32,
    #[serde(rename = "pnlCurve", skip_serializing_if = "Option::is_none")]
    pub pnl_curve: Option<Vec<f64>>,
    /// Per-market metrics — memory-only, not serialized to JSON / disk cache.
    #[serde(skip)]
    pub market_metrics: Option<Vec<MarketMetric>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggPayload {
    pub count: usize,
    #[serde(rename = "candidatePool")]
    pub candidate_pool: usize,
    #[serde(rename = "daysWindow")]
    pub days_window: u32,
    #[serde(rename = "minTradesPerDay")]
    pub min_trades_per_day: f64,
    pub traders: Vec<Trader>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "progress")]
    Progress {
        phase: String,
        done: usize,
        total: usize,
        #[serde(skip_serializing_if = "Option::is_none")]
        kept: Option<usize>,
    },
    #[serde(rename = "partial")]
    Partial { traders: Vec<Trader> },
    #[serde(rename = "result")]
    Result {
        source: String,
        count: usize,
        #[serde(rename = "candidatePool")]
        candidate_pool: usize,
        #[serde(rename = "daysWindow")]
        days_window: u32,
        #[serde(rename = "minTradesPerDay")]
        min_trades_per_day: f64,
        traders: Vec<Trader>,
    },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Deserialize)]
pub struct ActiveTradersQuery {
    pub days: Option<u32>,
    #[serde(rename = "minPerDay")]
    pub min_per_day: Option<f64>,
    pub pool: Option<u32>,
    pub stream: Option<String>,
    pub paged: Option<String>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub page: Option<u32>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<u32>,
    pub search: Option<String>,
    pub category: Option<String>,
    #[serde(rename = "minVolume")]
    pub min_volume: Option<f64>,
    #[serde(rename = "minPnl")]
    pub min_pnl: Option<f64>,
    #[serde(rename = "minTrades")]
    pub min_trades: Option<u32>,
    #[serde(rename = "minBuyVolume")]
    pub min_buy_volume: Option<f64>,
    #[serde(rename = "minSellVolume")]
    pub min_sell_volume: Option<f64>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProxyQuery {
    pub endpoint: Option<String>,
}
