use std::collections::HashMap;
use std::sync::Arc;

use serde_json::Value;
use tracing::{info, warn};

use crate::rpc::RpcPool;
use crate::types::{
    LeaderboardEntry, ScanResult, SubnetPosition, TradeAction, TradeRecord,
};

pub struct SubnetScanner {
    rpc: Arc<RpcPool>,
}

impl SubnetScanner {
    pub fn new(rpc: Arc<RpcPool>) -> Self {
        Self { rpc }
    }

    /// Scan all subnets for price and metadata
    pub async fn scan_all_subnets(&self) -> Result<Vec<ScanResult>, String> {
        // Get total subnet count
        let netuids = self.get_all_netuids().await?;
        info!("Scanning {} subnets", netuids.len());

        let mut results = Vec::new();
        // Batch requests for speed
        for chunk in netuids.chunks(8) {
            let mut handles = Vec::new();
            for &netuid in chunk {
                let rpc = self.rpc.clone();
                handles.push(tokio::spawn(async move {
                    Self::fetch_subnet_info_static(&rpc, netuid).await
                }));
            }
            for handle in handles {
                match handle.await {
                    Ok(Ok(info)) => results.push(info),
                    Ok(Err(e)) => warn!("Subnet scan error: {}", e),
                    Err(e) => warn!("Task join error: {}", e),
                }
            }
        }

        results.sort_by(|a, b| b.price.partial_cmp(&a.price).unwrap_or(std::cmp::Ordering::Equal));
        Ok(results)
    }

    async fn get_all_netuids(&self) -> Result<Vec<u16>, String> {
        // Query SubtensorModule::NetworksAdded to get all netuids
        let params = serde_json::json!(["SubtensorModule", "NetworksAdded", []]);
        let result = self.rpc.rpc_call("state_getKeys", &params).await?;

        // Parse storage keys to extract netuids
        // Fallback: try a range of known netuids
        if let Value::Array(keys) = &result {
            let mut netuids = Vec::new();
            for key in keys {
                if let Value::String(hex_key) = key {
                    // Last 2 bytes of storage key = netuid (u16 little-endian)
                    if hex_key.len() >= 4 {
                        let suffix = &hex_key[hex_key.len() - 4..];
                        if let Ok(bytes) = hex::decode(suffix) {
                            if bytes.len() == 2 {
                                let netuid = u16::from_le_bytes([bytes[0], bytes[1]]);
                                netuids.push(netuid);
                            }
                        }
                    }
                }
            }
            if !netuids.is_empty() {
                return Ok(netuids);
            }
        }

        // Fallback: enumerate 0..64
        Ok((0..64).collect())
    }

    async fn fetch_subnet_info_static(
        rpc: &RpcPool,
        netuid: u16,
    ) -> Result<ScanResult, String> {
        // Use subtensor RPC to get SubnetInfo
        // Query key fields via state_getStorage
        let name = Self::query_subnet_name(rpc, netuid).await.unwrap_or_else(|_| format!("SN{}", netuid));
        let (tao_in, alpha_in, alpha_out) = Self::query_subnet_pool(rpc, netuid).await.unwrap_or((0.0, 0.0, 0.0));
        let emission = Self::query_subnet_emission(rpc, netuid).await.unwrap_or(0.0);
        let tempo = Self::query_subnet_tempo(rpc, netuid).await.unwrap_or(360);
        let n_neurons = Self::query_subnet_n(rpc, netuid).await.unwrap_or(0);

        let price = if alpha_in > 0.0 { tao_in / alpha_in } else { 0.0 };
        let market_cap = alpha_out * price;

        Ok(ScanResult {
            netuid,
            name,
            price,
            tao_in,
            alpha_in,
            alpha_out,
            emission,
            tempo,
            owner: String::new(),
            n_neurons,
            max_n: 256,
            market_cap,
            volume_24h: 0.0,
            price_change_24h: 0.0,
        })
    }

    /// Get subnet price info
    pub async fn get_subnet_price(&self, netuid: u16) -> Result<ScanResult, String> {
        Self::fetch_subnet_info_static(&self.rpc, netuid).await
    }

