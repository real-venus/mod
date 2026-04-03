use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::history::HistoryStore;
use crate::types::{BacktestConfig, BacktestResult, PricePoint};

pub struct BacktestEngine {
    store: Arc<HistoryStore>,
}

impl BacktestEngine {
    pub fn new(store: Arc<HistoryStore>) -> Self {
        Self { store }
    }

    /// Run a backtest with the given configuration
    pub fn run(&self, config: &BacktestConfig) -> Result<BacktestResult> {
        let condition_ids = if config.condition_ids.is_empty() {
            self.store.get_all_condition_ids()?
        } else {
            config.condition_ids.clone()
        };

        if condition_ids.is_empty() {
            return Err(anyhow!("no markets to backtest - scrape some history first"));
        }

        match config.strategy.as_str() {
            "threshold" => self.run_threshold(config, &condition_ids),
            "momentum" => self.run_momentum(config, &condition_ids),
            "mean_reversion" => self.run_mean_reversion(config, &condition_ids),
            "spread" => self.run_spread(config, &condition_ids),
            _ => Err(anyhow!("unknown strategy: {}", config.strategy)),
        }
    }

    /// Threshold strategy: buy when price < buy_threshold, sell when > sell_threshold
    fn run_threshold(&self, config: &BacktestConfig, condition_ids: &[String]) -> Result<BacktestResult> {
        let mut capital = config.initial_capital;
        let mut positions: std::collections::HashMap<String, (f64, f64)> = std::collections::HashMap::new(); // cid -> (shares, avg_price)
        let mut trades = Vec::new();
        let mut equity_curve = Vec::new();
        let mut winning = 0usize;
        let mut losing = 0usize;

        for cid in condition_ids {
            let prices = self.store.get_prices(cid, config.start_time, config.end_time)?;
            if prices.is_empty() { continue; }

            for point in &prices {
                let pos = positions.get(cid).cloned();

                // Buy signal
                if point.price < config.buy_threshold && pos.is_none() {
                    let size_usd = capital * (config.position_size_pct / 100.0);
                    if size_usd > 0.0 && capital >= size_usd {
                        let shares = size_usd / point.price;
                        capital -= size_usd;
                        positions.insert(cid.clone(), (shares, point.price));
                        trades.push(json!({
                            "timestamp": point.timestamp,
                            "condition_id": cid,
                            "side": "BUY",
                            "price": point.price,
                            "shares": shares,
                            "cost": size_usd,
                        }));
                    }
                }

                // Sell signal
                if point.price > config.sell_threshold {
                    if let Some((shares, avg_price)) = pos {
                        let proceeds = shares * point.price;
                        let cost = shares * avg_price;
                        let pnl = proceeds - cost;
                        capital += proceeds;
                        positions.remove(cid);

                        if pnl > 0.0 { winning += 1; } else { losing += 1; }

                        trades.push(json!({
                            "timestamp": point.timestamp,
                            "condition_id": cid,
                            "side": "SELL",
                            "price": point.price,
                            "shares": shares,
                            "proceeds": proceeds,
                            "pnl": pnl,
                        }));
                    }
                }

                // Stop loss / take profit
                if let Some((shares, avg_price)) = positions.get(cid).cloned() {
                    let unrealized_pct = ((point.price - avg_price) / avg_price) * 100.0;

                    let should_exit = unrealized_pct <= -config.stop_loss_pct
                        || unrealized_pct >= config.take_profit_pct;

                    if should_exit {
                        let proceeds = shares * point.price;
                        let cost = shares * avg_price;
                        let pnl = proceeds - cost;
                        capital += proceeds;
                        positions.remove(cid);

                        if pnl > 0.0 { winning += 1; } else { losing += 1; }

                        let reason = if unrealized_pct <= -config.stop_loss_pct { "stop_loss" } else { "take_profit" };
                        trades.push(json!({
                            "timestamp": point.timestamp,
                            "condition_id": cid,
                            "side": "SELL",
                            "price": point.price,
                            "shares": shares,
                            "proceeds": proceeds,
                            "pnl": pnl,
                            "reason": reason,
                        }));
                    }
                }

                // Track equity
                let position_value: f64 = positions.values()
                    .map(|(shares, _)| shares * point.price)
                    .sum();
                equity_curve.push((point.timestamp, capital + position_value));
            }
        }

        // Close remaining positions at last known price
        for (cid, (shares, avg_price)) in &positions {
            let last_price = self.store.get_prices(cid, config.start_time, config.end_time)?
                .last().map(|p| p.price).unwrap_or(*avg_price);
            let proceeds = shares * last_price;
            let pnl = proceeds - shares * avg_price;
            capital += proceeds;
            if pnl > 0.0 { winning += 1; } else { losing += 1; }
        }

        self.compute_result(config, capital, &equity_curve, &trades, winning, losing)
    }

