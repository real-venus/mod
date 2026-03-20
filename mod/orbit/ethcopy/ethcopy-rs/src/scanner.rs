use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;

use ethers::providers::Middleware;
use ethers::types::{Filter, H256, U256, I256};
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::config::{SWAP_TOPIC_V2, SWAP_TOPIC_V3};
use crate::rpc::RpcPool;
use crate::types::{PollResult, SwapEvent};

pub struct Scanner {
    rpc: Arc<RpcPool>,
    /// Last scanned block per chain
    last_block: dashmap::DashMap<u64, u64>,
    /// Accumulated swap events from polling
    events: Mutex<Vec<SwapEvent>>,
}

impl Scanner {
    pub fn new(rpc: Arc<RpcPool>) -> Self {
        Self {
            rpc,
            last_block: dashmap::DashMap::new(),
            events: Mutex::new(Vec::new()),
        }
    }

    /// Poll a chain for swap events over the last N blocks.
    /// Returns a PollResult with counts and unique traders.
    pub async fn poll_chain(&self, chain_id: u64, chain_name: &str, blocks: u64) -> Result<PollResult, String> {
        let provider = self.rpc.get_provider(chain_id)
            .ok_or_else(|| format!("No provider for chain {}", chain_id))?;

        // Get latest block
        let start = Instant::now();
        let latest = provider.get_block_number().await
            .map_err(|e| {
                self.rpc.report_error(chain_id);
                format!("get_block_number failed: {}", e)
            })?
            .as_u64();
        self.rpc.report_success(chain_id, start.elapsed().as_millis() as u64);

        let from_block = latest.saturating_sub(blocks);
        info!("Polling {} blocks {}-{}", chain_name, from_block, latest);

        let mut v2_count = 0u64;
        let mut v3_count = 0u64;
        let mut traders: HashSet<String> = HashSet::new();
        let mut new_events = Vec::new();

        // Scan V3 swaps
        let v3_topic: H256 = SWAP_TOPIC_V3.parse().unwrap_or_default();
        let filter_v3 = Filter::new()
            .from_block(from_block)
            .to_block(latest)
            .topic0(v3_topic);

        let start = Instant::now();
        match provider.get_logs(&filter_v3).await {
            Ok(logs) => {
                self.rpc.report_success(chain_id, start.elapsed().as_millis() as u64);
                v3_count = logs.len() as u64;
                for log in &logs {
                    if let Some(event) = Self::parse_v3_log(chain_id, log) {
                        traders.insert(event.trader.clone());
                        new_events.push(event);
                    }
                }
            }
            Err(e) => {
                self.rpc.report_error(chain_id);
                warn!("Chain {} V3 getLogs failed: {}", chain_id, e);
            }
        }

        // Scan V2 swaps
        let v2_topic: H256 = SWAP_TOPIC_V2.parse().unwrap_or_default();
        let filter_v2 = Filter::new()
            .from_block(from_block)
            .to_block(latest)
            .topic0(v2_topic);

        let start = Instant::now();
        match provider.get_logs(&filter_v2).await {
            Ok(logs) => {
                self.rpc.report_success(chain_id, start.elapsed().as_millis() as u64);
                v2_count = logs.len() as u64;
                for log in &logs {
                    if let Some(event) = Self::parse_v2_log(chain_id, log) {
                        traders.insert(event.trader.clone());
                        new_events.push(event);
                    }
                }
            }
            Err(e) => {
                self.rpc.report_error(chain_id);
                warn!("Chain {} V2 getLogs failed: {}", chain_id, e);
            }
        }

        // Store events
        {
            let mut events = self.events.lock().await;
            events.extend(new_events);
        }

        self.last_block.insert(chain_id, latest);

        let mut trader_list: Vec<String> = traders.into_iter().collect();
        trader_list.sort();

        info!("{}: {} v2 + {} v3 events, {} unique traders", chain_name, v2_count, v3_count, trader_list.len());

        Ok(PollResult {
            chain: chain_name.to_string(),
            chain_id,
            from_block,
            to_block: latest,
            v2_events: v2_count,
            v3_events: v3_count,
            unique_traders: trader_list,
        })
    }

    /// Continuous polling loop for a chain
    pub async fn poll_loop(self: Arc<Self>, chain_id: u64, chain_name: String, interval_ms: u64) {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(interval_ms));
        info!("Starting scanner loop for {} ({}ms)", chain_name, interval_ms);