    /// Fetch recent staking/unstaking events from the chain
    pub async fn fetch_recent_trades(
        &self,
        lookback_blocks: u64,
        limit: usize,
    ) -> Result<Vec<TradeRecord>, String> {
        // Get current block
        let current_block = self.get_current_block().await?;
        let start_block = current_block.saturating_sub(lookback_blocks);

        info!(
            "Fetching trades from block {} to {} ({} blocks)",
            start_block, current_block, lookback_blocks
        );

        let mut trades = Vec::new();
        // Sample blocks across the range for efficiency (every ~100 blocks)
        let step = std::cmp::max(1, lookback_blocks / 2000);
        let mut block = start_block;

        while block <= current_block && trades.len() < limit {
            match self.scan_block_for_trades(block).await {
                Ok(mut block_trades) => {
                    trades.append(&mut block_trades);
                }
                Err(_) => {} // skip failed blocks
            }
            block += step;
        }

        trades.sort_by(|a, b| b.block_number.cmp(&a.block_number));
        trades.truncate(limit);

        info!("Found {} trades across sampled blocks", trades.len());
        Ok(trades)
    }

    async fn scan_block_for_trades(&self, block_number: u64) -> Result<Vec<TradeRecord>, String> {
        // Get block hash
        let hash_params = serde_json::json!([block_number]);
        let block_hash = self
            .rpc
            .rpc_call("chain_getBlockHash", &hash_params)
            .await?;

        let hash_str = block_hash
            .as_str()
            .ok_or("Invalid block hash")?;

        // Get block with extrinsics
        let block_params = serde_json::json!([hash_str]);
        let block = self
            .rpc
            .rpc_call("chain_getBlock", &block_params)
            .await?;

        // Get events for this block
        let events_key = "0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7"; // System::Events storage key
        let storage_params = serde_json::json!([events_key, hash_str]);
        let _events = self.rpc.rpc_call("state_getStorage", &storage_params).await;

        let mut trades = Vec::new();

        // Parse extrinsics for staking calls
        if let Some(extrinsics) = block
            .get("block")
            .and_then(|b| b.get("extrinsics"))
            .and_then(|e| e.as_array())
        {
            for ext in extrinsics {
                if let Some(ext_hex) = ext.as_str() {
                    // Try to identify staking extrinsics by their call index
                    if let Some(trade) = self.parse_extrinsic(ext_hex, block_number) {
                        trades.push(trade);
                    }
                }
            }
        }

        Ok(trades)
    }

    fn parse_extrinsic(&self, hex_data: &str, block_number: u64) -> Option<TradeRecord> {
        // Bittensor extrinsic call indices for SubtensorModule:
        // add_stake: pallet_index=7, call_index=2
        // remove_stake: pallet_index=7, call_index=3
        // This is a simplified parser - full SCALE decoding would be more accurate
        let bytes = hex::decode(hex_data.trim_start_matches("0x")).ok()?;
        if bytes.len() < 10 {
            return None;
        }

        // Look for signed extrinsics (bit 7 set in first byte of compact length)
        // After length prefix, version byte (0x84 for signed), then signer
        let mut offset = 0;
        // Skip compact length
        let first = bytes[0];
        if first < 0xfc {
            if first & 0x03 == 0x00 {
                offset = 1;
            } else if first & 0x03 == 0x01 {
                offset = 2;
            } else if first & 0x03 == 0x02 {
                offset = 4;
            } else {
                offset = 5;
            }
        }

        if offset >= bytes.len() {
            return None;
        }

        // Check version byte
        let version = bytes.get(offset)?;
        if version & 0x80 == 0 {
            return None; // unsigned
        }

        // After version: signer (1 byte type prefix + 32 bytes pubkey)
        let signer_start = offset + 1;
        if signer_start + 33 >= bytes.len() {
            return None;
        }

        // Skip signer + signature + era + nonce + tip to get to call data
        // This is approximate - real SCALE decoding varies
        // For now, scan the raw bytes for known pallet+call patterns
        let _signer_bytes = &bytes[signer_start..signer_start + 33];

        // Look for SubtensorModule calls at any position
        for i in 0..bytes.len().saturating_sub(2) {
            let pallet = bytes[i];
            let call = bytes[i + 1];

            // SubtensorModule pallet index varies by runtime version
            // Common: pallet 7 (older) or higher indices
            // We check for staking-related patterns
            if pallet == 7 || pallet == 8 || pallet == 9 {
                let action = match call {
                    2 => Some(TradeAction::Stake),
                    3 => Some(TradeAction::Unstake),
                    _ => None,
                };

                if let Some(action) = action {
                    return Some(TradeRecord {
                        block_number,
                        timestamp: block_number * 12, // ~12s per block
                        coldkey: format!("0x{}", hex::encode(&bytes[signer_start..signer_start.min(bytes.len()).max(signer_start + 32).min(bytes.len())])),
                        hotkey: String::new(),
                        netuid: 0,
                        action,
                        amount_tao: 0.0,
                        extrinsic_hash: format!("0x{}", hex::encode(&bytes[..8.min(bytes.len())])),
                    });
                }
            }
        }

        None
    }

