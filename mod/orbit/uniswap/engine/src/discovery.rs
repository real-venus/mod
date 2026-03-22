use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicUsize, Ordering};
use alloy::providers::Provider;
use chrono::Utc;
use eyre::Result;

use crate::chains::ChainManager;
use crate::scraper::decode_int256;
use crate::types::*;
use crate::whitelist::WhitelistManager;

const SWAP_EVENT_SIG: &str = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

fn block_time_secs(chain: ChainId) -> u64 {
    match chain {
        ChainId::Base => 2,
        ChainId::Polygon => 2,
    }
}

/// Free public RPC gateways per chain — round-robin to avoid rate limits
fn free_rpc_gateways(chain: ChainId) -> Vec<&'static str> {
    match chain {
        ChainId::Base => vec![
            "https://mainnet.base.org",
            "https://base.gateway.tenderly.co",
            "https://base-rpc.publicnode.com",
            "https://base.meowrpc.com",
            "https://1rpc.io/base",
            "https://base.drpc.org",
        ],
        ChainId::Polygon => vec![
            "https://polygon-bor-rpc.publicnode.com",
            "https://polygon.meowrpc.com",
            "https://1rpc.io/matic",
            "https://polygon.drpc.org",
            "https://polygon-rpc.com",
        ],
    }
}

/// Round-robin gateway selector
pub struct RpcRoundRobin {
    gateways: Vec<String>,
    index: AtomicUsize,
}

impl RpcRoundRobin {
    pub fn new(chain: ChainId, primary_rpc: &str) -> Self {
        let mut gateways: Vec<String> = vec![primary_rpc.to_string()];
        for gw in free_rpc_gateways(chain) {
            if gw != primary_rpc {
                gateways.push(gw.to_string());
            }
        }
        Self {
            gateways,
            index: AtomicUsize::new(0),
        }
    }

    /// Get next RPC URL in round-robin order
    pub fn next(&self) -> &str {
        let idx = self.index.fetch_add(1, Ordering::Relaxed) % self.gateways.len();
        &self.gateways[idx]
    }

    /// Skip to next gateway (call on error to rotate away from bad one)
    pub fn skip(&self) {
        self.index.fetch_add(1, Ordering::Relaxed);
    }

    pub fn len(&self) -> usize {
        self.gateways.len()
    }
}

struct TraderAccumulator {
    trade_count: u32,
    total_volume_usd: f64,
    token_counts: HashMap<String, u32>,
    first_seen: chrono::DateTime<Utc>,
    last_active: chrono::DateTime<Utc>,
}

pub struct DiscoveryManager {
    scan_status: Arc<RwLock<DiscoveryScanStatus>>,
    data_path: String,
}

impl DiscoveryManager {
    pub fn new(data_path: &str) -> Self {
        let _ = std::fs::create_dir_all(format!("{}/discovery", data_path));
        Self {
            scan_status: Arc::new(RwLock::new(DiscoveryScanStatus {
                scanning: false,
                chain: None,
                days: None,
                blocks_scanned: 0,
                blocks_total: 0,
                progress_pct: 0.0,
                wallets_found: 0,
                started_at: None,
                error: None,
            })),
            data_path: data_path.to_string(),
        }
    }

    pub fn get_status(&self) -> DiscoveryScanStatus {
        self.scan_status.read().unwrap().clone()
    }

    pub fn is_scanning(&self) -> bool {
        self.scan_status.read().unwrap().scanning
    }

    fn set_scanning(&self, chain: ChainId, days: u32) {
        let mut s = self.scan_status.write().unwrap();
        s.scanning = true;
        s.chain = Some(chain);
        s.days = Some(days);
        s.blocks_scanned = 0;
        s.blocks_total = 0;
        s.progress_pct = 0.0;
        s.wallets_found = 0;
        s.started_at = Some(Utc::now());
        s.error = None;
    }