        loop {
            interval.tick().await;

            let provider = match self.rpc.get_provider(chain_id) {
                Some(p) => p,
                None => continue,
            };

            let start = Instant::now();
            let current_block = match provider.get_block_number().await {
                Ok(b) => b.as_u64(),
                Err(e) => {
                    self.rpc.report_error(chain_id);
                    debug!("Chain {} block_number failed: {}", chain_id, e);
                    continue;
                }
            };
            self.rpc.report_success(chain_id, start.elapsed().as_millis() as u64);

            let from_block = self.last_block.get(&chain_id)
                .map(|v| *v + 1)
                .unwrap_or(current_block.saturating_sub(2));

            if from_block > current_block {
                continue;
            }

            let to_block = current_block.min(from_block + 100);

            // V3
            let v3_topic: H256 = SWAP_TOPIC_V3.parse().unwrap_or_default();
            let filter = Filter::new().from_block(from_block).to_block(to_block).topic0(v3_topic);
            let start = Instant::now();
            if let Ok(logs) = provider.get_logs(&filter).await {
                self.rpc.report_success(chain_id, start.elapsed().as_millis() as u64);
                let mut events = self.events.lock().await;
                for log in &logs {
                    if let Some(event) = Self::parse_v3_log(chain_id, log) {
                        events.push(event);
                    }
                }
            }

            // V2
            let v2_topic: H256 = SWAP_TOPIC_V2.parse().unwrap_or_default();
            let filter = Filter::new().from_block(from_block).to_block(to_block).topic0(v2_topic);
            let start = Instant::now();
            if let Ok(logs) = provider.get_logs(&filter).await {
                self.rpc.report_success(chain_id, start.elapsed().as_millis() as u64);
                let mut events = self.events.lock().await;
                for log in &logs {
                    if let Some(event) = Self::parse_v2_log(chain_id, log) {
                        events.push(event);
                    }
                }
            }

            self.last_block.insert(chain_id, to_block);
        }
    }

    /// Get all accumulated events and drain
    pub async fn drain_events(&self) -> Vec<SwapEvent> {
        let mut events = self.events.lock().await;
        std::mem::take(&mut *events)
    }

    /// Get events without draining (for reads)
    pub async fn get_events(&self, limit: usize) -> Vec<SwapEvent> {
        let events = self.events.lock().await;
        let len = events.len();
        let start = len.saturating_sub(limit);
        events[start..].to_vec()
    }

    /// Parse V3 Swap log into SwapEvent
    fn parse_v3_log(chain_id: u64, log: &ethers::types::Log) -> Option<SwapEvent> {
        if log.topics.len() < 3 || log.data.len() < 160 {
            return None;
        }

        let sender = format!("{:?}", ethers::types::Address::from(log.topics[1]));
        let _recipient = format!("{:?}", ethers::types::Address::from(log.topics[2]));

        let amount0 = I256::from_raw(U256::from_big_endian(&log.data[0..32]));
        let amount1 = I256::from_raw(U256::from_big_endian(&log.data[32..64]));

        let (amount_in, amount_out) = if amount0.is_positive() {
            (amount0.into_raw().to_string(), amount1.into_raw().to_string())
        } else {
            (amount1.into_raw().to_string(), amount0.into_raw().to_string())
        };

        let pool = format!("{:?}", log.address);
        let tx_hash = log.transaction_hash.map(|h| format!("{:?}", h)).unwrap_or_default();
        let block = log.block_number.map(|b| b.as_u64()).unwrap_or(0);

        Some(SwapEvent {
            chain_id,
            tx_hash,
            block_number: block,
            timestamp: 0,
            trader: sender, // tx origin resolved later if needed
            pool,
            token_in: String::new(),
            token_out: String::new(),
            amount_in,
            amount_out,
            dex: "uniswap_v3".into(),
        })
    }

    /// Parse V2 Swap log into SwapEvent
    fn parse_v2_log(chain_id: u64, log: &ethers::types::Log) -> Option<SwapEvent> {
        if log.topics.len() < 3 || log.data.len() < 128 {
            return None;
        }

        let _sender = format!("{:?}", ethers::types::Address::from(log.topics[1]));
        let to = format!("{:?}", ethers::types::Address::from(log.topics[2]));

        let amount0_in = U256::from_big_endian(&log.data[0..32]);
        let amount0_out = U256::from_big_endian(&log.data[32..64]);
        let amount1_in = U256::from_big_endian(&log.data[64..96]);
        let amount1_out = U256::from_big_endian(&log.data[96..128]);

        let (amount_in, amount_out) = if !amount0_in.is_zero() {
            (amount0_in.to_string(), amount1_out.to_string())
        } else {
            (amount1_in.to_string(), amount0_out.to_string())
        };

        let pool = format!("{:?}", log.address);
        let tx_hash = log.transaction_hash.map(|h| format!("{:?}", h)).unwrap_or_default();
        let block = log.block_number.map(|b| b.as_u64()).unwrap_or(0);

        Some(SwapEvent {
            chain_id,
            tx_hash,
            block_number: block,
            timestamp: 0,
            trader: to, // recipient for V2
            pool,
            token_in: String::new(),
            token_out: String::new(),
            amount_in,
            amount_out,
            dex: "uniswap_v2".into(),
        })
    }
}