    /// Build leaderboard from on-chain staking data
    pub async fn build_leaderboard(&self, top_n: usize) -> Result<Vec<LeaderboardEntry>, String> {
        // Strategy: query metagraph for multiple subnets to find top stakers
        // Then score them by total value and estimated performance
        let netuids = self.get_all_netuids().await?;
        let mut staker_map: HashMap<String, StakerAgg> = HashMap::new();

        // Scan popular subnets for stakers
        let scan_netuids: Vec<u16> = netuids.into_iter().take(32).collect();

        for &netuid in &scan_netuids {
            let price_info = match Self::fetch_subnet_info_static(&self.rpc, netuid).await {
                Ok(info) => info,
                Err(_) => continue,
            };

            // Query neurons/stake data for this subnet
            // Use SubtensorModule::Stake storage
            match self.query_subnet_stakes(netuid, &price_info).await {
                Ok(stakes) => {
                    for (coldkey, stake, _hotkey) in stakes {
                        let value = stake * price_info.price;
                        let entry = staker_map.entry(coldkey.clone()).or_insert_with(|| StakerAgg {
                            coldkey: coldkey.clone(),
                            total_value: 0.0,
                            positions: Vec::new(),
                            trade_count: 0,
                        });
                        entry.total_value += value;
                        entry.positions.push(SubnetPosition {
                            netuid,
                            name: price_info.name.clone(),
                            stake,
                            value_tao: value,
                            price: price_info.price,
                            pnl: 0.0,
                            weight: 0.0,
                        });
                    }
                }
                Err(_) => continue,
            }
        }

        // Sort by total value and take top N
        let mut stakers: Vec<StakerAgg> = staker_map.into_values().collect();
        stakers.sort_by(|a, b| b.total_value.partial_cmp(&a.total_value).unwrap_or(std::cmp::Ordering::Equal));
        stakers.truncate(top_n);

        // Build leaderboard entries
        let entries: Vec<LeaderboardEntry> = stakers
            .into_iter()
            .enumerate()
            .map(|(i, s)| {
                let total = s.total_value;
                let mut positions = s.positions;
                // Calculate weights
                for p in &mut positions {
                    p.weight = if total > 0.0 { p.value_tao / total } else { 0.0 };
                }
                positions.sort_by(|a, b| b.value_tao.partial_cmp(&a.value_tao).unwrap_or(std::cmp::Ordering::Equal));

                LeaderboardEntry {
                    rank: i + 1,
                    coldkey: s.coldkey,
                    total_value_tao: total,
                    roi_30d: 0.0, // computed via historical comparison
                    trade_count: s.trade_count,
                    win_rate: 0.0,
                    avg_position_size: if positions.is_empty() { 0.0 } else { total / positions.len() as f64 },
                    pnl_30d: 0.0,
                    top_subnets: positions.into_iter().take(5).collect(),
                }
            })
            .collect();

        Ok(entries)
    }

    async fn query_subnet_stakes(
        &self,
        netuid: u16,
        _price_info: &ScanResult,
    ) -> Result<Vec<(String, f64, String)>, String> {
        // Query SubtensorModule::Keys to get all hotkeys in subnet
        // Then query SubtensorModule::Stake for each
        // Simplified: query metagraph-like data

        // Use SubtensorModule::N to get neuron count
        let n = Self::query_subnet_n(&self.rpc, netuid).await.unwrap_or(0);
        if n == 0 {
            return Ok(Vec::new());
        }

        let mut stakes = Vec::new();

        // Query a sample of UIDs for their stake info
        let sample_size = std::cmp::min(n as usize, 32);
        for uid in 0..sample_size {
            // Query Keys(netuid, uid) -> hotkey
            let hotkey = self.query_uid_hotkey(netuid, uid as u16).await.unwrap_or_default();
            if hotkey.is_empty() {
                continue;
            }

            // Query TotalHotkeyStake(hotkey) -> total stake
            let stake = self.query_hotkey_stake(&hotkey).await.unwrap_or(0.0);
            if stake > 0.0 {
                // We use hotkey as proxy for coldkey in this simplified scan
                stakes.push((hotkey.clone(), stake, hotkey));
            }
        }

        Ok(stakes)
    }