    fn update_progress(&self, blocks_scanned: u64, blocks_total: u64, wallets_found: u32) {
        let mut s = self.scan_status.write().unwrap();
        s.blocks_scanned = blocks_scanned;
        s.blocks_total = blocks_total;
        s.progress_pct = if blocks_total > 0 {
            (blocks_scanned as f64 / blocks_total as f64) * 100.0
        } else {
            0.0
        };
        s.wallets_found = wallets_found;
    }

    fn set_done(&self) {
        let mut s = self.scan_status.write().unwrap();
        s.scanning = false;
        s.progress_pct = 100.0;
    }

    pub fn set_error(&self, err: String) {
        let mut s = self.scan_status.write().unwrap();
        s.scanning = false;
        s.error = Some(err);
    }

    pub async fn scan_top_traders(
        &self,
        chain_manager: &Arc<ChainManager>,
        whitelist: &Arc<WhitelistManager>,
        chain: ChainId,
        days: u32,
    ) -> Result<TopTradersCache> {
        self.set_scanning(chain, days);

        let provider = chain_manager.provider(&chain)
            .ok_or_else(|| eyre::eyre!("No provider for chain {:?}", chain))?;
        let config = chain_manager.config(&chain)
            .ok_or_else(|| eyre::eyre!("No config for chain {:?}", chain))?;

        let current_block = provider.get_block_number().await?;
        let blocks_per_day = 86400 / block_time_secs(chain);
        let from_block = current_block.saturating_sub(blocks_per_day * days as u64);
        let total_blocks = current_block - from_block;

        tracing::info!(
            "Discovery scan: {} {} days, blocks {}-{} ({} blocks)",
            chain.name(), days, from_block, current_block, total_blocks
        );

        // Pool addresses as hex strings for JSON-RPC filter
        let pool_hex: Vec<String> = config.pools.iter()
            .map(|p| p.address.to_lowercase())
            .collect();

        // Known contracts to exclude
        let excluded: std::collections::HashSet<String> = [
            config.router.to_lowercase(),
            config.quoter.to_lowercase(),
            config.position_manager.to_lowercase(),
        ].into_iter().collect();

        // Use reqwest directly for eth_getLogs with round-robin across free RPCs
        let http_client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (compatible; UniswapEngine/2.0)")
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let rpc_pool = RpcRoundRobin::new(chain, &config.rpc_url);
        tracing::info!("Discovery using {} RPC gateways (round-robin)", rpc_pool.len());

        let chunk_size: u64 = 2_000;
        let mut wallets: HashMap<String, TraderAccumulator> = HashMap::new();
        let mut block = from_block;
        let mut req_id: u64 = 1;
        let mut consecutive_errors: u32 = 0;

        while block <= current_block {
            let to_block = std::cmp::min(block + chunk_size - 1, current_block);

            // Build JSON-RPC request directly
            let filter = serde_json::json!({
                "fromBlock": format!("0x{:x}", block),
                "toBlock": format!("0x{:x}", to_block),
                "topics": [SWAP_EVENT_SIG],
                "address": pool_hex,
            });
            let body = serde_json::json!({
                "jsonrpc": "2.0",
                "method": "eth_getLogs",
                "params": [filter],
                "id": req_id,
            });
            req_id += 1;

            // Retry across multiple gateways with backoff
            let mut logs_result: Option<Vec<serde_json::Value>> = None;
            let max_attempts = (rpc_pool.len() * 2).max(5) as u64;
            for attempt in 0..max_attempts {
                let rpc_url = rpc_pool.next();
                if attempt > 0 {
                    let backoff = tokio::time::Duration::from_millis(500 * (attempt.min(4)));
                    tokio::time::sleep(backoff).await;
                }

                match http_client.post(rpc_url)
                    .json(&body)
                    .send()
                    .await
                {
                    Ok(resp) => {
                        if resp.status().is_success() {
                            match resp.json::<serde_json::Value>().await {
                                Ok(json) => {
                                    if let Some(result) = json.get("result").and_then(|r| r.as_array()) {
                                        logs_result = Some(result.clone());
                                        consecutive_errors = 0;
                                        break;
                                    } else if let Some(err) = json.get("error") {
                                        tracing::debug!("RPC error {} blocks {}-{}: {}", rpc_url, block, to_block, err);
                                        rpc_pool.skip(); // rotate to next gateway
                                    }
                                }
                                Err(e) => {
                                    tracing::debug!("JSON parse error from {}: {}", rpc_url, e);
                                    rpc_pool.skip();
                                }
                            }
                        } else {
                            tracing::debug!("HTTP {} from {} for blocks {}-{}", resp.status(), rpc_url, block, to_block);
                            rpc_pool.skip();
                        }
                    }
                    Err(e) => {
                        tracing::debug!("Request error {} blocks {}-{}: {}", rpc_url, block, to_block, e);
                        rpc_pool.skip();
                    }
                }
            }

            match logs_result {
                Some(logs) => {
                    for log in &logs {
                        // Parse log fields
                        let topics: Vec<&str> = log.get("topics")
                            .and_then(|t| t.as_array())
                            .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
                            .unwrap_or_default();

                        if topics.len() < 3 {
                            continue;
                        }

                        let data_hex = log.get("data").and_then(|d| d.as_str()).unwrap_or("");
                        let data_bytes = hex::decode(data_hex.trim_start_matches("0x")).unwrap_or_default();
                        if data_bytes.len() < 160 {
                            continue;
                        }

                        // Extract recipient (topics[2]) as the trader
                        let recipient_hex = topics[2].trim_start_matches("0x");
                        if recipient_hex.len() < 40 {
                            continue;
                        }
                        let wallet_addr = format!("0x{}", &recipient_hex[24..64]);

                        if excluded.contains(&wallet_addr) {
                            continue;
                        }

                        let pool_addr = log.get("address")
                            .and_then(|a| a.as_str())
                            .unwrap_or("")
                            .to_lowercase();

                        let block_num = log.get("blockNumber")
                            .and_then(|b| b.as_str())
                            .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok())
                            .unwrap_or(0);

                        // Decode amounts
                        let amount0 = decode_int256(&data_bytes[0..32]);
                        let amount1 = decode_int256(&data_bytes[32..64]);

                        // Find pool info
                        let pool_info = config.pools.iter()
                            .find(|p| p.address.to_lowercase() == pool_addr);

                        if let Some(pool) = pool_info {
                            let (token_in_sym, token_out_sym) = if amount0 > 0 {
                                (&pool.token0, &pool.token1)
                            } else {
                                (&pool.token1, &pool.token0)
                            };

                            // Check whitelist
                            let token_in_addr = config.tokens.get(token_in_sym.as_str())
                                .map(|t| t.address.clone()).unwrap_or_default();
                            let token_out_addr = config.tokens.get(token_out_sym.as_str())
                                .map(|t| t.address.clone()).unwrap_or_default();

                            if !whitelist.is_whitelisted(chain, &token_in_addr)
                                && !whitelist.is_whitelisted(chain, &token_out_addr) {
                                continue;
                            }

                            // USD volume estimate
                            let usd_vol = estimate_usd_volume(
                                &config.tokens,
                                amount0.unsigned_abs(), amount1.unsigned_abs(),
                                pool,
                            );

                            // Estimate timestamp
                            let blocks_ago = current_block.saturating_sub(block_num);
                            let secs_ago = blocks_ago * block_time_secs(chain);
                            let timestamp = Utc::now() - chrono::Duration::seconds(secs_ago as i64);

                            let acc = wallets.entry(wallet_addr).or_insert_with(|| TraderAccumulator {
                                trade_count: 0,
                                total_volume_usd: 0.0,
                                token_counts: HashMap::new(),
                                first_seen: timestamp,
                                last_active: timestamp,
                            });

                            acc.trade_count += 1;
                            acc.total_volume_usd += usd_vol;
                            *acc.token_counts.entry(token_in_sym.clone()).or_insert(0) += 1;
                            *acc.token_counts.entry(token_out_sym.clone()).or_insert(0) += 1;
                            if timestamp < acc.first_seen { acc.first_seen = timestamp; }
                            if timestamp > acc.last_active { acc.last_active = timestamp; }
                        }
                    }
                    tracing::debug!("Chunk {}-{}: {} logs, {} wallets total", block, to_block, logs.len(), wallets.len());
                }
                None => {
                    consecutive_errors += 1;
                    tracing::warn!("Discovery scan: failed chunk {}-{} after 5 retries (errors: {})", block, to_block, consecutive_errors);
                    if consecutive_errors > 20 {
                        tracing::error!("Too many consecutive errors, aborting scan");
                        break;
                    }
                }
            }

            let scanned = to_block - from_block;
            self.update_progress(scanned, total_blocks, wallets.len() as u32);
            block = to_block + 1;

            // Rate limit delay
            tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
        }

