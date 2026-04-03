pub mod config;
pub mod rpc;
pub mod scanner;
pub mod scorer;
pub mod types;

use std::sync::Arc;

use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use tracing::info;

use crate::config::default_chains;
use crate::rpc::RpcPool;
use crate::scanner::Scanner;
use crate::scorer::TraderScorer;
use crate::types::EngineConfig;

#[pyclass]
pub struct EthcopyEngine {
    runtime: tokio::runtime::Runtime,
    rpc: Arc<RpcPool>,
    scanner: Arc<Scanner>,
    scorer: Arc<TraderScorer>,
    config: EngineConfig,
    running: Arc<std::sync::atomic::AtomicBool>,
}

#[pymethods]
impl EthcopyEngine {
    #[new]
    fn new(config_json: &str) -> PyResult<Self> {
        let _ = tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::from_default_env()
                    .add_directive("ethcopy_rs=info".parse().unwrap()),
            )
            .try_init();

        let config: EngineConfig = if config_json.is_empty() || config_json == "{}" {
            let mut cfg = EngineConfig::default();
            cfg.chains = default_chains();
            cfg
        } else {
            serde_json::from_str(config_json)
                .map_err(|e| PyRuntimeError::new_err(format!("Invalid config: {}", e)))?
        };

        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(4)
            .build()
            .map_err(|e| PyRuntimeError::new_err(format!("Runtime error: {}", e)))?;

        // Init RPC pool
        let rpc = Arc::new(RpcPool::new());
        for chain in &config.chains {
            if chain.enabled {
                rpc.add_chain(chain.chain_id, &chain.rpc_urls);
            }
        }

        let scanner = Arc::new(Scanner::new(rpc.clone()));
        let scorer = Arc::new(TraderScorer::new());

        info!("EthcopyEngine initialized ({} chains)",
            config.chains.iter().filter(|c| c.enabled).count());

        Ok(Self {
            runtime,
            rpc,
            scanner,
            scorer,
            config,
            running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }

    /// Start continuous scanning on all enabled chains
    fn start(&mut self) -> PyResult<()> {
        if self.running.load(std::sync::atomic::Ordering::Relaxed) {
            return Err(PyRuntimeError::new_err("Already running"));
        }
        self.running.store(true, std::sync::atomic::Ordering::Relaxed);

        // Start RPC health checks
        let rpc_clone = self.rpc.clone();
        self.runtime.spawn(async move {
            rpc_clone.health_check_loop(30).await;
        });

        // Start scanner loop per chain
        let interval = self.config.poll_interval_ms;
        for chain in &self.config.chains {
            if chain.enabled {
                let scanner = self.scanner.clone();
                let chain_id = chain.chain_id;
                let chain_name = chain.name.clone();
                self.runtime.spawn(async move {
                    scanner.poll_loop(chain_id, chain_name, interval).await;
                });
            }
        }

        info!("EthcopyEngine started");
        Ok(())
    }

    /// Stop the engine
    fn stop(&mut self) -> PyResult<()> {
        self.running.store(false, std::sync::atomic::Ordering::Relaxed);
        info!("EthcopyEngine stopped");
        Ok(())
    }

    fn is_running(&self) -> bool {
        self.running.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Poll a single chain for recent swaps (one-shot, blocks back)
    fn poll(&self, chain_name: &str, blocks: u64) -> PyResult<String> {
        let chain = self.config.chains.iter()
            .find(|c| c.name == chain_name)
            .ok_or_else(|| PyRuntimeError::new_err(format!("Unknown chain: {}", chain_name)))?;

        let chain_id = chain.chain_id;
        let name = chain.name.clone();
        let scanner = self.scanner.clone();

        let result = self.runtime.block_on(async move {
            scanner.poll_chain(chain_id, &name, blocks).await
        }).map_err(|e| PyRuntimeError::new_err(e))?;

        serde_json::to_string(&result)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Poll all enabled chains in parallel
    fn poll_all(&self, blocks: u64) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let chains: Vec<(u64, String)> = self.config.chains.iter()
            .filter(|c| c.enabled)
            .map(|c| (c.chain_id, c.name.clone()))
            .collect();

        let results = self.runtime.block_on(async move {
            let mut handles = Vec::new();
            for (chain_id, name) in chains {
                let s = scanner.clone();
                let n = name.clone();
                handles.push(tokio::spawn(async move {
                    s.poll_chain(chain_id, &n, blocks).await
                }));
            }
            let mut results = Vec::new();
            for handle in handles {
                if let Ok(Ok(result)) = handle.await {
                    results.push(result);
                }
            }
            results
        });

        serde_json::to_string(&results)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Drain accumulated events from scanner, feed to scorer, return events as JSON
    fn process_events(&self) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let scorer = self.scorer.clone();

        let events = self.runtime.block_on(async move {
            scanner.drain_events().await
        });

        scorer.record_batch(&events);

        serde_json::to_string(&events)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Get recent events without draining
    fn get_events(&self, limit: usize) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let events = self.runtime.block_on(async move {
            scanner.get_events(limit).await
        });

        serde_json::to_string(&events)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Get all trader scores as JSON
    fn get_scores(&self) -> PyResult<String> {
        let scores = self.scorer.get_scores();
        serde_json::to_string(&scores)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Get score for a specific trader
    fn get_score(&self, address: &str) -> PyResult<String> {
        match self.scorer.get_score(address) {
            Some(score) => serde_json::to_string(&score)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            None => Ok("null".to_string()),
        }
    }

    /// Get trade history for a trader
    fn get_trades(&self, address: &str, limit: usize) -> PyResult<String> {
        let trades = self.scorer.get_trades(address, limit);
        serde_json::to_string(&trades)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Get all recent trades across all traders
    fn get_all_trades(&self, limit: usize) -> PyResult<String> {
        let trades = self.scorer.get_all_trades(limit);
        serde_json::to_string(&trades)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Get RPC pool stats
    fn get_rpc_stats(&self) -> PyResult<String> {
        let stats = self.rpc.stats();
        serde_json::to_string(&stats)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Number of tracked traders
    fn trader_count(&self) -> usize {
        self.scorer.trader_count()
    }
}

#[pymodule]
fn ethcopy_rs(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<EthcopyEngine>()?;
    Ok(())
}
