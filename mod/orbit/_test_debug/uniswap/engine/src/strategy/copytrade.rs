use async_trait::async_trait;
use alloy::primitives::{Address, B256, FixedBytes};
use alloy::providers::Provider;
use alloy::rpc::types::Filter;

use super::{Action, Strategy, StrategyContext};
use crate::types::StrategyKind;

pub struct CopyTradeStrategy;

#[async_trait]
impl Strategy for CopyTradeStrategy {
    fn name(&self) -> &str {
        "copy_trade"
    }

    fn kind(&self) -> StrategyKind {
        StrategyKind::CopyTrade
    }

    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>> {
        let config = &ctx.record.config;
        let wallet_address = config.get("wallet_address")
            .and_then(|v| v.as_str())
            .ok_or_else(|| eyre::eyre!("Missing wallet_address"))?;
        let max_trade_size = config.get("max_trade_size")
            .and_then(|v| v.as_str())
            .unwrap_or("1000000000000000000"); // 1 ETH default
        let _slippage = config.get("slippage_tolerance")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.01);

        let chain = ctx.record.chain;
        let provider = ctx.chain_manager.provider(&chain)
            .ok_or_else(|| eyre::eyre!("No provider for chain"))?;
        let chain_config = ctx.chain_manager.config(&chain)
            .ok_or_else(|| eyre::eyre!("No config for chain"))?;

        // Check last 2 minutes of blocks for new swaps
        let current_block = provider.get_block_number().await?;
        let blocks_back = 60; // ~2 min at 2s/block
        let from_block = current_block.saturating_sub(blocks_back);

        let wallet_addr: Address = wallet_address.parse()
            .map_err(|_| eyre::eyre!("Invalid wallet address"))?;

        let swap_sig = "c42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
        let swap_topic: B256 = FixedBytes::from_slice(&hex::decode(swap_sig)?);

        // Pad wallet address to 32 bytes
        let mut wallet_topic_bytes = [0u8; 32];
        wallet_topic_bytes[12..32].copy_from_slice(wallet_addr.as_slice());
        let wallet_topic = B256::from(wallet_topic_bytes);

        let pool_addresses: Vec<Address> = chain_config.pools.iter()
            .filter_map(|p| p.address.parse().ok())
            .collect();

        let mut actions = Vec::new();

        // Check both sender and recipient
        for is_sender in [true, false] {
            let mut filter = Filter::new()
                .from_block(from_block)
                .to_block(current_block)
                .event_signature(swap_topic);

            if !pool_addresses.is_empty() {
                filter = filter.address(pool_addresses.clone());
            }

            if is_sender {
                filter = filter.topic1(wallet_topic);
            } else {
                filter = filter.topic2(wallet_topic);
            }

            let logs = provider.get_logs(&filter).await?;

            for log in logs {
                if log.data().data.len() < 160 {
                    continue;
                }

                let pool_addr = format!("{:?}", log.address());

                // Find pool info
                let pool_info = chain_config.pools.iter()
                    .find(|p| p.address.to_lowercase() == pool_addr.to_lowercase());

                if let Some(pool) = pool_info {
                    let data = &log.data().data;
                    let amount0_positive = data[0] & 0x80 == 0; // Check sign bit

                    // Determine direction
                    let (token_in_sym, token_out_sym) = if amount0_positive {
                        (&pool.token0, &pool.token1)
                    } else {
                        (&pool.token1, &pool.token0)
                    };

                    // Look up token addresses
                    let token_in_addr = chain_config.tokens.get(token_in_sym.as_str())
                        .map(|t| t.address.clone());
                    let token_out_addr = chain_config.tokens.get(token_out_sym.as_str())
                        .map(|t| t.address.clone());

                    if let (Some(tin), Some(tout)) = (token_in_addr, token_out_addr) {
                        // Check token whitelist from config
                        let whitelist = config.get("token_whitelist")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>());

                        let allowed = match &whitelist {
                            Some(list) => {
                                list.iter().any(|a| a.to_lowercase() == tin.to_lowercase())
                                || list.iter().any(|a| a.to_lowercase() == tout.to_lowercase())
                            }
                            None => true, // No whitelist = allow all
                        };

                        if allowed {
                            actions.push(Action::Swap {
                                chain,
                                token_in: tin,
                                token_out: tout,
                                amount: max_trade_size.to_string(),
                                fee: pool.fee,
                            });
                        }
                    }
                }
            }
        }

        if actions.is_empty() {
            actions.push(Action::Skip {
                reason: format!("No new trades from {}", &wallet_address[..10]),
            });
        }

        Ok(actions)
    }

    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> {
        config.get("wallet_address")
            .and_then(|v| v.as_str())
            .ok_or_else(|| eyre::eyre!("Missing wallet_address (string)"))?;

        // Optional fields with defaults
        if let Some(size) = config.get("max_trade_size") {
            size.as_str().ok_or_else(|| eyre::eyre!("max_trade_size must be a string"))?;
        }

        if let Some(slippage) = config.get("slippage_tolerance") {
            slippage.as_f64().ok_or_else(|| eyre::eyre!("slippage_tolerance must be a number"))?;
        }

        Ok(())
    }
}
