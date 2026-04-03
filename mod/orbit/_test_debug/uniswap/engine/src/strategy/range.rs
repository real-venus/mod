use async_trait::async_trait;
use crate::pool;
use crate::types::StrategyKind;
use super::{Strategy, StrategyContext, Action};

/// Range LP: monitor a concentrated liquidity position and rebalance when out of range
///
/// Config:
/// {
///   "pool_address": "0x...",
///   "token0": "0x...",
///   "token1": "0x...",
///   "tick_lower": -887220,
///   "tick_upper": 887220,
///   "amount0": "1.0",
///   "amount1": "2500.0",
///   "rebalance_threshold": 0.05,  // rebalance when price moves 5% outside range
///   "fee": 3000,
///   "interval_secs": 300
/// }
pub struct RangeLpStrategy;

#[async_trait]
impl Strategy for RangeLpStrategy {
    fn name(&self) -> &str { "Range LP" }
    fn kind(&self) -> StrategyKind { StrategyKind::RangeLp }

    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>> {
        let config = &ctx.record.config;
        let pool_address = config["pool_address"].as_str()
            .ok_or_else(|| eyre::eyre!("missing pool_address"))?;
        let tick_lower = config["tick_lower"].as_i64()
            .ok_or_else(|| eyre::eyre!("missing tick_lower"))? as i32;
        let tick_upper = config["tick_upper"].as_i64()
            .ok_or_else(|| eyre::eyre!("missing tick_upper"))? as i32;

        let provider = ctx.chain_manager.provider(&ctx.record.chain)
            .ok_or_else(|| eyre::eyre!("chain not configured"))?;

        let state = pool::get_pool_state(provider, pool_address, ctx.record.chain).await?;
        let current_tick = state.tick;

        if current_tick < tick_lower || current_tick > tick_upper {
            // Position is out of range — signal rebalance needed
            let token0 = config["token0"].as_str().unwrap_or("token0");
            let token1 = config["token1"].as_str().unwrap_or("token1");
            let fee = config["fee"].as_u64().unwrap_or(3000) as u32;

            // When out of range below, swap token1 -> token0 to rebalance
            // When out of range above, swap token0 -> token1
            let (tin, tout) = if current_tick < tick_lower {
                (token1, token0)
            } else {
                (token0, token1)
            };

            let rebalance_amount = config.get("rebalance_amount")
                .and_then(|v| v.as_str())
                .unwrap_or("0");

            Ok(vec![Action::Swap {
                chain: ctx.record.chain,
                token_in: tin.to_string(),
                token_out: tout.to_string(),
                amount: rebalance_amount.to_string(),
                fee,
            }])
        } else {
            Ok(vec![Action::Skip {
                reason: format!("tick {} in range [{}, {}]", current_tick, tick_lower, tick_upper),
            }])
        }
    }

    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> {
        if config.get("pool_address").and_then(|v| v.as_str()).is_none() {
            return Err(eyre::eyre!("Range LP requires 'pool_address'"));
        }
        if config.get("tick_lower").and_then(|v| v.as_i64()).is_none() {
            return Err(eyre::eyre!("Range LP requires 'tick_lower'"));
        }
        if config.get("tick_upper").and_then(|v| v.as_i64()).is_none() {
            return Err(eyre::eyre!("Range LP requires 'tick_upper'"));
        }
        Ok(())
    }
}
