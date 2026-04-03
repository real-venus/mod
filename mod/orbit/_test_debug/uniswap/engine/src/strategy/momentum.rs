use async_trait::async_trait;
use crate::pool;
use crate::types::StrategyKind;
use super::{Strategy, StrategyContext, Action};

/// Momentum/Trend Following: SMA crossover strategy
///
/// Config:
/// {
///   "pool_address": "0x...",
///   "token_in": "0x...",      // token to sell on bearish signal
///   "token_out": "0x...",     // token to buy on bullish signal
///   "amount": "100",
///   "sma_short": 10,          // short SMA window (ticks)
///   "sma_long": 50,           // long SMA window (ticks)
///   "fee": 3000,
///   "interval_secs": 60
/// }
pub struct MomentumStrategy;

#[async_trait]
impl Strategy for MomentumStrategy {
    fn name(&self) -> &str { "Momentum" }
    fn kind(&self) -> StrategyKind { StrategyKind::Momentum }

    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>> {
        let config = &ctx.record.config;
        let pool_address = config["pool_address"].as_str()
            .ok_or_else(|| eyre::eyre!("missing pool_address"))?;
        let sma_short_window = config["sma_short"].as_u64().unwrap_or(10) as usize;
        let sma_long_window = config["sma_long"].as_u64().unwrap_or(50) as usize;

        let provider = ctx.chain_manager.provider(&ctx.record.chain)
            .ok_or_else(|| eyre::eyre!("chain not configured"))?;

        let current_price = pool::get_pool_price(provider, pool_address).await?;

        // Extract price history from previous executions
        let prices: Vec<f64> = ctx.record.executions.iter()
            .filter_map(|ex| {
                // Parse price from action field "price=X.XX"
                ex.action.split("price=").nth(1)
                    .and_then(|s| s.split_whitespace().next())
                    .and_then(|s| s.parse::<f64>().ok())
            })
            .collect();

        let mut all_prices = prices;
        all_prices.push(current_price);

        if all_prices.len() < sma_long_window {
            return Ok(vec![Action::Skip {
                reason: format!(
                    "price={:.6} collecting data ({}/{} points needed)",
                    current_price,
                    all_prices.len(),
                    sma_long_window
                ),
            }]);
        }

        let sma_short: f64 = all_prices[all_prices.len()-sma_short_window..].iter().sum::<f64>() / sma_short_window as f64;
        let sma_long: f64 = all_prices[all_prices.len()-sma_long_window..].iter().sum::<f64>() / sma_long_window as f64;

        let token_in = config["token_in"].as_str()
            .ok_or_else(|| eyre::eyre!("missing token_in"))?;
        let token_out = config["token_out"].as_str()
            .ok_or_else(|| eyre::eyre!("missing token_out"))?;
        let amount = config["amount"].as_str()
            .ok_or_else(|| eyre::eyre!("missing amount"))?;
        let fee = config["fee"].as_u64().unwrap_or(3000) as u32;

        if sma_short > sma_long * 1.01 {
            // Bullish crossover — buy token_out
            Ok(vec![Action::Swap {
                chain: ctx.record.chain,
                token_in: token_in.to_string(),
                token_out: token_out.to_string(),
                amount: amount.to_string(),
                fee,
            }])
        } else if sma_short < sma_long * 0.99 {
            // Bearish crossover — sell (reverse swap)
            Ok(vec![Action::Swap {
                chain: ctx.record.chain,
                token_in: token_out.to_string(),
                token_out: token_in.to_string(),
                amount: amount.to_string(),
                fee,
            }])
        } else {
            Ok(vec![Action::Skip {
                reason: format!(
                    "price={:.6} sma_short={:.6} sma_long={:.6} no crossover",
                    current_price, sma_short, sma_long
                ),
            }])
        }
    }

    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> {
        for field in &["pool_address", "token_in", "token_out", "amount"] {
            if config.get(*field).and_then(|v| v.as_str()).is_none() {
                return Err(eyre::eyre!("Momentum requires '{}'", field));
            }
        }
        Ok(())
    }
}