        // Sort by volume, assign ranks
        let mut traders: Vec<(String, TraderAccumulator)> = wallets.into_iter().collect();
        traders.sort_by(|a, b| b.1.total_volume_usd.partial_cmp(&a.1.total_volume_usd).unwrap_or(std::cmp::Ordering::Equal));

        let top_traders: Vec<TopTrader> = traders.into_iter()
            .take(200)
            .enumerate()
            .map(|(i, (addr, acc))| {
                let mut tokens: Vec<(String, u32)> = acc.token_counts.into_iter().collect();
                tokens.sort_by(|a, b| b.1.cmp(&a.1));
                let most_traded: Vec<String> = tokens.into_iter().take(3).map(|(s, _)| s).collect();

                TopTrader {
                    rank: (i + 1) as u32,
                    address: addr,
                    trade_count: acc.trade_count,
                    total_volume_usd: acc.total_volume_usd,
                    most_traded,
                    last_active: acc.last_active,
                    first_seen: acc.first_seen,
                }
            })
            .collect();

        let cache = TopTradersCache {
            chain,
            days,
            scanned_at: Utc::now(),
            from_block,
            to_block: current_block,
            traders: top_traders,
        };

        save_top_traders(&self.data_path, &cache);
        self.set_done();

        tracing::info!(
            "Discovery scan complete: {} traders ranked for {} {}d",
            cache.traders.len(), chain.name(), days
        );

