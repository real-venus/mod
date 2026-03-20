use std::time::{SystemTime, UNIX_EPOCH};

use dashmap::DashMap;
use tracing::debug;

use crate::types::{SwapEvent, TradeRecord, TraderScore};

pub struct TraderScorer {
    /// address -> trade records
    trade_history: DashMap<String, Vec<TradeRecord>>,
    /// address -> computed score
    scores: DashMap<String, TraderScore>,
}

impl TraderScorer {
    pub fn new() -> Self {
        Self {
            trade_history: DashMap::new(),
            scores: DashMap::new(),
        }
    }

    /// Record a swap event
    pub fn record_trade(&self, event: &SwapEvent) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let record = TradeRecord {
            timestamp: if event.timestamp > 0 { event.timestamp } else { now },
            chain_id: event.chain_id,
            token_in: event.token_in.clone(),
            token_out: event.token_out.clone(),
            amount_in: event.amount_in.clone(),
            amount_out: event.amount_out.clone(),
            tx_hash: event.tx_hash.clone(),
            usd_value: 0.0,
            pnl_usd: 0.0,
        };

        self.trade_history
            .entry(event.trader.clone())
            .or_insert_with(Vec::new)
            .push(record);

        self.compute_score(&event.trader);
    }

    /// Batch-record events
    pub fn record_batch(&self, events: &[SwapEvent]) {
        for event in events {
            self.record_trade(event);
        }
    }

    /// Compute rolling score for a trader
    fn compute_score(&self, address: &str) {
        let trades = match self.trade_history.get(address) {
            Some(t) => t.clone(),
            None => return,
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let hour_ago = now.saturating_sub(3600);
        let day_ago = now.saturating_sub(86400);
        let week_ago = now.saturating_sub(604800);

        let trades_1h: Vec<&TradeRecord> = trades.iter().filter(|t| t.timestamp >= hour_ago).collect();
        let trades_24h: Vec<&TradeRecord> = trades.iter().filter(|t| t.timestamp >= day_ago).collect();
        let trades_7d: Vec<&TradeRecord> = trades.iter().filter(|t| t.timestamp >= week_ago).collect();

        let pnl_1h: f64 = trades_1h.iter().map(|t| t.pnl_usd).sum();
        let pnl_24h: f64 = trades_24h.iter().map(|t| t.pnl_usd).sum();
        let pnl_7d: f64 = trades_7d.iter().map(|t| t.pnl_usd).sum();

        let total_trades = trades_7d.len() as u64;
        let winning = trades_7d.iter().filter(|t| t.pnl_usd > 0.0).count() as f64;
        let win_rate = if total_trades > 0 { winning / total_trades as f64 } else { 0.0 };

        let volume: f64 = trades_7d.iter().map(|t| t.usd_value).sum();

        // Consistency via stddev
        let avg_pnl = if !trades_7d.is_empty() { pnl_7d / trades_7d.len() as f64 } else { 0.0 };
        let variance: f64 = if trades_7d.len() > 1 {
            trades_7d.iter().map(|t| (t.pnl_usd - avg_pnl).powi(2)).sum::<f64>()
                / (trades_7d.len() - 1) as f64
        } else { 0.0 };
        let std_dev = variance.sqrt();
        let consistency = if std_dev > 0.0 { (1.0 / (1.0 + std_dev / 100.0)).min(1.0) } else { 1.0 };

        // Composite score
        let norm_pnl_24h = 50.0 * (1.0 + (pnl_24h / 1000.0).tanh());
        let norm_pnl_7d = 50.0 * (1.0 + (pnl_7d / 5000.0).tanh());
        let norm_win_rate = win_rate * 100.0;
        let norm_consistency = consistency * 100.0;

        let score = norm_pnl_24h * 0.4 + norm_pnl_7d * 0.3 + norm_win_rate * 0.2 + norm_consistency * 0.1;

        let last_trade = trades.last().map(|t| t.timestamp).unwrap_or(0);

        let trader_score = TraderScore {
            address: address.to_string(),
            pnl_1h,
            pnl_24h,
            pnl_7d,
            win_rate,
            trade_count: total_trades,
            volume_usd: volume,
            last_trade,
            score,
        };

        debug!("{} score: {:.1} (pnl_24h={:.2}, win={:.0}%, trades={})",
            address, score, pnl_24h, win_rate * 100.0, total_trades);

        self.scores.insert(address.to_string(), trader_score);
    }

    /// Get all scores sorted by score descending
    pub fn get_scores(&self) -> Vec<TraderScore> {
        let mut scores: Vec<TraderScore> = self.scores.iter()
            .map(|e| e.value().clone())
            .collect();
        scores.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scores
    }

    /// Get score for specific trader
    pub fn get_score(&self, address: &str) -> Option<TraderScore> {
        self.scores.get(address).map(|v| v.clone())
    }

    /// Get trade history for a trader
    pub fn get_trades(&self, address: &str, limit: usize) -> Vec<TradeRecord> {
        match self.trade_history.get(address) {
            Some(trades) => {
                let len = trades.len();
                let start = len.saturating_sub(limit);
                trades[start..].to_vec()
            }
            None => Vec::new(),
        }
    }

    /// Get all recent trades across all traders
    pub fn get_all_trades(&self, limit: usize) -> Vec<TradeRecord> {
        let mut all: Vec<TradeRecord> = Vec::new();
        for entry in self.trade_history.iter() {
            all.extend(entry.value().clone());
        }
        all.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        all.truncate(limit);
        all
    }

    /// Count total tracked traders
    pub fn trader_count(&self) -> usize {
        self.scores.len()
    }
}
