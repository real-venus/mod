pub mod types;
pub mod auth;
pub mod signing;
pub mod clob;
pub mod gamma;
pub mod ws;
pub mod history;
pub mod backtest;

use pyo3::prelude::*;
use pyo3::exceptions::PyRuntimeError;
use serde_json::{json, Value};
use std::sync::Arc;
use parking_lot::RwLock;
use tokio::runtime::Runtime;
use tracing_subscriber::EnvFilter;

use types::*;
use clob::ClobClient;
use gamma::GammaClient;
use ws::WsClient;
use history::{HistoryStore, HistoryScraper, TrackedMarket};
use backtest::BacktestEngine;

fn rt() -> PyResult<Runtime> {
    Runtime::new().map_err(|e| PyRuntimeError::new_err(format!("tokio runtime: {}", e)))
}

fn to_pyerr(e: anyhow::Error) -> PyErr {
    PyRuntimeError::new_err(format!("{}", e))
}

fn val_to_str(v: &Value) -> String {
    serde_json::to_string(v).unwrap_or_default()
}

// ─── Main Engine (PyO3 Class) ───

#[pyclass]
pub struct PolymarketEngine {
    clob: Option<ClobClient>,
    gamma: GammaClient,
    ws: Arc<RwLock<WsClient>>,
    store: Option<Arc<HistoryStore>>,
    scraper: Option<Arc<RwLock<HistoryScraper>>>,
    backtest: Option<BacktestEngine>,
    rt: Runtime,
    address: Option<String>,
}

#[pymethods]
impl PolymarketEngine {
    /// Create a new engine. Pass private_key for trading, or None for read-only.
    /// db_path is where history gets stored (default: ./polymarket_history.db)
    #[new]
    #[pyo3(signature = (private_key=None, db_path=None))]
    fn new(private_key: Option<String>, db_path: Option<String>) -> PyResult<Self> {
        // Init tracing
        let _ = tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::from_default_env().add_directive("polymarket_rs=info".parse().unwrap()))
            .try_init();

        let rt = rt()?;
        let gamma = GammaClient::new();
        let ws = Arc::new(RwLock::new(WsClient::new()));

        let (clob, address) = match &private_key {
            Some(key) => {
                let c = ClobClient::new(key).map_err(to_pyerr)?;
                let addr = c.address().to_string();
                (Some(c), Some(addr))
            }
            None => (None, None),
        };

        let db = db_path.unwrap_or_else(|| "polymarket_history.db".to_string());
        let store = Arc::new(HistoryStore::new(&db).map_err(to_pyerr)?);
        let scraper = Arc::new(RwLock::new(HistoryScraper::new(store.clone())));
        let backtest = BacktestEngine::new(store.clone());