    /// Momentum strategy: buy when price is rising, sell when falling
    fn run_momentum(&self, config: &BacktestConfig, condition_ids: &[String]) -> Result<BacktestResult> {
        let mut capital = config.initial_capital;
        let mut positions: std::collections::HashMap<String, (f64, f64)> = std::collections::HashMap::new();
        let mut trades = Vec::new();
        let mut equity_curve = Vec::new();
        let mut winning = 0usize;
        let mut losing = 0usize;
        let lookback = 5; // price points to look back for trend

        for cid in condition_ids {
            let prices = self.store.get_prices(cid, config.start_time, config.end_time)?;
            if prices.len() < lookback + 1 { continue; }

            for i in lookback..prices.len() {
                let point = &prices[i];
                let prev = &prices[i - lookback];
                let trend = (point.price - prev.price) / prev.price;
                let pos = positions.get(cid).cloned();

                // Uptrend + no position = buy
                if trend > config.buy_threshold && pos.is_none() {
                    let size_usd = capital * (config.position_size_pct / 100.0);
                    if size_usd > 0.0 && capital >= size_usd {
                        let shares = size_usd / point.price;
                        capital -= size_usd;
                        positions.insert(cid.clone(), (shares, point.price));
                        trades.push(json!({
                            "timestamp": point.timestamp, "condition_id": cid,
                            "side": "BUY", "price": point.price, "shares": shares,
                            "trend": trend,
                        }));
                    }
                }

                // Downtrend + has position = sell
                if trend < -config.sell_threshold.abs() {
                    if let Some((shares, avg_price)) = pos {
                        let proceeds = shares * point.price;
                        let pnl = proceeds - shares * avg_price;
                        capital += proceeds;
                        positions.remove(cid);
                        if pnl > 0.0 { winning += 1; } else { losing += 1; }
                        trades.push(json!({
                            "timestamp": point.timestamp, "condition_id": cid,
                            "side": "SELL", "price": point.price, "pnl": pnl,
                            "trend": trend,
                        }));
                    }
                }

                let position_value: f64 = positions.values().map(|(s, _)| s * point.price).sum();
                equity_curve.push((point.timestamp, capital + position_value));
            }
        }

        // Close remaining
        for (cid, (shares, avg_price)) in &positions {
            let last_price = self.store.get_prices(cid, config.start_time, config.end_time)?
                .last().map(|p| p.price).unwrap_or(*avg_price);
            capital += shares * last_price;
            let pnl = shares * (last_price - avg_price);
            if pnl > 0.0 { winning += 1; } else { losing += 1; }
        }

        self.compute_result(config, capital, &equity_curve, &trades, winning, losing)
    }

