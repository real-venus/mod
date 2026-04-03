use async_trait::async_trait;
use crate::quote;
use crate::types::StrategyKind;
use super::{Strategy, StrategyContext, Action};

/// Portfolio Rebalancing: maintain target weights across tokens
///
/// Config:
/// {
///   "wallet": "0x...",
///   "targets": {
///     "0xTokenA": 0.5,   // 50% weight
///     "0xTokenB": 0.3,   // 30% weight
///     "0xTokenC": 0.2    // 20% weight
///   },
///   "threshold": 0.05,     // rebalance when any token deviates >5% from target
///   "base_token": "0x...", // quote everything in this token (e.g., USDC)
///   "fee": 3000,
///   "interval_secs": 3600
/// }
pub struct RebalanceStrategy;

#[async_trait]
impl Strategy for RebalanceStrategy {
    fn name(&self) -> &str { "Rebalance" }
    fn kind(&self) -> StrategyKind { StrategyKind::Rebalance }

    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>> {
        let config = &ctx.record.config;
        let wallet = config["wallet"].as_str()
            .ok_or_else(|| eyre::eyre!("missing wallet"))?;
        let targets = config["targets"].as_object()
            .ok_or_else(|| eyre::eyre!("missing targets map"))?;
        let threshold = config["threshold"].as_f64().unwrap_or(0.05);
        let base_token = config["base_token"].as_str()
            .ok_or_else(|| eyre::eyre!("missing base_token"))?;
        let fee = config["fee"].as_u64().unwrap_or(3000) as u32;

        let provider = ctx.chain_manager.provider(&ctx.record.chain)
            .ok_or_else(|| eyre::eyre!("chain not configured"))?;

        // Get balances for all tokens
        let mut balances: Vec<(String, f64)> = Vec::new();
        for (token_addr, _) in targets {
            let (balance_str, _decimals) = quote::get_balance(
                provider.clone(),
                token_addr,
                wallet,
            ).await?;
            let balance: f64 = balance_str.parse().unwrap_or(0.0);
            balances.push((token_addr.clone(), balance));
        }

        let total_value: f64 = balances.iter().map(|(_, b)| b).sum();
        if total_value == 0.0 {
            return Ok(vec![Action::Skip {
                reason: "zero portfolio value".to_string(),
            }]);
        }

        // Find the token most over-weight and most under-weight
        let mut max_over: Option<(&str, f64)> = None;
        let mut max_under: Option<(&str, f64)> = None;

        for (token_addr, balance) in &balances {
            let current_weight = balance / total_value;
            let target_weight = targets[token_addr].as_f64().unwrap_or(0.0);
            let deviation = current_weight - target_weight;

            if deviation > threshold {
                if max_over.is_none() || deviation > max_over.unwrap().1 {
                    max_over = Some((token_addr.as_str(), deviation));
                }
            } else if deviation < -threshold {
                if max_under.is_none() || deviation < max_under.unwrap().1 {
                    max_under = Some((token_addr.as_str(), deviation));
                }
            }
        }

        match (max_over, max_under) {
            (Some((over_token, over_dev)), Some((under_token, under_dev))) => {
                // Swap from overweight to underweight
                let swap_pct = over_dev.min(under_dev.abs()) / 2.0;
                let swap_amount = total_value * swap_pct;

                Ok(vec![Action::Swap {
                    chain: ctx.record.chain,
                    token_in: over_token.to_string(),
                    token_out: under_token.to_string(),
                    amount: format!("{:.6}", swap_amount),
                    fee,
                }])
            }
            _ => {
                Ok(vec![Action::Skip {
                    reason: format!("portfolio within {}% threshold", threshold * 100.0),
                }])
            }
        }
    }

    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> {
        if config.get("wallet").and_then(|v| v.as_str()).is_none() {
            return Err(eyre::eyre!("Rebalance requires 'wallet' address"));
        }
        if config.get("targets").and_then(|v| v.as_object()).is_none() {
            return Err(eyre::eyre!("Rebalance requires 'targets' object mapping token -> weight"));
        }
        if config.get("base_token").and_then(|v| v.as_str()).is_none() {
            return Err(eyre::eyre!("Rebalance requires 'base_token' address"));
        }
        Ok(())
    }
}
