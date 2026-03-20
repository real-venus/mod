use std::sync::Arc;
use alloy::primitives::{Address, B256, FixedBytes};
use alloy::providers::Provider;
use alloy::rpc::types::Filter;
use chrono::Utc;
use eyre::Result;

use crate::chains::ChainManager;
use crate::types::{ChainId, WalletTrade};
use crate::whitelist::WhitelistManager;

// Uniswap V3 Pool Swap event signature
// Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
const SWAP_EVENT_SIG: &str = "c42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

/// Block time estimates per chain (seconds)
fn block_time_secs(chain: ChainId) -> u64 {
    match chain {
        ChainId::Base => 2,
        ChainId::Polygon => 2,
    }
}

/// Scrape swap events for a wallet across all pools on a chain
pub async fn scrape_wallet_trades(
    chain_manager: &Arc<ChainManager>,
    whitelist: &Arc<WhitelistManager>,
    wallet: &str,
    chain: ChainId,
    days: u32,
) -> Result<Vec<WalletTrade>> {
    let provider = chain_manager.provider(&chain)
        .ok_or_else(|| eyre::eyre!("No provider for chain {:?}", chain))?;
    let config = chain_manager.config(&chain)
        .ok_or_else(|| eyre::eyre!("No config for chain {:?}", chain))?;

    let current_block = provider.get_block_number().await?;
    let blocks_per_day = 86400 / block_time_secs(chain);
    let from_block = current_block.saturating_sub(blocks_per_day * days as u64);

    let wallet_addr: Address = wallet.parse()
        .map_err(|_| eyre::eyre!("Invalid wallet address"))?;

    // Collect all pool addresses from config
    let pool_addresses: Vec<Address> = config.pools.iter()
        .filter_map(|p| p.address.parse().ok())
        .collect();

    let mut all_trades: Vec<WalletTrade> = Vec::new();
    let chunk_size: u64 = 10_000;
    let swap_topic: B256 = FixedBytes::from_slice(&hex::decode(SWAP_EVENT_SIG)?);

    // Pad wallet address to 32 bytes for topic filtering
    let mut wallet_topic_bytes = [0u8; 32];
    wallet_topic_bytes[12..32].copy_from_slice(wallet_addr.as_slice());
    let wallet_topic = B256::from(wallet_topic_bytes);

    let mut block = from_block;
    while block <= current_block {
        let to_block = std::cmp::min(block + chunk_size - 1, current_block);

        // Query for swaps where wallet is sender (topic1) or recipient (topic2)
        for is_sender in [true, false] {
            let mut filter = Filter::new()
                .from_block(block)
                .to_block(to_block)
                .event_signature(swap_topic);

            if !pool_addresses.is_empty() {
                filter = filter.address(pool_addresses.clone());
            }

            // topic1 = sender, topic2 = recipient
            if is_sender {
                filter = filter.topic1(wallet_topic);
            } else {
                filter = filter.topic2(wallet_topic);
            }

            match provider.get_logs(&filter).await {
                Ok(logs) => {
                    for log in logs {
                        if log.data().data.len() < 160 {
                            continue;
                        }

                        let pool_addr = format!("{:?}", log.address());
                        let tx_hash = log.transaction_hash
                            .map(|h| format!("{:?}", h))
                            .unwrap_or_default();
                        let block_num = log.block_number.unwrap_or(0);

                        // Decode swap data: amount0 (int256), amount1 (int256), sqrtPriceX96, liquidity, tick
                        let data = &log.data().data;
                        let amount0 = decode_int256(&data[0..32]);
                        let amount1 = decode_int256(&data[32..64]);

                        // Find pool info to determine tokens
                        let pool_info = config.pools.iter()
                            .find(|p| p.address.to_lowercase() == pool_addr.to_lowercase());

                        if let Some(pool) = pool_info {
                            // Determine direction: negative amount = token going out of pool (user receives)
                            // positive amount = token going into pool (user sends)
                            let (token_in_sym, token_out_sym, amt_in, amt_out) = if amount0 > 0 {
                                // User sent token0, received token1
                                (&pool.token0, &pool.token1, amount0.unsigned_abs().to_string(), amount1.unsigned_abs().to_string())
                            } else {
                                // User sent token1, received token0
                                (&pool.token1, &pool.token0, amount1.unsigned_abs().to_string(), amount0.unsigned_abs().to_string())
                            };

                            // Look up token addresses
                            let token_in_addr = config.tokens.get(token_in_sym.as_str())
                                .map(|t| t.address.clone()).unwrap_or_default();
                            let token_out_addr = config.tokens.get(token_out_sym.as_str())
                                .map(|t| t.address.clone()).unwrap_or_default();

                            // Check whitelist
                            if !whitelist.is_whitelisted(chain, &token_in_addr)
                                && !whitelist.is_whitelisted(chain, &token_out_addr) {
                                continue;
                            }

                            // Estimate timestamp from block number
                            let blocks_ago = current_block.saturating_sub(block_num);
                            let secs_ago = blocks_ago * block_time_secs(chain);
                            let timestamp = Utc::now() - chrono::Duration::seconds(secs_ago as i64);

                            all_trades.push(WalletTrade {
                                wallet: wallet.to_lowercase(),
                                chain,
                                tx_hash: tx_hash.clone(),
                                block_number: block_num,
                                timestamp,
                                token_in: token_in_addr,
                                token_in_symbol: token_in_sym.clone(),
                                token_out: token_out_addr,
                                token_out_symbol: token_out_sym.clone(),
                                amount_in: amt_in,
                                amount_out: amt_out,
                                pool: pool_addr.clone(),
                                fee: pool.fee,
                            });
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Error fetching logs for block range {}-{}: {}", block, to_block, e);
                }
            }
        }

        block = to_block + 1;
    }

    // Dedup by tx_hash
    all_trades.sort_by(|a, b| a.block_number.cmp(&b.block_number));
    all_trades.dedup_by(|a, b| a.tx_hash == b.tx_hash);

    Ok(all_trades)
}

/// Load cached trades from disk
pub fn load_cached_trades(data_path: &str, wallet: &str) -> Vec<WalletTrade> {
    let path = format!("{}/trades/{}.json", data_path, wallet.to_lowercase());
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    }
}

/// Save trades to disk
pub fn save_trades(data_path: &str, wallet: &str, trades: &[WalletTrade]) {
    let dir = format!("{}/trades", data_path);
    let _ = std::fs::create_dir_all(&dir);
    let path = format!("{}/{}.json", dir, wallet.to_lowercase());
    if let Ok(json) = serde_json::to_string_pretty(trades) {
        let _ = std::fs::write(&path, json);
    }
}

/// Decode a 32-byte big-endian int256 as i128 (enough precision for our needs)
pub fn decode_int256(data: &[u8]) -> i128 {
    if data.len() < 32 {
        return 0;
    }
    let is_negative = data[0] & 0x80 != 0;
    // Take last 16 bytes for i128
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&data[16..32]);
    let abs_val = u128::from_be_bytes(bytes);

    if is_negative {
        // Two's complement for the lower 128 bits
        -((!abs_val).wrapping_add(1) as i128)
    } else {
        abs_val as i128
    }
}
