use anyhow::{anyhow, Result};
use rusqlite::{Connection, params};
use std::sync::Arc;
use parking_lot::Mutex;
use reqwest::Client;
use serde_json::Value;
use tracing::{info, warn, error};

use crate::types::{PricePoint, TradeRecord, ScraperStatus};

const CLOB_BASE: &str = "https://clob.polymarket.com";
const GAMMA_BASE: &str = "https://gamma-api.polymarket.com";

/// SQLite-backed history store for backtesting
pub struct HistoryStore {
    db: Arc<Mutex<Connection>>,
}

impl HistoryStore {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                price REAL NOT NULL,
                token_id TEXT NOT NULL,
                condition_id TEXT NOT NULL,
                source TEXT DEFAULT 'clob'
            );

            CREATE TABLE IF NOT EXISTS trade_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                token_id TEXT NOT NULL,
                condition_id TEXT NOT NULL,
                side TEXT NOT NULL,
                price REAL NOT NULL,
                size REAL NOT NULL,
                maker TEXT,
                taker TEXT,
                tx_hash TEXT,
                source TEXT DEFAULT 'clob'
            );

            CREATE TABLE IF NOT EXISTS market_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                condition_id TEXT NOT NULL,
                question TEXT,
                outcomes TEXT,
                outcome_prices TEXT,
                volume TEXT,
                liquidity TEXT,
                best_bid TEXT,
                best_ask TEXT,
                spread TEXT,
                open_interest TEXT,
                data TEXT
            );

            CREATE TABLE IF NOT EXISTS orderbook_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                token_id TEXT NOT NULL,
                condition_id TEXT NOT NULL,
                best_bid REAL,
                best_ask REAL,
                spread REAL,
                bid_depth REAL,
                ask_depth REAL,
                bids TEXT,
                asks TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_price_ts ON price_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_price_cid ON price_history(condition_id);
            CREATE INDEX IF NOT EXISTS idx_price_tid ON price_history(token_id);
            CREATE INDEX IF NOT EXISTS idx_trade_ts ON trade_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_trade_cid ON trade_history(condition_id);
            CREATE INDEX IF NOT EXISTS idx_snap_ts ON market_snapshots(timestamp);
            CREATE INDEX IF NOT EXISTS idx_snap_cid ON market_snapshots(condition_id);
            CREATE INDEX IF NOT EXISTS idx_ob_ts ON orderbook_snapshots(timestamp);
            CREATE INDEX IF NOT EXISTS idx_ob_tid ON orderbook_snapshots(token_id);
        ")?;

        Ok(Self { db: Arc::new(Mutex::new(conn)) })
    }

    // ─── Write Operations ───

    pub fn save_price(&self, point: &PricePoint) -> Result<()> {
        let db = self.db.lock();
        db.execute(
            "INSERT INTO price_history (timestamp, price, token_id, condition_id) VALUES (?1, ?2, ?3, ?4)",
            params![point.timestamp, point.price, point.token_id, point.condition_id],
        )?;
        Ok(())
    }

    pub fn save_prices_batch(&self, points: &[PricePoint]) -> Result<()> {
        let db = self.db.lock();
        let mut stmt = db.prepare(
            "INSERT INTO price_history (timestamp, price, token_id, condition_id) VALUES (?1, ?2, ?3, ?4)"
        )?;
        for p in points {
            stmt.execute(params![p.timestamp, p.price, p.token_id, p.condition_id])?;
        }
        Ok(())
    }

    pub fn save_trade(&self, trade: &TradeRecord) -> Result<()> {
        let db = self.db.lock();
        db.execute(
            "INSERT INTO trade_history (timestamp, token_id, condition_id, side, price, size, maker, taker, tx_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![trade.timestamp, trade.token_id, trade.condition_id, trade.side, trade.price, trade.size, trade.maker, trade.taker, trade.tx_hash],
        )?;
        Ok(())
    }

    pub fn save_trades_batch(&self, trades: &[TradeRecord]) -> Result<()> {
        let db = self.db.lock();
        let mut stmt = db.prepare(
            "INSERT INTO trade_history (timestamp, token_id, condition_id, side, price, size, maker, taker, tx_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
        )?;
        for t in trades {
            stmt.execute(params![t.timestamp, t.token_id, t.condition_id, t.side, t.price, t.size, t.maker, t.taker, t.tx_hash])?;
        }
        Ok(())
    }

    pub fn save_market_snapshot(&self, timestamp: i64, condition_id: &str, data: &Value) -> Result<()> {
        let db = self.db.lock();
        db.execute(
            "INSERT INTO market_snapshots (timestamp, condition_id, question, outcomes, outcome_prices, volume, liquidity, best_bid, best_ask, spread, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                timestamp,
                condition_id,
                data.get("question").and_then(|q| q.as_str()),
                data.get("outcomes").map(|o| o.to_string()),
                data.get("outcomePrices").or_else(|| data.get("outcome_prices")).map(|o| o.to_string()),
                data.get("volume").and_then(|v| v.as_str()),
                data.get("liquidity").and_then(|l| l.as_str()),
                data.get("bestBid").or_else(|| data.get("best_bid")).and_then(|b| b.as_str()),
                data.get("bestAsk").or_else(|| data.get("best_ask")).and_then(|a| a.as_str()),
                data.get("spread").and_then(|s| s.as_str()),
                serde_json::to_string(data).ok(),
            ],
        )?;
        Ok(())
    }

    pub fn save_orderbook_snapshot(
        &self, timestamp: i64, token_id: &str, condition_id: &str,
        best_bid: f64, best_ask: f64, bids: &Value, asks: &Value,
    ) -> Result<()> {
        let bid_depth: f64 = bids.as_array().map(|arr| {
            arr.iter().filter_map(|b| b.get("size").and_then(|s| s.as_str()).and_then(|s| s.parse::<f64>().ok())).sum()
        }).unwrap_or(0.0);
        let ask_depth: f64 = asks.as_array().map(|arr| {
            arr.iter().filter_map(|a| a.get("size").and_then(|s| s.as_str()).and_then(|s| s.parse::<f64>().ok())).sum()
        }).unwrap_or(0.0);

        let db = self.db.lock();
        db.execute(
            "INSERT INTO orderbook_snapshots (timestamp, token_id, condition_id, best_bid, best_ask, spread, bid_depth, ask_depth, bids, asks) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                timestamp, token_id, condition_id, best_bid, best_ask,
                best_ask - best_bid, bid_depth, ask_depth,
                serde_json::to_string(bids).ok(),
                serde_json::to_string(asks).ok(),
            ],
        )?;
        Ok(())
    }

    // ─── Read Operations ───

    pub fn get_prices(
        &self, condition_id: &str, start: i64, end: i64,
    ) -> Result<Vec<PricePoint>> {
        let db = self.db.lock();
        let mut stmt = db.prepare(
            "SELECT timestamp, price, token_id, condition_id FROM price_history WHERE condition_id = ?1 AND timestamp >= ?2 AND timestamp <= ?3 ORDER BY timestamp"
        )?;
        let rows = stmt.query_map(params![condition_id, start, end], |row| {
            Ok(PricePoint {
                timestamp: row.get(0)?,
                price: row.get(1)?,
                token_id: row.get(2)?,
                condition_id: row.get(3)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_trades_history(
        &self, condition_id: &str, start: i64, end: i64,
    ) -> Result<Vec<TradeRecord>> {
        let db = self.db.lock();
        let mut stmt = db.prepare(
            "SELECT timestamp, token_id, condition_id, side, price, size, maker, taker, tx_hash FROM trade_history WHERE condition_id = ?1 AND timestamp >= ?2 AND timestamp <= ?3 ORDER BY timestamp"
        )?;
        let rows = stmt.query_map(params![condition_id, start, end], |row| {
            Ok(TradeRecord {
                timestamp: row.get(0)?,
                token_id: row.get(1)?,
                condition_id: row.get(2)?,
                side: row.get(3)?,
                price: row.get(4)?,
                size: row.get(5)?,
                maker: row.get(6)?,
                taker: row.get(7)?,
                tx_hash: row.get(8)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_market_snapshots(
        &self, condition_id: &str, start: i64, end: i64,
    ) -> Result<Vec<Value>> {
        let db = self.db.lock();
        let mut stmt = db.prepare(
            "SELECT data FROM market_snapshots WHERE condition_id = ?1 AND timestamp >= ?2 AND timestamp <= ?3 ORDER BY timestamp"
        )?;
        let rows = stmt.query_map(params![condition_id, start, end], |row| {
            let data: String = row.get(0)?;
            Ok(serde_json::from_str(&data).unwrap_or(Value::Null))
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_all_condition_ids(&self) -> Result<Vec<String>> {
        let db = self.db.lock();
        let mut stmt = db.prepare(
            "SELECT DISTINCT condition_id FROM price_history UNION SELECT DISTINCT condition_id FROM trade_history"
        )?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn stats(&self) -> Result<ScraperStatus> {
        let db = self.db.lock();
        let price_count: usize = db.query_row(
            "SELECT COUNT(*) FROM price_history", [], |row| row.get(0)
        )?;
        let trade_count: usize = db.query_row(
            "SELECT COUNT(*) FROM trade_history", [], |row| row.get(0)
        )?;
        let market_count: usize = db.query_row(
            "SELECT COUNT(DISTINCT condition_id) FROM price_history", [], |row| row.get(0)
        )?;
        let last_ts: Option<i64> = db.query_row(
            "SELECT MAX(timestamp) FROM price_history", [], |row| row.get(0)
        ).ok();

        Ok(ScraperStatus {
            running: false, // will be set by the scraper
            markets_tracked: market_count,
            total_price_points: price_count,
            total_trades_saved: trade_count,
            last_scrape: last_ts.map(|ts| {
                chrono::DateTime::from_timestamp(ts, 0)
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            }),
            errors: 0,
        })
    }
}

// ─── Background Scraper ───

pub struct HistoryScraper {
    store: Arc<HistoryStore>,
    client: Client,
    running: Arc<parking_lot::RwLock<bool>>,
    tracked_markets: Arc<parking_lot::RwLock<Vec<TrackedMarket>>>,
    errors: Arc<std::sync::atomic::AtomicUsize>,
    handle: Option<tokio::task::JoinHandle<()>>,
}

#[derive(Clone, Debug)]
pub struct TrackedMarket {
    pub condition_id: String,
    pub token_ids: Vec<String>,
    pub question: String,
    pub neg_risk: bool,
}

impl HistoryScraper {
    pub fn new(store: Arc<HistoryStore>) -> Self {
        Self {
            store,
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("HTTP client"),
            running: Arc::new(parking_lot::RwLock::new(false)),
            tracked_markets: Arc::new(parking_lot::RwLock::new(Vec::new())),
            errors: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            handle: None,
        }
    }

    /// Add a market to track
    pub fn track_market(&self, market: TrackedMarket) {
        let mut markets = self.tracked_markets.write();
        if !markets.iter().any(|m| m.condition_id == market.condition_id) {
            info!("tracking market: {} ({})", market.question, market.condition_id);
            markets.push(market);
        }
    }

    /// Auto-discover and track top markets by volume
    pub async fn auto_discover(&self, count: usize) -> Result<usize> {
        let url = format!("{}/markets?limit={}&active=true&closed=false&order=volume&ascending=false", GAMMA_BASE, count);
        let resp = self.client.get(&url).send().await?;
        let markets: Vec<Value> = resp.json().await?;

        let mut added = 0;
        for m in &markets {
            let condition_id = m.get("conditionId")
                .or_else(|| m.get("condition_id"))
                .and_then(|c| c.as_str());
            let token_ids = m.get("clobTokenIds")
                .or_else(|| m.get("clob_token_ids"))
                .and_then(|t| t.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>());
            let question = m.get("question").and_then(|q| q.as_str()).unwrap_or("").to_string();
            let neg_risk = m.get("negRisk").or_else(|| m.get("neg_risk")).and_then(|n| n.as_bool()).unwrap_or(false);

            if let (Some(cid), Some(tids)) = (condition_id, token_ids) {
                if !tids.is_empty() {
                    self.track_market(TrackedMarket {
                        condition_id: cid.to_string(),
                        token_ids: tids,
                        question,
                        neg_risk,
                    });
                    added += 1;
                }
            }
        }

        Ok(added)
    }

    /// Start the background scraping loop
    pub fn start(&mut self, interval_secs: u64) {
        if *self.running.read() { return; }
        *self.running.write() = true;

        let store = self.store.clone();
        let client = self.client.clone();
        let running = self.running.clone();
        let tracked = self.tracked_markets.clone();
        let errors = self.errors.clone();

        self.handle = Some(tokio::spawn(async move {
            info!("history scraper started (interval: {}s)", interval_secs);

            loop {
                if !*running.read() { break; }

                let markets: Vec<TrackedMarket> = tracked.read().clone();
                let now = chrono::Utc::now().timestamp();

                for market in &markets {
                    if !*running.read() { break; }

                    // Scrape prices for each token
                    for token_id in &market.token_ids {
                        match Self::scrape_price(&client, token_id).await {
                            Ok(price) => {
                                let point = PricePoint {
                                    timestamp: now,
                                    price,
                                    token_id: token_id.clone(),
                                    condition_id: market.condition_id.clone(),
                                };
                                if let Err(e) = store.save_price(&point) {
                                    warn!("save price failed: {}", e);
                                    errors.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                                }
                            }
                            Err(e) => {
                                warn!("scrape price failed for {}: {}", token_id, e);
                                errors.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            }
                        }
                    }

                    // Scrape market snapshot
                    match Self::scrape_market(&client, &market.condition_id).await {
                        Ok(data) => {
                            if let Err(e) = store.save_market_snapshot(now, &market.condition_id, &data) {
                                warn!("save snapshot failed: {}", e);
                            }
                        }
                        Err(e) => {
                            warn!("scrape market failed for {}: {}", market.condition_id, e);
                            errors.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        }
                    }

                    // Scrape orderbook snapshots
                    for token_id in &market.token_ids {
                        match Self::scrape_orderbook(&client, token_id).await {
                            Ok((best_bid, best_ask, bids, asks)) => {
                                if let Err(e) = store.save_orderbook_snapshot(
                                    now, token_id, &market.condition_id,
                                    best_bid, best_ask, &bids, &asks,
                                ) {
                                    warn!("save orderbook failed: {}", e);
                                }
                            }
                            Err(e) => {
                                warn!("scrape orderbook failed for {}: {}", token_id, e);
                            }
                        }
                    }

                    // Small delay between markets to avoid rate limiting
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                }

                // Scrape recent trades from price history endpoint
                for market in &markets {
                    if !*running.read() { break; }

                    match Self::scrape_price_history(&client, &market.condition_id).await {
                        Ok(points) => {
                            if let Err(e) = store.save_prices_batch(&points) {
                                warn!("save price history batch failed: {}", e);
                            }
                        }
                        Err(e) => {
                            warn!("scrape price history failed: {}", e);
                        }
                    }

                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                }

                info!("scrape cycle complete ({} markets)", markets.len());
                tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
            }

            info!("history scraper stopped");
        }));
    }

    pub fn stop(&mut self) {
        *self.running.write() = false;
        if let Some(handle) = self.handle.take() {
            handle.abort();
        }
    }

    pub fn is_running(&self) -> bool {
        *self.running.read()
    }

    pub fn status(&self) -> Result<ScraperStatus> {
        let mut status = self.store.stats()?;
        status.running = self.is_running();
        status.errors = self.errors.load(std::sync::atomic::Ordering::Relaxed);
        Ok(status)
    }

    pub fn tracked_count(&self) -> usize {
        self.tracked_markets.read().len()
    }

    // ─── Scrape Helpers ───

    async fn scrape_price(client: &Client, token_id: &str) -> Result<f64> {
        let url = format!("{}/midpoint-price?token_id={}", CLOB_BASE, token_id);
        let resp = client.get(&url).send().await?;
        let v: Value = resp.json().await?;
        let price_str = v.get("price").and_then(|p| p.as_str()).unwrap_or("0");
        Ok(price_str.parse().unwrap_or(0.0))
    }

    async fn scrape_market(client: &Client, condition_id: &str) -> Result<Value> {
        let url = format!("{}/markets/{}", GAMMA_BASE, condition_id);
        let resp = client.get(&url).send().await?;
        Ok(resp.json().await?)
    }

    async fn scrape_orderbook(client: &Client, token_id: &str) -> Result<(f64, f64, Value, Value)> {
        let url = format!("{}/order-book?token_id={}", CLOB_BASE, token_id);
        let resp = client.get(&url).send().await?;
        let v: Value = resp.json().await?;

        let bids = v.get("bids").cloned().unwrap_or(Value::Array(vec![]));
        let asks = v.get("asks").cloned().unwrap_or(Value::Array(vec![]));

        let best_bid = bids.as_array()
            .and_then(|arr| arr.first())
            .and_then(|b| b.get("price"))
            .and_then(|p| p.as_str())
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);
        let best_ask = asks.as_array()
            .and_then(|arr| arr.first())
            .and_then(|a| a.get("price"))
            .and_then(|p| p.as_str())
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(1.0);

        Ok((best_bid, best_ask, bids, asks))
    }

    async fn scrape_price_history(client: &Client, condition_id: &str) -> Result<Vec<PricePoint>> {
        let url = format!("{}/market/{}/prices-history", CLOB_BASE, condition_id);
        let resp = client.get(&url).send().await?;
        let v: Value = resp.json().await?;

        let mut points = Vec::new();
        if let Some(history) = v.as_array() {
            for entry in history {
                let timestamp = entry.get("t").and_then(|t| t.as_i64()).unwrap_or(0);
                let price = entry.get("p").and_then(|p| p.as_f64()).unwrap_or(0.0);

                if timestamp > 0 && price > 0.0 {
                    points.push(PricePoint {
                        timestamp,
                        price,
                        token_id: String::new(), // price history is per-condition
                        condition_id: condition_id.to_string(),
                    });
                }
            }
        }

        Ok(points)
    }
}