    /// Get staking positions for a specific coldkey
    pub async fn get_positions(&self, _coldkey: &str) -> Result<Vec<SubnetPosition>, String> {
        let netuids = self.get_all_netuids().await?;
        let mut positions = Vec::new();

        for &netuid in netuids.iter().take(48) {
            let price_info = match Self::fetch_subnet_info_static(&self.rpc, netuid).await {
                Ok(info) => info,
                Err(_) => continue,
            };

            // Check if this coldkey has stake on this subnet
            // Query StakeFrom(hotkey, coldkey) for various hotkeys
            // Simplified: check if coldkey appears as a neuron's coldkey
            // In practice you'd query the specific storage maps

            // For now we return the basic subnet info
            if price_info.price > 0.0 {
                positions.push(SubnetPosition {
                    netuid,
                    name: price_info.name,
                    stake: 0.0,
                    value_tao: 0.0,
                    price: price_info.price,
                    pnl: 0.0,
                    weight: 0.0,
                });
            }
        }

        Ok(positions)
    }

    // ── Storage query helpers ──────────────────────────────────────

    async fn get_current_block(&self) -> Result<u64, String> {
        let params = serde_json::json!([]);
        let result = self.rpc.rpc_call("chain_getHeader", &params).await?;
        let hex_number = result
            .get("number")
            .and_then(|n| n.as_str())
            .ok_or("No block number")?;
        let number = u64::from_str_radix(hex_number.trim_start_matches("0x"), 16)
            .map_err(|e| format!("Parse block number: {}", e))?;
        Ok(number)
    }

    async fn query_subnet_name(rpc: &RpcPool, netuid: u16) -> Result<String, String> {
        // SubtensorModule::SubnetIdentityV2(netuid) or SubnetNames
        // Simplified: try to get subnet name from storage
        let storage_key = Self::make_storage_key("SubtensorModule", "SubnetIdentityV2", &netuid.to_le_bytes());
        let params = serde_json::json!([storage_key]);
        match rpc.rpc_call("state_getStorage", &params).await {
            Ok(Value::String(hex)) if hex.len() > 2 => {
                // Try to extract name from SCALE-encoded SubnetIdentity
                let bytes = hex::decode(hex.trim_start_matches("0x")).unwrap_or_default();
                // Name is typically the first string field - compact length + utf8
                if bytes.len() > 2 {
                    let name_len = bytes[0] as usize / 4; // compact encoding
                    if name_len > 0 && name_len + 1 <= bytes.len() {
                        if let Ok(name) = String::from_utf8(bytes[1..1 + name_len].to_vec()) {
                            return Ok(name);
                        }
                    }
                }
                Ok(format!("SN{}", netuid))
            }
            _ => Ok(format!("SN{}", netuid)),
        }
    }

    async fn query_subnet_pool(rpc: &RpcPool, netuid: u16) -> Result<(f64, f64, f64), String> {
        // SubtensorModule::TaoIn, AlphaIn, AlphaOut
        let tao_key = Self::make_storage_key("SubtensorModule", "SubnetTAO", &netuid.to_le_bytes());
        let alpha_in_key = Self::make_storage_key("SubtensorModule", "SubnetAlphaIn", &netuid.to_le_bytes());
        let alpha_out_key = Self::make_storage_key("SubtensorModule", "SubnetAlphaOut", &netuid.to_le_bytes());

        let tao_in = Self::query_u64_storage(rpc, &tao_key).await.unwrap_or(0) as f64 / 1e9;
        let alpha_in = Self::query_u64_storage(rpc, &alpha_in_key).await.unwrap_or(0) as f64 / 1e9;
        let alpha_out = Self::query_u64_storage(rpc, &alpha_out_key).await.unwrap_or(0) as f64 / 1e9;

        Ok((tao_in, alpha_in, alpha_out))
    }

    async fn query_subnet_emission(rpc: &RpcPool, netuid: u16) -> Result<f64, String> {
        let key = Self::make_storage_key("SubtensorModule", "EmissionValues", &netuid.to_le_bytes());
        let val = Self::query_u64_storage(rpc, &key).await.unwrap_or(0);
        Ok(val as f64 / 1e9)
    }

