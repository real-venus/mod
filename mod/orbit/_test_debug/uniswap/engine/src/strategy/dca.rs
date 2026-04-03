use async_trait::async_trait;
use crate::types::StrategyKind;
use super::{Strategy, StrategyContext, Action};

/// Dollar-Cost Averaging: buy a fixed amount of token at regular intervals
///
/// Config:
/// {
///   "token_in": "0x...",       // token to sell
///   "token_out": "0x...",      // token to buy
///   "amount_per_tick": "100",  // amount to swap each tick (in token_in units)
///   "fee": 3000,               // pool fee tier
///   "interval_secs": 3600,     // seconds between buys
///   "max_executions": null     // optional cap on total executions
/// }
pub struct DcaStrategy;

#[async_trait]
impl Strategy for DcaStrategy {
    fn name(&self) -> &str { "DCA" }
    fn kind(&self) -> StrategyKind { StrategyKind::Dca }

    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>> {
        let config = &ctx.record.config;
        let token_in = config["token_in"].as_str()
            .ok_or_else(|| eyre::eyre!("missing token_in"))?;
        let token_out = config["token_out"].as_str()
            .ok_or_else(|| eyre::eyre!("missing token_out"))?;
        let amount = config["amount_per_tick"].as_str()
            .ok_or_else(|| eyre::eyre!("missing amount_per_tick"))?;
        let fee = config["fee"].as_u64().unwrap_or(3000) as u32;

        // Check max executions
        if let Some(max) = config.get("max_executions").and_then(|v| v.as_u64()) {
            let current = ctx.record.executions.len() as u64;
            if current >= max {
                return Ok(vec![Action::Skip {
                    reason: format!("max executions reached ({}/{})", current, max),
                }]);
            }
        }

        Ok(vec![Action::Swap {
            chain: ctx.record.chain,
            token_in: token_in.to_string(),
            token_out: token_out.to_string(),
            amount: amount.to_string(),
            fee,
        }])
    }

    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> {
        if config.get("token_in").and_then(|v| v.as_str()).is_none() {
            return Err(eyre::eyre!("DCA requires 'token_in' address"));
        }
        if config.get("token_out").and_then(|v| v.as_str()).is_none() {
            return Err(eyre::eyre!("DCA requires 'token_out' address"));
        }
        if config.get("amount_per_tick").and_then(|v| v.as_str()).is_none() {
            return Err(eyre::eyre!("DCA requires 'amount_per_tick'"));
        }
        Ok(())
    }
}
