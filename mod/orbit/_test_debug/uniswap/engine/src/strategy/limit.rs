use async_trait::async_trait;
use crate::pool;
use crate::types::StrategyKind;
use super::{Strategy, StrategyContext, Action};

/// Limit Order: swap when pool price hits a target
///
/// Config:
/// {
///   "pool_address": "0x...",
///   "token_in": "0x...",
///   "token_out": "0x...",
///   "amount": "1.0",
///   "target_price": 2500.0,     // trigger when price >= this (for buy) or <= (for sell)
///   "direction": "above",       // "above" or "below"
///   "fee": 3000,
///   "interval_secs": 30
/// }
pub struct LimitOrderStrategy;

#[async_trait]
impl Strategy for LimitOrderStrategy {
    fn name(&self) -> &str { "Limit Order" }
    fn kind(&self) -> StrategyKind { StrategyKind::LimitOrder }

    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>> {
        let config = &ctx.record.config;
        let pool_address = config["pool_address"].as_str()
            .ok_or_else(|| eyre::eyre!("missing pool_address"))?;
        let target_price = config["target_price"].as_f64()
            .ok_or_else(|| eyre::eyre!("missing target_price"))?;
        let direction = config["direction"].as_str().unwrap_or("above");

        let provider = ctx.chain_manager.provider(&ctx.record.chain)
            .ok_or_else(|| eyre::eyre!("chain not configured"))?;

        let current_price = pool::get_pool_price(provider, pool_address).await?;

        let triggered = match direction {
            "above" => current_price >= target_price,
            "below" => current_price <= target_price,
            _ => return Err(eyre::eyre!("direction must be 'above' or 'below'")),
        };

        if triggered {
            let token_in = config["token_in"].as_str()
                .ok_or_else(|| eyre::eyre!("missing token_in"))?;
            let token_out = config["token_out"].as_str()
                .ok_or_else(|| eyre::eyre!("missing token_out"))?;
            let amount = config["amount"].as_str()
                .ok_or_else(|| eyre::eyre!("missing amount"))?;
            let fee = config["fee"].as_u64().unwrap_or(3000) as u32;

            Ok(vec![Action::Swap {
                chain: ctx.record.chain,
                token_in: token_in.to_string(),
                token_out: token_out.to_string(),
                amount: amount.to_string(),
                fee,
            }])
        } else {
            Ok(vec![Action::Skip {
                reason: format!("price {:.6} not {} {}", current_price, direction, target_price),
            }])
        }
    }

    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> {
        for field in &["pool_address", "token_in", "token_out", "amount"] {
            if config.get(*field).and_then(|v| v.as_str()).is_none() {
                return Err(eyre::eyre!("Limit order requires '{}'", field));
            }
        }
        if config.get("target_price").and_then(|v| v.as_f64()).is_none() {
            return Err(eyre::eyre!("Limit order requires 'target_price' (number)"));
        }
        Ok(())
    }
}
