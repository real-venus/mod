pub mod rpc;
pub mod scanner;
pub mod types;

use std::sync::Arc;

use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use tracing::info;

use crate::rpc::RpcPool;
use crate::scanner::SubnetScanner;
use crate::types::EngineConfig;

#[pyclass]
pub struct BtEngine {
    runtime: tokio::runtime::Runtime,
    rpc: Arc<RpcPool>,
    scanner: Arc<SubnetScanner>,
    config: EngineConfig,
}

#[pymethods]
impl BtEngine {
    #[new]
    #[pyo3(signature = (config_json=None))]
    fn new(config_json: Option<&str>) -> PyResult<Self> {
        let _ = tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::from_default_env()
                    .add_directive("bt_rs=info".parse().unwrap()),
            )
            .try_init();

        let config: EngineConfig = match config_json {
            Some(json) if !json.is_empty() && json != "{}" => {
                serde_json::from_str(json)
                    .map_err(|e| PyRuntimeError::new_err(format!("Invalid config: {}", e)))?
            }
            _ => EngineConfig::default(),
        };

        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(4)
            .build()
            .map_err(|e| PyRuntimeError::new_err(format!("Runtime error: {}", e)))?;

        let rpc = Arc::new(RpcPool::new(&config.rpc_endpoints));
        let scanner = Arc::new(SubnetScanner::new(rpc.clone()));

        info!(
            "BtEngine initialized with {} RPC endpoints",
            config.rpc_endpoints.len()
        );

        Ok(Self {
            runtime,
            rpc,
            scanner,
            config,
        })
    }

    /// Scan all subnets and return JSON array of subnet info with prices
    fn scan_subnets(&self) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let result = self.runtime.block_on(async move {
            scanner.scan_all_subnets().await
        });
        match result {
            Ok(data) => serde_json::to_string(&data)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Scan error: {}", e))),
        }
    }

    /// Get price info for a specific subnet
    fn subnet_price(&self, netuid: u16) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let result = self.runtime.block_on(async move {
            scanner.get_subnet_price(netuid).await
        });
        match result {
            Ok(data) => serde_json::to_string(&data)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Price error: {}", e))),
        }
    }

    /// Fetch recent staking events (last N blocks) and return as JSON
    #[pyo3(signature = (blocks=216000, limit=1000))]
    fn fetch_trades(&self, blocks: u64, limit: usize) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let result = self.runtime.block_on(async move {
            scanner.fetch_recent_trades(blocks, limit).await
        });
        match result {
            Ok(data) => serde_json::to_string(&data)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Trade fetch error: {}", e))),
        }
    }

    /// Build leaderboard from trade history - top performers by 30d ROI
    #[pyo3(signature = (top_n=20))]
    fn leaderboard(&self, top_n: usize) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let result = self.runtime.block_on(async move {
            scanner.build_leaderboard(top_n).await
        });
        match result {
            Ok(data) => serde_json::to_string(&data)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Leaderboard error: {}", e))),
        }
    }

    /// Get staking positions for a specific coldkey address
    fn get_positions(&self, coldkey: &str) -> PyResult<String> {
        let scanner = self.scanner.clone();
        let ck = coldkey.to_string();
        let result = self.runtime.block_on(async move {
            scanner.get_positions(&ck).await
        });
        match result {
            Ok(data) => serde_json::to_string(&data)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Positions error: {}", e))),
        }
    }

    /// Get the current best RPC endpoint (for health monitoring)
    fn best_rpc(&self) -> PyResult<String> {
        Ok(self.rpc.best_endpoint())
    }

    /// Get RPC pool health stats as JSON
    fn rpc_health(&self) -> PyResult<String> {
        let health = self.rpc.health_stats();
        serde_json::to_string(&health)
            .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e)))
    }

    /// Start background RPC health checking loop
    fn start_health_checks(&self) -> PyResult<()> {
        let rpc = self.rpc.clone();
        let interval = self.config.health_check_interval_secs;
        self.runtime.spawn(async move {
            rpc.health_check_loop(interval).await;
        });
        Ok(())
    }
}

#[pymodule]
fn bt_rs(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<BtEngine>()?;
    Ok(())
}
