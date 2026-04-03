use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use dashmap::DashMap;
use serde_json::Value;
use tracing::{info, warn};

use crate::types::RpcHealth;

/// Round-robin RPC pool with health checking and automatic failover
pub struct RpcPool {
    endpoints: Vec<String>,
    health: DashMap<String, EndpointState>,
    counter: AtomicU64,
}

struct EndpointState {
    latency_ms: u64,
    success_count: u64,
    error_count: u64,
    last_check: Instant,
    healthy: bool,
}

impl RpcPool {
    pub fn new(endpoints: &[String]) -> Self {
        let health = DashMap::new();
        for ep in endpoints {
            health.insert(
                ep.clone(),
                EndpointState {
                    latency_ms: 0,
                    success_count: 0,
                    error_count: 0,
                    last_check: Instant::now(),
                    healthy: true, // optimistic start
                },
            );
        }
        Self {
            endpoints: endpoints.to_vec(),
            health,
            counter: AtomicU64::new(0),
        }
    }

    /// Get next healthy endpoint via round-robin
    pub fn next_endpoint(&self) -> String {
        let healthy: Vec<_> = self
            .endpoints
            .iter()
            .filter(|ep| {
                self.health
                    .get(*ep)
                    .map(|s| s.healthy)
                    .unwrap_or(false)
            })
            .collect();

        if healthy.is_empty() {
            // fallback to first endpoint if all are unhealthy
            return self.endpoints[0].clone();
        }

        let idx = self.counter.fetch_add(1, Ordering::Relaxed) as usize % healthy.len();
        healthy[idx].clone()
    }

    /// Get the lowest-latency healthy endpoint
    pub fn best_endpoint(&self) -> String {
        let mut best_url = self.endpoints[0].clone();
        let mut best_latency = u64::MAX;

        for ep in &self.endpoints {
            if let Some(state) = self.health.get(ep) {
                if state.healthy && state.latency_ms < best_latency {
                    best_latency = state.latency_ms;
                    best_url = ep.clone();
                }
            }
        }

        best_url
    }

    /// Make a JSON-RPC call with automatic failover
    pub async fn rpc_call(&self, method: &str, params: &Value) -> Result<Value, String> {
        let max_retries = 3;
        let mut last_err = String::new();

        for _ in 0..max_retries {
            let endpoint = self.next_endpoint();
            let start = Instant::now();

            match self.do_rpc_call(&endpoint, method, params).await {
                Ok(result) => {
                    let latency = start.elapsed().as_millis() as u64;
                    if let Some(mut state) = self.health.get_mut(&endpoint) {
                        state.latency_ms = latency;
                        state.success_count += 1;
                        state.healthy = true;
                    }
                    return Ok(result);
                }
                Err(e) => {
                    warn!("RPC call to {} failed: {}", endpoint, e);
                    if let Some(mut state) = self.health.get_mut(&endpoint) {
                        state.error_count += 1;
                        if state.error_count > 3 {
                            state.healthy = false;
                        }
                    }
                    last_err = e;
                }
            }
        }

        Err(format!("All RPC retries failed: {}", last_err))
    }

    async fn do_rpc_call(
        &self,
        endpoint: &str,
        method: &str,
        params: &Value,
    ) -> Result<Value, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        // For HTTP endpoints, use JSON-RPC
        let http_url = if endpoint.starts_with("wss://") {
            endpoint.replace("wss://", "https://").replace(":443", "")
        } else if endpoint.starts_with("ws://") {
            endpoint.replace("ws://", "http://")
        } else {
            endpoint.to_string()
        };

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        });

        let resp = client
            .post(&http_url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;

        if let Some(error) = json.get("error") {
            return Err(format!("RPC error: {}", error));
        }

        json.get("result")
            .cloned()
            .ok_or_else(|| "No result in RPC response".to_string())
    }

    /// Health check loop - runs in background
    pub async fn health_check_loop(&self, interval_secs: u64) {
        loop {
            for endpoint in &self.endpoints {
                let start = Instant::now();
                let params = serde_json::json!([]);
                match self.do_rpc_call(endpoint, "system_health", &params).await {
                    Ok(_) => {
                        let latency = start.elapsed().as_millis() as u64;
                        if let Some(mut state) = self.health.get_mut(endpoint) {
                            state.latency_ms = latency;
                            state.healthy = true;
                            state.last_check = Instant::now();
                            state.success_count += 1;
                        }
                        info!("RPC {} healthy ({}ms)", endpoint, latency);
                    }
                    Err(e) => {
                        if let Some(mut state) = self.health.get_mut(endpoint) {
                            state.healthy = false;
                            state.last_check = Instant::now();
                            state.error_count += 1;
                        }
                        warn!("RPC {} unhealthy: {}", endpoint, e);
                    }
                }
            }
            tokio::time::sleep(Duration::from_secs(interval_secs)).await;
        }
    }

    /// Get health stats for all endpoints
    pub fn health_stats(&self) -> Vec<RpcHealth> {
        self.endpoints
            .iter()
            .map(|ep| {
                let state = self.health.get(ep);
                match state {
                    Some(s) => RpcHealth {
                        url: ep.clone(),
                        latency_ms: s.latency_ms,
                        success_count: s.success_count,
                        error_count: s.error_count,
                        last_check: s.last_check.elapsed().as_secs(),
                        healthy: s.healthy,
                    },
                    None => RpcHealth {
                        url: ep.clone(),
                        latency_ms: 0,
                        success_count: 0,
                        error_count: 0,
                        last_check: 0,
                        healthy: false,
                    },
                }
            })
            .collect()
    }
}