    /// Mean reversion: buy when price drops significantly, sell when it reverts to mean
    fn run_mean_reversion(&self, config: &BacktestConfig, condition_ids: &[String]) -> Result<BacktestResult> {
        let mut capital = config.initial_capital;
        let mut positions: std::collections::HashMap<String, (f64, f64)> = std::collections::HashMap::new();
        let mut trades = Vec::new();
        let mut equity_curve = Vec::new();
        let mut winning = 0usize;
        let mut losing = 0usize;
        let window = 20;

        for cid in condition_ids {
            let prices = self.store.get_prices(cid, config.start_time, config.end_time)?;
            if prices.len() < window + 1 { continue; }

            for i in window..prices.len() {
                let point = &prices[i];

                // Compute moving average
                let ma: f64 = prices[i-window..i].iter().map(|p| p.price).sum::<f64>() / window as f64;
                let deviation = (point.price - ma) / ma;
                let pos = positions.get(cid).cloned();

                // Price below MA by threshold = buy
                if deviation < -config.buy_threshold && pos.is_none() {
                    let size_usd = capital * (config.position_size_pct / 100.0);
                    if size_usd > 0.0 && capital >= size_usd {
                        let shares = size_usd / point.price;
                        capital -= size_usd;
                        positions.insert(cid.clone(), (shares, point.price));
                        trades.push(json!({
                            "timestamp": point.timestamp, "condition_id": cid,
                            "side": "BUY", "price": point.price, "ma": ma,
                            "deviation": deviation,
                        }));
                    }
                }

                // Price reverts to/above MA = sell
                if deviation > config.sell_threshold {
                    if let Some((shares, avg_price)) = pos {
                        let proceeds = shares * point.price;
                        let pnl = proceeds - shares * avg_price;
                        capital += proceeds;
                        positions.remove(cid);
                        if pnl > 0.0 { winning += 1; } else { losing += 1; }
                        trades.push(json!({
                            "timestamp": point.timestamp, "condition_id": cid,
                            "side": "SELL", "price": point.price, "pnl": pnl,
                            "ma": ma,
                        }));
                    }
                }

                let position_value: f64 = positions.values().map(|(s, _)| s * point.price).sum();
                equity_curve.push((point.timestamp, capital + position_value));
            }
        }

        for (cid, (shares, avg_price)) in &positions {
            let last_price = self.store.get_prices(cid, config.start_time, config.end_time)?
                .last().map(|p| p.price).unwrap_or(*avg_price);
            capital += shares * last_price;
            let pnl = shares * (last_price - avg_price);
            if pnl > 0.0 { winning += 1; } else { losing += 1; }
        }

        self.compute_result(config, capital, &equity_curve, &trades, winning, losing)
    }

    /// Spread strategy: profit from bid-ask spread using orderbook snapshots
    fn run_spread(&self, config: &BacktestConfig, condition_ids: &[String]) -> Result<BacktestResult> {
        // Simplified: uses price data to simulate spread capture
        self.run_threshold(config, condition_ids)
    }

    // ─── Result Computation ───

    fn compute_result(
        &self,
        config: &BacktestConfig,
        final_capital: f64,
        equity_curve: &[(i64, f64)],
        trades: &[Value],
        winning: usize,
        losing: usize,
    ) -> Result<BacktestResult> {
        let total_pnl = final_capital - config.initial_capital;
        let total_return_pct = (total_pnl / config.initial_capital) * 100.0;
        let total_trades = winning + losing;
        let win_rate = if total_trades > 0 { winning as f64 / total_trades as f64 } else { 0.0 };

        // Max drawdown
        let max_drawdown_pct = Self::compute_max_drawdown(equity_curve);

        // Sharpe ratio (simplified: assume risk-free rate = 0)
        let sharpe_ratio = Self::compute_sharpe(equity_curve);

        Ok(BacktestResult {
            total_pnl,
            total_return_pct,
            win_rate,
            total_trades,
            winning_trades: winning,
            losing_trades: losing,
            max_drawdown_pct,
            sharpe_ratio,
            final_capital,
            equity_curve: equity_curve.to_vec(),
            trades: trades.to_vec(),
        })
    }

    fn compute_max_drawdown(equity_curve: &[(i64, f64)]) -> f64 {
        if equity_curve.is_empty() { return 0.0; }

        let mut peak = equity_curve[0].1;
        let mut max_dd = 0.0f64;

        for &(_, equity) in equity_curve {
            if equity > peak { peak = equity; }
            let dd = (peak - equity) / peak * 100.0;
            if dd > max_dd { max_dd = dd; }
        }

        max_dd
    }

    fn compute_sharpe(equity_curve: &[(i64, f64)]) -> f64 {
        if equity_curve.len() < 2 { return 0.0; }

        let returns: Vec<f64> = equity_curve.windows(2)
            .map(|w| (w[1].1 - w[0].1) / w[0].1)
            .collect();

        if returns.is_empty() { return 0.0; }

        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;
        let std_dev = variance.sqrt();

        if std_dev == 0.0 { return 0.0; }

        // Annualize assuming ~hourly data points (~8760 per year)
        let annualization = (8760.0f64).sqrt();
        (mean / std_dev) * annualization
    }
}