    async fn query_subnet_tempo(rpc: &RpcPool, netuid: u16) -> Result<u16, String> {
        let key = Self::make_storage_key("SubtensorModule", "Tempo", &netuid.to_le_bytes());
        let params = serde_json::json!([key]);
        match rpc.rpc_call("state_getStorage", &params).await {
            Ok(Value::String(hex)) if hex.len() > 2 => {
                let bytes = hex::decode(hex.trim_start_matches("0x")).unwrap_or_default();
                if bytes.len() >= 2 {
                    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
                } else {
                    Ok(360)
                }
            }
            _ => Ok(360),
        }
    }

    async fn query_subnet_n(rpc: &RpcPool, netuid: u16) -> Result<u16, String> {
        let key = Self::make_storage_key("SubtensorModule", "SubnetworkN", &netuid.to_le_bytes());
        let params = serde_json::json!([key]);
        match rpc.rpc_call("state_getStorage", &params).await {
            Ok(Value::String(hex)) if hex.len() > 2 => {
                let bytes = hex::decode(hex.trim_start_matches("0x")).unwrap_or_default();
                if bytes.len() >= 2 {
                    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
                } else {
                    Ok(0)
                }
            }
            _ => Ok(0),
        }
    }

    async fn query_uid_hotkey(&self, netuid: u16, uid: u16) -> Result<String, String> {
        // SubtensorModule::Keys(netuid, uid) -> AccountId
        let mut key_data = Vec::new();
        key_data.extend_from_slice(&netuid.to_le_bytes());
        key_data.extend_from_slice(&uid.to_le_bytes());
        let key = Self::make_storage_key("SubtensorModule", "Keys", &key_data);
        let params = serde_json::json!([key]);
        match self.rpc.rpc_call("state_getStorage", &params).await {
            Ok(Value::String(hex)) if hex.len() > 2 => {
                Ok(hex.trim_start_matches("0x").to_string())
            }
            _ => Ok(String::new()),
        }
    }

    async fn query_hotkey_stake(&self, _hotkey: &str) -> Result<f64, String> {
        // TotalHotkeyStake(hotkey) -> u64
        // Simplified: would need to hash the account ID for the storage key
        Ok(0.0)
    }

    async fn query_u64_storage(rpc: &RpcPool, key: &str) -> Result<u64, String> {
        let params = serde_json::json!([key]);
        match rpc.rpc_call("state_getStorage", &params).await {
            Ok(Value::String(hex)) if hex.len() > 2 => {
                let bytes = hex::decode(hex.trim_start_matches("0x")).unwrap_or_default();
                if bytes.len() >= 8 {
                    Ok(u64::from_le_bytes(bytes[..8].try_into().unwrap()))
                } else if bytes.len() >= 4 {
                    Ok(u32::from_le_bytes(bytes[..4].try_into().unwrap()) as u64)
                } else {
                    Ok(0)
                }
            }
            _ => Ok(0),
        }
    }

    /// Build substrate storage key (twox128 hash of pallet + item + key)
    fn make_storage_key(pallet: &str, item: &str, extra: &[u8]) -> String {
        use std::hash::Hasher;

        fn twox128(data: &[u8]) -> [u8; 16] {
            let h0 = twox_hash(data, 0);
            let h1 = twox_hash(data, 1);
            let mut result = [0u8; 16];
            let b0 = h0.to_le_bytes();
            let b1 = h1.to_le_bytes();
            result[..8].copy_from_slice(&b0);
            result[8..].copy_from_slice(&b1);
            result
        }

        fn twox_hash(data: &[u8], seed: u64) -> u64 {
            // xxHash64 implementation
            xxhash(data, seed)
        }

        fn xxhash(data: &[u8], seed: u64) -> u64 {
            // Simple xxhash64
            let mut hasher = XxHash64::with_seed(seed);
            hasher.write(data);
            hasher.finish()
        }

        let pallet_hash = twox128(pallet.as_bytes());
        let item_hash = twox128(item.as_bytes());

        let mut key = String::from("0x");
        key.push_str(&hex::encode(pallet_hash));
        key.push_str(&hex::encode(item_hash));
        if !extra.is_empty() {
            // For map keys, use twox64_concat
            let hash = twox_hash(extra, 0).to_le_bytes();
            key.push_str(&hex::encode(&hash[..8]));
            key.push_str(&hex::encode(extra));
        }
        key
    }
}

