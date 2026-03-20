use serde::{Deserialize, Serialize};
use rust_decimal::Decimal;
use pyo3::prelude::*;

// ─── API Credentials ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct ApiCreds {
    pub api_key: String,
    pub secret: String,
    pub passphrase: String,
}

#[pymethods]
impl ApiCreds {
    #[new]
    pub fn new(api_key: String, secret: String, passphrase: String) -> Self {
        Self { api_key, secret, passphrase }
    }
    fn __repr__(&self) -> String {
        format!("ApiCreds(api_key={}...)", &self.api_key[..8.min(self.api_key.len())])
    }
}

// ─── Order Types ───

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum Side {
    #[serde(rename = "BUY")]
    Buy,
    #[serde(rename = "SELL")]
    Sell,
}

impl Side {
    pub fn as_str(&self) -> &str {
        match self { Side::Buy => "BUY", Side::Sell => "SELL" }
    }
    pub fn as_u8(&self) -> u8 {
        match self { Side::Buy => 0, Side::Sell => 1 }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum OrderType {
    GTC,
    GTD,
    FOK,
    FAK,
}

impl OrderType {
    pub fn as_str(&self) -> &str {
        match self {
            OrderType::GTC => "GTC",
            OrderType::GTD => "GTD",
            OrderType::FOK => "FOK",
            OrderType::FAK => "FAK",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SignatureType {
    EOA = 0,
    PolyProxy = 1,
    PolyGnosisSafe = 2,
}

// ─── Order Struct (EIP-712) ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderData {
    pub salt: String,
    pub maker: String,
    pub signer: String,
    pub taker: String,
    pub token_id: String,
    pub maker_amount: String,
    pub taker_amount: String,
    pub expiration: String,
    pub nonce: String,
    pub fee_rate_bps: String,
    pub side: Side,
    pub signature_type: SignatureType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedOrder {
    pub order: OrderData,
    pub signature: String,
}

// ─── API Request/Response Types ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct OrderRequest {
    pub token_id: String,
    pub price: String,
    pub size: String,
    pub side: String,
    pub order_type: String,
    pub expiration: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct OrderResponse {
    pub id: String,
    pub status: String,
    pub order: serde_json::Value,
}

#[pymethods]
impl OrderResponse {
    fn __repr__(&self) -> String {
        format!("Order(id={}, status={})", self.id, self.status)
    }
}

// ─── Market Data ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct Market {
    pub condition_id: String,
    pub question_id: Option<String>,
    pub question: Option<String>,
    pub slug: Option<String>,
    pub outcomes: Option<Vec<String>>,
    pub outcome_prices: Option<Vec<String>>,
    pub volume: Option<String>,
    pub liquidity: Option<String>,
    pub end_date: Option<String>,
    pub active: Option<bool>,
    pub closed: Option<bool>,
    pub clob_token_ids: Option<Vec<String>>,
    pub neg_risk: Option<bool>,
    pub best_bid: Option<String>,
    pub best_ask: Option<String>,
    pub last_trade_price: Option<String>,
    pub spread: Option<String>,
}

#[pymethods]
impl Market {
    fn __repr__(&self) -> String {
        let q = self.question.as_deref().unwrap_or("?");
        format!("Market({})", &q[..60.min(q.len())])
    }
    fn to_dict(&self) -> PyResult<String> {
        serde_json::to_string(self).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct Event {
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub volume: Option<String>,
    pub markets: Option<Vec<serde_json::Value>>,
    pub tags: Option<Vec<String>>,
}

#[pymethods]
impl Event {
    fn __repr__(&self) -> String {
        let t = self.title.as_deref().unwrap_or("?");
        format!("Event({})", &t[..60.min(t.len())])
    }
}

// ─── Order Book ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct OrderBookEntry {
    pub price: String,
    pub size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct OrderBook {
    pub bids: Vec<serde_json::Value>,
    pub asks: Vec<serde_json::Value>,
    pub best_bid: Option<String>,
    pub best_ask: Option<String>,
    pub spread: Option<String>,
    pub midpoint: Option<String>,
}

#[pymethods]
impl OrderBook {
    fn __repr__(&self) -> String {
        format!(
            "OrderBook(bid={}, ask={}, spread={})",
            self.best_bid.as_deref().unwrap_or("?"),
            self.best_ask.as_deref().unwrap_or("?"),
            self.spread.as_deref().unwrap_or("?"),
        )
    }
}

// ─── Trade ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct Trade {
    pub id: Option<String>,
    pub taker_order_id: Option<String>,
    pub market: Option<String>,
    pub asset_id: Option<String>,
    pub side: Option<String>,
    pub size: Option<String>,
    pub price: Option<String>,
    pub status: Option<String>,
    pub match_time: Option<String>,
    pub outcome: Option<String>,
    pub fee_rate_bps: Option<String>,
    pub owner: Option<String>,
    pub maker_address: Option<String>,
    pub transaction_hash: Option<String>,
    pub bucket_index: Option<String>,
    pub timestamp: Option<i64>,
}

#[pymethods]
impl Trade {
    fn __repr__(&self) -> String {
        format!(
            "Trade(side={}, size={}, price={})",
            self.side.as_deref().unwrap_or("?"),
            self.size.as_deref().unwrap_or("?"),
            self.price.as_deref().unwrap_or("?"),
        )
    }
}

// ─── Position ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct Position {
    pub asset: Option<String>,
    pub condition_id: Option<String>,
    pub size: Option<String>,
    pub avg_price: Option<String>,
    pub cur_price: Option<String>,
    pub pnl: Option<String>,
    pub realized_pnl: Option<String>,
    pub unrealized_pnl: Option<String>,
    pub side: Option<String>,
    pub outcome: Option<String>,
    pub market: Option<String>,
}

#[pymethods]
impl Position {
    fn __repr__(&self) -> String {
        format!(
            "Position(market={}, size={}, pnl={})",
            self.market.as_deref().unwrap_or("?"),
            self.size.as_deref().unwrap_or("?"),
            self.pnl.as_deref().unwrap_or("?"),
        )
    }
}

// ─── Price History (for backtesting) ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct PricePoint {
    pub timestamp: i64,
    pub price: f64,
    pub token_id: String,
    pub condition_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct TradeRecord {
    pub timestamp: i64,
    pub token_id: String,
    pub condition_id: String,
    pub side: String,
    pub price: f64,
    pub size: f64,
    pub maker: Option<String>,
    pub taker: Option<String>,
    pub tx_hash: Option<String>,
}

// ─── Scraper Job Status ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct ScraperStatus {
    pub running: bool,
    pub markets_tracked: usize,
    pub total_price_points: usize,
    pub total_trades_saved: usize,
    pub last_scrape: Option<String>,
    pub errors: usize,
}

// ─── Backtest Types ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all, set_all)]
pub struct BacktestConfig {
    pub start_time: i64,
    pub end_time: i64,
    pub initial_capital: f64,
    pub condition_ids: Vec<String>,
    pub strategy: String,         // "momentum", "mean_reversion", "threshold"
    pub buy_threshold: f64,       // buy when price < this
    pub sell_threshold: f64,      // sell when price > this
    pub position_size_pct: f64,   // % of capital per trade
    pub stop_loss_pct: f64,
    pub take_profit_pct: f64,
}

#[pymethods]
impl BacktestConfig {
    #[new]
    #[pyo3(signature = (
        start_time, end_time,
        initial_capital = 1000.0,
        condition_ids = vec![],
        strategy = "threshold".to_string(),
        buy_threshold = 0.3,
        sell_threshold = 0.7,
        position_size_pct = 10.0,
        stop_loss_pct = 20.0,
        take_profit_pct = 50.0,
    ))]
    pub fn new(
        start_time: i64,
        end_time: i64,
        initial_capital: f64,
        condition_ids: Vec<String>,
        strategy: String,
        buy_threshold: f64,
        sell_threshold: f64,
        position_size_pct: f64,
        stop_loss_pct: f64,
        take_profit_pct: f64,
    ) -> Self {
        Self {
            start_time, end_time, initial_capital, condition_ids,
            strategy, buy_threshold, sell_threshold, position_size_pct,
            stop_loss_pct, take_profit_pct,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct BacktestResult {
    pub total_pnl: f64,
    pub total_return_pct: f64,
    pub win_rate: f64,
    pub total_trades: usize,
    pub winning_trades: usize,
    pub losing_trades: usize,
    pub max_drawdown_pct: f64,
    pub sharpe_ratio: f64,
    pub final_capital: f64,
    pub equity_curve: Vec<(i64, f64)>,
    pub trades: Vec<serde_json::Value>,
}

#[pymethods]
impl BacktestResult {
    fn __repr__(&self) -> String {
        format!(
            "BacktestResult(pnl={:.2}, return={:.1}%, trades={}, win_rate={:.1}%, sharpe={:.2})",
            self.total_pnl, self.total_return_pct, self.total_trades,
            self.win_rate * 100.0, self.sharpe_ratio,
        )
    }
}

// ─── WebSocket Event ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[pyclass(get_all)]
pub struct WsEvent {
    pub event_type: String,
    pub market: Option<String>,
    pub data: String,
    pub timestamp: i64,
}

#[pymethods]
impl WsEvent {
    fn __repr__(&self) -> String {
        format!("WsEvent(type={}, market={})", self.event_type, self.market.as_deref().unwrap_or("?"))
    }
}
