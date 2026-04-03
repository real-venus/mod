use async_trait::async_trait;
use crate::pool;
use crate::types::{ChainId, StrategyKind};
use super::{Strategy, StrategyContext, Action};

/// Cross-Chain Arbitrage: spot price differences between Base and Polygon
///
/// Config:
/// {
///   "pool_base": "0x...",          // pool address on Base
///   "pool_polygon": "0x...",       // pool address on Polygon
///   "token_in_base": "0x...",
///   "token_out_base": "0x...",
///   "token_in_polygon": "0x...",
///   "token_out_polygon": "0x...",
///   "amount": "100",
///   "min_spread": 0.005,           // minimum 0.5% price difference to trigger
///   "fee": 3000,
///   "interval_secs": 10
/// }
pub struct ArbStrategy;

#[async_trait]
impl Strategy for ArbStrategy {
    fn name(&self) -> &str { "Cross-Chain Arb" }
    fn kind(&self) -> StrategyKind { StrategyKind::Arb }

    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>> {
        let config = &ctx.record.config;
        let pool_base = config["pool_base"].as_str()
            .ok_or_else(|| eyre::eyre!("missing pool_base"))?;
        let pool_polygon = config["pool_polygon"].as_str()
            .ok_or_else(|| eyre::eyre!("missing pool_polygon"))?;
        let min_spread = config["min_spread"].as_f64().unwrap_or(0.005);
        let amount = config["amount"].as_str()
            .ok_or_else(|| eyre::eyre!("missing amount"))?;
        let fee = config["fee"].as_u64().unwrap_or(3000) as u32;

        let base_provider = ctx.chain_manager.provider(&ChainId::Base)
            .ok_or_else(|| eyre::eyre!("Base not configured"))?;
        let polygon_provider = ctx.chain_manager.provider(&ChainId::Polygon)
            .ok_or_else(|| eyre::eyre!("Polygon not configured"))?;

        // Fetch both prices concurrently
        let (base_price, polygon_price) = tokio::join!(
            pool::get_pool_price(base_provider, pool_base),
            pool::get_pool_price(polygon_provider, pool_polygon),
        );

        let base_price = base_price?;
        let polygon_price = polygon_price?;

        let spread = (base_price - polygon_price).abs() / base_price.min(polygon_price);

        if spread >= min_spread {
            // Buy on cheaper chain, sell on more expensive
            let (buy_chain, sell_chain) = if base_price < polygon_price {
                (ChainId::Base, ChainId::Polygon)
            } else {
                (ChainId::Polygon, ChainId::Base)
            };

            let buy_key = if buy_chain == ChainId::Base { "base" } else { "polygon" };
            let token_in = config[format!("token_in_{}", buy_key)].as_str()
                .unwrap_or_default();
            let token_out = config[format!("token_out_{}", buy_key)].as_str()
                .unwrap_or_default();

            Ok(vec![Action::Swap {
                chain: buy_chain,
                token_in: token_in.to_string(),
                token_out: token_out.to_string(),
                amount: amount.to_string(),
                fee,
            }])
        } else {
            Ok(vec![Action::Skip {
                reason: format!(
                    "spread {:.4}% < min {:.4}% (base={:.6}, polygon={:.6})",
                    spread * 100.0, min_spread * 100.0, base_price, polygon_price
                ),
            }])
        }
    }

    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> {
        for field in &["pool_base", "pool_polygon", "amount"] {
            if config.get(*field).and_then(|v| v.as_str()).is_none() {
                return Err(eyre::eyre!("Arb requires '{}'", field));
            }
        }
        Ok(())
    }
}