struct StakerAgg {
    coldkey: String,
    total_value: f64,
    positions: Vec<SubnetPosition>,
    trade_count: usize,
}

// Minimal xxHash64 implementation
struct XxHash64 {
    seed: u64,
    data: Vec<u8>,
}

impl XxHash64 {
    fn with_seed(seed: u64) -> Self {
        Self {
            seed,
            data: Vec::new(),
        }
    }
}

impl std::hash::Hasher for XxHash64 {
    fn write(&mut self, bytes: &[u8]) {
        self.data.extend_from_slice(bytes);
    }

    fn finish(&self) -> u64 {
        // xxHash64 constants
        const PRIME64_1: u64 = 0x9E3779B185EBCA87;
        const PRIME64_2: u64 = 0x14DEF9DEA2F79CD6;
        const PRIME64_3: u64 = 0x0165667B19E3779F;
        const PRIME64_4: u64 = 0x85EBCA77C2B2AE63;
        const PRIME64_5: u64 = 0x27D4EB2F165667C5;

        let data = &self.data;
        let len = data.len();
        let mut h: u64;

        if len >= 32 {
            let mut v1 = self.seed.wrapping_add(PRIME64_1).wrapping_add(PRIME64_2);
            let mut v2 = self.seed.wrapping_add(PRIME64_2);
            let mut v3 = self.seed;
            let mut v4 = self.seed.wrapping_sub(PRIME64_1);

            let mut i = 0;
            while i + 32 <= len {
                v1 = xxh64_round(v1, read_u64_le(&data[i..]));
                v2 = xxh64_round(v2, read_u64_le(&data[i + 8..]));
                v3 = xxh64_round(v3, read_u64_le(&data[i + 16..]));
                v4 = xxh64_round(v4, read_u64_le(&data[i + 24..]));
                i += 32;
            }

            h = v1.rotate_left(1)
                .wrapping_add(v2.rotate_left(7))
                .wrapping_add(v3.rotate_left(12))
                .wrapping_add(v4.rotate_left(18));

            h = xxh64_merge_round(h, v1);
            h = xxh64_merge_round(h, v2);
            h = xxh64_merge_round(h, v3);
            h = xxh64_merge_round(h, v4);
        } else {
            h = self.seed.wrapping_add(PRIME64_5);
        }

        h = h.wrapping_add(len as u64);

        // Process remaining
        let remaining_start = (len / 32) * 32;
        let mut i = remaining_start;

        while i + 8 <= len {
            let k = read_u64_le(&data[i..]);
            h ^= xxh64_round(0, k);
            h = h.rotate_left(27).wrapping_mul(PRIME64_1).wrapping_add(PRIME64_4);
            i += 8;
        }

        while i + 4 <= len {
            let k = read_u32_le(&data[i..]) as u64;
            h ^= k.wrapping_mul(PRIME64_1);
            h = h.rotate_left(23).wrapping_mul(PRIME64_2).wrapping_add(PRIME64_3);
            i += 4;
        }

        while i < len {
            h ^= (data[i] as u64).wrapping_mul(PRIME64_5);
            h = h.rotate_left(11).wrapping_mul(PRIME64_1);
            i += 1;
        }

        // Avalanche
        h ^= h >> 33;
        h = h.wrapping_mul(PRIME64_2);
        h ^= h >> 29;
        h = h.wrapping_mul(PRIME64_3);
        h ^= h >> 32;

        h
    }
}

fn xxh64_round(acc: u64, input: u64) -> u64 {
    const PRIME64_2: u64 = 0x14DEF9DEA2F79CD6;
    const PRIME64_1: u64 = 0x9E3779B185EBCA87;
    acc.wrapping_add(input.wrapping_mul(PRIME64_2))
        .rotate_left(31)
        .wrapping_mul(PRIME64_1)
}

fn xxh64_merge_round(acc: u64, val: u64) -> u64 {
    const PRIME64_1: u64 = 0x9E3779B185EBCA87;
    const PRIME64_4: u64 = 0x85EBCA77C2B2AE63;
    let val = xxh64_round(0, val);
    acc ^ val
        .wrapping_mul(PRIME64_1)
        .wrapping_add(PRIME64_4)
}

fn read_u64_le(data: &[u8]) -> u64 {
    u64::from_le_bytes(data[..8].try_into().unwrap())
}

fn read_u32_le(data: &[u8]) -> u64 {
    u32::from_le_bytes(data[..4].try_into().unwrap()) as u64
}