        Ok(cache)
    }
}

fn estimate_usd_volume(
    tokens: &HashMap<String, TokenInfo>,
    abs_amount0: u128,
    abs_amount1: u128,
    pool: &PoolInfo,
) -> f64 {
    let stables = ["USDC", "USDT", "DAI"];

    if stables.contains(&pool.token0.as_str()) {
        let decimals = tokens.get(&pool.token0).map(|t| t.decimals).unwrap_or(6);
        return abs_amount0 as f64 / 10f64.powi(decimals as i32);
    }
    if stables.contains(&pool.token1.as_str()) {
        let decimals = tokens.get(&pool.token1).map(|t| t.decimals).unwrap_or(6);
        return abs_amount1 as f64 / 10f64.powi(decimals as i32);
    }

    0.0
}

pub fn load_cached_top_traders(data_path: &str, chain: ChainId, days: u32) -> Option<TopTradersCache> {
    let path = format!("{}/discovery/{}_{}.json", data_path, chain.name(), days);
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).ok()
    } else {
        None
    }
}

pub fn save_top_traders(data_path: &str, cache: &TopTradersCache) {
    let dir = format!("{}/discovery", data_path);
    let _ = std::fs::create_dir_all(&dir);
    let path = format!("{}/{}_{}.json", dir, cache.chain.name(), cache.days);
    if let Ok(json) = serde_json::to_string_pretty(cache) {
        let _ = std::fs::write(&path, json);
    }
}