        Ok(Self {
            clob,
            gamma,
            ws,
            store: Some(store),
            scraper: Some(scraper),
            backtest: Some(backtest),
            rt,
            address,
        })
    }

    /// Get the wallet address
    fn address(&self) -> Option<String> {
        self.address.clone()
    }

    // ═══════════════════════════════════
    //  AUTH
    // ═══════════════════════════════════

    /// Derive API credentials from the private key (L1 auth)
    fn derive_api_key(&mut self) -> PyResult<ApiCreds> {
        let clob = self.clob.as_mut().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        self.rt.block_on(clob.derive_api_key()).map_err(to_pyerr)
    }

    /// Create new API credentials
    fn create_api_key(&mut self) -> PyResult<ApiCreds> {
        let clob = self.clob.as_mut().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        self.rt.block_on(clob.create_api_key()).map_err(to_pyerr)
    }

    /// Set API credentials directly
    fn set_creds(&mut self, api_key: String, secret: String, passphrase: String) -> PyResult<()> {
        let clob = self.clob.as_mut().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        clob.set_creds(ApiCreds { api_key, secret, passphrase });
        Ok(())
    }

    // ═══════════════════════════════════
    //  TRADING
    // ═══════════════════════════════════

    /// Place a limit order
    /// side: "BUY" or "SELL"
    /// order_type: "GTC", "GTD", "FOK", "FAK"
    #[pyo3(signature = (token_id, price, size, side, order_type="GTC", neg_risk=false, expiration=None))]
    fn place_order(
        &self, token_id: &str, price: f64, size: f64, side: &str,
        order_type: &str, neg_risk: bool, expiration: Option<u64>,
    ) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let s = match side.to_uppercase().as_str() {
            "BUY" => types::Side::Buy,
            "SELL" => types::Side::Sell,
            _ => return Err(PyRuntimeError::new_err("side must be BUY or SELL")),
        };
        let ot = match order_type.to_uppercase().as_str() {
            "GTC" => types::OrderType::GTC,
            "GTD" => types::OrderType::GTD,
            "FOK" => types::OrderType::FOK,
            "FAK" => types::OrderType::FAK,
            _ => return Err(PyRuntimeError::new_err("order_type must be GTC/GTD/FOK/FAK")),
        };
        let result = self.rt.block_on(clob.place_order(token_id, price, size, s, ot, neg_risk, expiration))
            .map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Place a market order (FOK at best price)
    #[pyo3(signature = (token_id, size, side, neg_risk=false))]
    fn market_order(&self, token_id: &str, size: f64, side: &str, neg_risk: bool) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let s = match side.to_uppercase().as_str() {
            "BUY" => types::Side::Buy,
            "SELL" => types::Side::Sell,
            _ => return Err(PyRuntimeError::new_err("side must be BUY or SELL")),
        };
        let result = self.rt.block_on(clob.market_order(token_id, size, s, neg_risk))
            .map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Cancel an order
    fn cancel_order(&self, order_id: &str) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.cancel_order(order_id)).map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Cancel all orders
    fn cancel_all(&self) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.cancel_all()).map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Cancel all orders for a specific market
    fn cancel_market_orders(&self, condition_id: &str) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.cancel_market_orders(condition_id)).map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Get open orders
    #[pyo3(signature = (market=None))]
    fn open_orders(&self, market: Option<&str>) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.open_orders(market)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get trade history
    #[pyo3(signature = (market=None, limit=None))]
    fn trades(&self, market: Option<&str>, limit: Option<u32>) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.trades(market, limit)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get current positions
    fn positions(&self) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.positions()).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get total position value
    fn position_value(&self) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.position_value()).map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Send heartbeat
    fn heartbeat(&self) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        let result = self.rt.block_on(clob.heartbeat()).map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    // ═══════════════════════════════════
    //  MARKET DATA (Public, no auth)
    // ═══════════════════════════════════

    /// Get midpoint price for a token
    fn midpoint(&self, token_id: &str) -> PyResult<f64> {
        let clob = self.clob.as_ref().ok_or_else(|| {
            // Fallback: use a temporary client for public endpoints
            PyRuntimeError::new_err("no client configured")
        })?;
        self.rt.block_on(clob.midpoint(token_id)).map_err(to_pyerr)
    }

    /// Get order book
    fn orderbook(&self, token_id: &str) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no client"))?;
        let result = self.rt.block_on(clob.orderbook(token_id)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get last trade price
    fn last_trade_price(&self, token_id: &str) -> PyResult<f64> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no client"))?;
        self.rt.block_on(clob.last_trade_price(token_id)).map_err(to_pyerr)
    }

    /// Get price history for a market
    fn price_history(&self, condition_id: &str) -> PyResult<String> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no client"))?;
        let result = self.rt.block_on(clob.price_history(condition_id)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get server time
    fn server_time(&self) -> PyResult<i64> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no client"))?;
        self.rt.block_on(clob.server_time()).map_err(to_pyerr)
    }

    // ═══════════════════════════════════
    //  GAMMA (Markets / Events)
    // ═══════════════════════════════════

    /// Search markets by query
    fn search(&self, query: &str) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.search(query)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get markets (paginated)
    #[pyo3(signature = (limit=None, offset=None, active=None, closed=None, order=None, ascending=None))]
    fn markets(
        &self, limit: Option<u32>, offset: Option<u32>,
        active: Option<bool>, closed: Option<bool>,
        order: Option<&str>, ascending: Option<bool>,
    ) -> PyResult<String> {
        let result = self.rt.block_on(
            self.gamma.markets(limit, offset, active, closed, order, ascending)
        ).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get a single market
    fn market(&self, condition_id: &str) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.market(condition_id)).map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Get all active markets
    fn all_active_markets(&self) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.all_active_markets()).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get events
    #[pyo3(signature = (limit=None, offset=None, active=None, closed=None, order=None, ascending=None, tag=None))]
    fn events(
        &self, limit: Option<u32>, offset: Option<u32>,
        active: Option<bool>, closed: Option<bool>,
        order: Option<&str>, ascending: Option<bool>,
        tag: Option<&str>,
    ) -> PyResult<String> {
        let result = self.rt.block_on(
            self.gamma.events(limit, offset, active, closed, order, ascending, tag)
        ).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get a single event
    fn event(&self, event_id: &str) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.event(event_id)).map_err(to_pyerr)?;
        Ok(val_to_str(&result))
    }

    /// Get trending markets
    #[pyo3(signature = (limit=None))]
    fn trending(&self, limit: Option<u32>) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.trending(limit)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get markets by liquidity
    #[pyo3(signature = (limit=None))]
    fn by_liquidity(&self, limit: Option<u32>) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.by_liquidity(limit)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get markets ending soon
    #[pyo3(signature = (limit=None))]
    fn ending_soon(&self, limit: Option<u32>) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.ending_soon(limit)).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    /// Get all tags
    fn tags(&self) -> PyResult<String> {
        let result = self.rt.block_on(self.gamma.tags()).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }

    // ═══════════════════════════════════
    //  WEBSOCKET
    // ═══════════════════════════════════

    /// Subscribe to market WebSocket for given token IDs
    fn ws_subscribe_market(&self, token_ids: Vec<String>) -> PyResult<()> {
        self.ws.write().connect_market(token_ids);
        Ok(())
    }

    /// Subscribe to user WebSocket (requires auth)
    fn ws_subscribe_user(&self, markets: Vec<String>) -> PyResult<()> {
        let clob = self.clob.as_ref().ok_or_else(|| PyRuntimeError::new_err("no private key set"))?;
        // Get creds from the clob client - they should have been set via derive_api_key
        // For now, we'll need the user to pass creds
        Err(PyRuntimeError::new_err("call derive_api_key() first, then use ws_subscribe_user_with_creds()"))
    }

    /// Subscribe to user WebSocket with explicit credentials
    fn ws_subscribe_user_with_creds(
        &self, api_key: String, secret: String, passphrase: String, markets: Vec<String>,
    ) -> PyResult<()> {
        let creds = ApiCreds { api_key, secret, passphrase };
        self.ws.write().connect_user(&creds, markets);
        Ok(())
    }

    /// Stop all WebSocket connections
    fn ws_stop(&self) -> PyResult<()> {
        self.ws.write().stop();
        Ok(())
    }

    /// Check if WebSocket is running
    fn ws_running(&self) -> bool {
        self.ws.read().is_running()
    }

    // ═══════════════════════════════════
    //  HISTORY SCRAPER
    // ═══════════════════════════════════

    /// Track a market for history scraping
    fn track_market(&self, condition_id: &str, token_ids: Vec<String>, question: &str, neg_risk: bool) -> PyResult<()> {
        let scraper = self.scraper.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        scraper.read().track_market(TrackedMarket {
            condition_id: condition_id.to_string(),
            token_ids,
            question: question.to_string(),
            neg_risk,
        });
        Ok(())
    }

    /// Auto-discover and track top markets by volume
    #[pyo3(signature = (count=50))]
    fn auto_discover(&self, count: usize) -> PyResult<usize> {
        let scraper = self.scraper.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        self.rt.block_on(scraper.read().auto_discover(count)).map_err(to_pyerr)
    }

    /// Start the background history scraper
    #[pyo3(signature = (interval_secs=60))]
    fn start_scraper(&self, interval_secs: u64) -> PyResult<()> {
        let scraper = self.scraper.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        scraper.write().start(interval_secs);
        Ok(())
    }

    /// Stop the background history scraper
    fn stop_scraper(&self) -> PyResult<()> {
        let scraper = self.scraper.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        scraper.write().stop();
        Ok(())
    }

    /// Get scraper status
    fn scraper_status(&self) -> PyResult<ScraperStatus> {
        let scraper = self.scraper.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        scraper.read().status().map_err(to_pyerr)
    }

    // ═══════════════════════════════════
    //  HISTORY QUERIES
    // ═══════════════════════════════════

    /// Get stored price history for a market
    fn stored_prices(&self, condition_id: &str, start: i64, end: i64) -> PyResult<String> {
        let store = self.store.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        let prices = store.get_prices(condition_id, start, end).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&prices).unwrap_or_default())
    }

    /// Get stored trade history
    fn stored_trades(&self, condition_id: &str, start: i64, end: i64) -> PyResult<String> {
        let store = self.store.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        let trades = store.get_trades_history(condition_id, start, end).map_err(to_pyerr)?;
        Ok(serde_json::to_string(&trades).unwrap_or_default())
    }

    /// Get all condition IDs with stored data
    fn stored_markets(&self) -> PyResult<Vec<String>> {
        let store = self.store.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        store.get_all_condition_ids().map_err(to_pyerr)
    }

    /// Get store statistics
    fn store_stats(&self) -> PyResult<ScraperStatus> {
        let store = self.store.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        store.stats().map_err(to_pyerr)
    }

    // ═══════════════════════════════════
    //  BACKTESTING
    // ═══════════════════════════════════

    /// Run a backtest
    fn backtest(&self, config: &BacktestConfig) -> PyResult<BacktestResult> {
        let bt = self.backtest.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        bt.run(config).map_err(to_pyerr)
    }

    /// Quick backtest with simple parameters
    #[pyo3(signature = (
        start_time, end_time,
        strategy = "threshold",
        buy_threshold = 0.3,
        sell_threshold = 0.7,
        initial_capital = 1000.0,
        position_size_pct = 10.0,
        condition_ids = vec![],
    ))]
    fn quick_backtest(
        &self,
        start_time: i64,
        end_time: i64,
        strategy: &str,
        buy_threshold: f64,
        sell_threshold: f64,
        initial_capital: f64,
        position_size_pct: f64,
        condition_ids: Vec<String>,
    ) -> PyResult<BacktestResult> {
        let config = BacktestConfig {
            start_time,
            end_time,
            initial_capital,
            condition_ids,
            strategy: strategy.to_string(),
            buy_threshold,
            sell_threshold,
            position_size_pct,
            stop_loss_pct: 20.0,
            take_profit_pct: 50.0,
        };
        let bt = self.backtest.as_ref().ok_or_else(|| PyRuntimeError::new_err("no store"))?;
        bt.run(&config).map_err(to_pyerr)
    }
}

// ─── Python Module ───

#[pymodule]
fn polymarket_rs(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<PolymarketEngine>()?;
    m.add_class::<ApiCreds>()?;
    m.add_class::<BacktestConfig>()?;
    m.add_class::<BacktestResult>()?;
    m.add_class::<ScraperStatus>()?;
    m.add_class::<WsEvent>()?;
    m.add_class::<PricePoint>()?;
    m.add_class::<TradeRecord>()?;
    m.add_class::<Market>()?;
    m.add_class::<Event>()?;
    m.add_class::<OrderBook>()?;
    m.add_class::<Trade>()?;
    m.add_class::<Position>()?;
    Ok(())
}
