use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use ethers::providers::{Http, Middleware, Provider};
use serde::Serialize;
use tokio::time;
use tracing::{debug, info, warn};

struct ProviderEntry {
    url: String,
    provider: Provider<Http>,
    latency_ms: AtomicU64,
    error_count: AtomicU64,
    success_count: AtomicU64,
    is_healthy: AtomicBool,
}

pub struct RpcPool {
    providers: DashMap<u64, Vec<Arc<ProviderEntry>>>,
    rr_index: DashMap<u64, AtomicU64>,
}

impl RpcPool {
    pub fn new() -> Self {
        Self {
            providers: DashMap::new(),
            rr_index: DashMap::new(),
        }
    }

    pub fn add_chain(&self, chain_id: u64, urls: &[String]) {
        let mut entries = Vec::new();
        for url in urls {
            match Provider::<Http>::try_from(url.as_str()) {
                Ok(provider) => {
                    let provider = provider.interval(Duration::from_millis(500));
                    entries.push(Arc::new(ProviderEntry {
                        url: url.clone(),
                        provider,
                        latency_ms: AtomicU64::new(500),
                        error_count: AtomicU64::new(0),
                        success_count: AtomicU64::new(0),
                        is_healthy: AtomicBool::new(true),
                    }));
                }
                Err(e) => {
                    warn!("Failed to create provider for {}: {}", url, e);
                }
            }
        }
        info!("Chain {}: {} RPC providers", chain_id, entries.len());
        self.providers.insert(chain_id, entries);
        self.rr_index.insert(chain_id, AtomicU64::new(0));
    }

    /// Get best healthy provider via round-robin
    pub fn get_provider(&self, chain_id: u64) -> Option<Provider<Http>> {
        let entries = self.providers.get(&chain_id)?;
        if entries.is_empty() {
            return None;
        }

        let idx_entry = self.rr_index.get(&chain_id)?;
        let len = entries.len();

        for _ in 0..len {
            let idx = idx_entry.fetch_add(1, Ordering::Relaxed) as usize % len;
            let entry = &entries[idx];
            if !entry.is_healthy.load(Ordering::Relaxed) {
                continue;
            }
            return Some(entry.provider.clone());
        }

        // All unhealthy — fallback to first
        warn!("Chain {}: all providers unhealthy, using fallback", chain_id);
        Some(entries[0].provider.clone())
    }

    pub fn report_error(&self, chain_id: u64) {
        if let Some(entries) = self.providers.get(&chain_id) {
            if let Some(idx_entry) = self.rr_index.get(&chain_id) {
                let idx = (idx_entry.load(Ordering::Relaxed).wrapping_sub(1)) as usize % entries.len();
                let entry = &entries[idx];
                let errs = entry.error_count.fetch_add(1, Ordering::Relaxed) + 1;
                if errs >= 5 {
                    entry.is_healthy.store(false, Ordering::Relaxed);
                    warn!("Chain {} provider {} marked unhealthy ({} errors)", chain_id, entry.url, errs);
                }
            }
        }
    }

    pub fn report_success(&self, chain_id: u64, latency_ms: u64) {
        if let Some(entries) = self.providers.get(&chain_id) {
            if let Some(idx_entry) = self.rr_index.get(&chain_id) {
                let idx = (idx_entry.load(Ordering::Relaxed).wrapping_sub(1)) as usize % entries.len();
                let entry = &entries[idx];
                entry.error_count.store(0, Ordering::Relaxed);
                entry.is_healthy.store(true, Ordering::Relaxed);
                entry.success_count.fetch_add(1, Ordering::Relaxed);
                let old = entry.latency_ms.load(Ordering::Relaxed);
                let new_latency = (old * 7 + latency_ms * 3) / 10;
                entry.latency_ms.store(new_latency, Ordering::Relaxed);
            }
        }
    }

    /// Background health checks
    pub async fn health_check_loop(self: Arc<Self>, interval_secs: u64) {
        let mut interval = time::interval(Duration::from_secs(interval_secs));
        loop {
            interval.tick().await;
            for entry in self.providers.iter() {
                let chain_id = *entry.key();
                for pe in entry.value().iter() {
                    let pe = pe.clone();
                    tokio::spawn(async move {
                        let start = Instant::now();
                        match pe.provider.get_block_number().await {
                            Ok(block) => {
                                let ms = start.elapsed().as_millis() as u64;
                                pe.latency_ms.store(ms, Ordering::Relaxed);
                                pe.error_count.store(0, Ordering::Relaxed);
                                let was_unhealthy = !pe.is_healthy.swap(true, Ordering::Relaxed);
                                if was_unhealthy {
                                    info!("Chain {} provider {} recovered (block {})", chain_id, pe.url, block);
                                }
                                debug!("Chain {} {} block={} latency={}ms", chain_id, pe.url, block, ms);
                            }
                            Err(e) => {
                                let errs = pe.error_count.fetch_add(1, Ordering::Relaxed) + 1;
                                if errs >= 3 {
                                    pe.is_healthy.store(false, Ordering::Relaxed);
                                }
                                debug!("Chain {} {} health fail: {} (errors: {})", chain_id, pe.url, e, errs);
                            }
                        }
                    });
                }
            }
        }
    }

    pub fn stats(&self) -> Vec<ChainRpcStats> {
        let mut result = Vec::new();
        for entry in self.providers.iter() {
            let chain_id = *entry.key();
            let providers: Vec<ProviderStats> = entry.value().iter().map(|pe| {
                ProviderStats {
                    url: pe.url.clone(),
                    latency_ms: pe.latency_ms.load(Ordering::Relaxed),
                    is_healthy: pe.is_healthy.load(Ordering::Relaxed),
                    error_count: pe.error_count.load(Ordering::Relaxed),
                    success_count: pe.success_count.load(Ordering::Relaxed),
                }
            }).collect();
            result.push(ChainRpcStats { chain_id, providers });
        }
        result
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ChainRpcStats {
    pub chain_id: u64,
    pub providers: Vec<ProviderStats>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderStats {
    pub url: String,
    pub latency_ms: u64,
    pub is_healthy: bool,
    pub error_count: u64,
    pub success_count: u64,
}
