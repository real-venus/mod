pub mod dca;
pub mod limit;
pub mod range;
pub mod momentum;
pub mod arb;
pub mod rebalance;
pub mod copytrade;

use std::sync::Arc;
use async_trait::async_trait;
use dashmap::DashMap;
use uuid::Uuid;
use chrono::Utc;

use crate::chains::ChainManager;
use crate::types::*;

/// Action a strategy wants to take on each tick
#[derive(Debug, Clone)]
pub enum Action {
    Swap {
        chain: ChainId,
        token_in: String,
        token_out: String,
        amount: String,
        fee: u32,
    },
    Skip {
        reason: String,
    },
}

/// Context passed to strategy on each tick
pub struct StrategyContext {
    pub chain_manager: Arc<ChainManager>,
    pub record: StrategyRecord,
}

#[async_trait]
pub trait Strategy: Send + Sync {
    fn name(&self) -> &str;
    fn kind(&self) -> StrategyKind;
    async fn tick(&self, ctx: &StrategyContext) -> eyre::Result<Vec<Action>>;
    fn validate_config(config: &serde_json::Value) -> eyre::Result<()> where Self: Sized;
}

/// Manages all strategies — create, run, pause, resume, delete
pub struct StrategyEngine {
    pub strategies: Arc<DashMap<Uuid, StrategyRecord>>,
    pub chain_manager: Arc<ChainManager>,
    tasks: Arc<DashMap<Uuid, tokio::task::JoinHandle<()>>>,
    data_path: String,
}

impl StrategyEngine {
    pub fn new(chain_manager: Arc<ChainManager>) -> Self {
        let data_path = std::env::var("DATA_PATH").unwrap_or_else(|_| "data".to_string());
        let _ = std::fs::create_dir_all(&data_path);

        let engine = Self {
            strategies: Arc::new(DashMap::new()),
            chain_manager,
            tasks: Arc::new(DashMap::new()),
            data_path,
        };

        // Load persisted strategies
        engine.load_strategies();
        engine
    }

    pub fn create_strategy(&self, req: CreateStrategyRequest) -> eyre::Result<StrategyRecord> {
        // Validate config for the strategy kind
        match req.kind {
            StrategyKind::Dca => dca::DcaStrategy::validate_config(&req.config)?,
            StrategyKind::LimitOrder => limit::LimitOrderStrategy::validate_config(&req.config)?,
            StrategyKind::RangeLp => range::RangeLpStrategy::validate_config(&req.config)?,
            StrategyKind::Momentum => momentum::MomentumStrategy::validate_config(&req.config)?,
            StrategyKind::Arb => arb::ArbStrategy::validate_config(&req.config)?,
            StrategyKind::Rebalance => rebalance::RebalanceStrategy::validate_config(&req.config)?,
            StrategyKind::CopyTrade => copytrade::CopyTradeStrategy::validate_config(&req.config)?,
        }

        let now = Utc::now();
        let record = StrategyRecord {
            id: Uuid::new_v4(),
            kind: req.kind,
            chain: req.chain,
            status: StrategyStatus::Active,
            config: req.config,
            created_at: now,
            updated_at: now,
            executions: vec![],
        };

        self.strategies.insert(record.id, record.clone());
        self.save_strategies();
        self.spawn_strategy_task(&record);

        Ok(record)
    }

    pub fn get_strategy(&self, id: &Uuid) -> Option<StrategyRecord> {
        self.strategies.get(id).map(|s| s.clone())
    }

    pub fn list_strategies(&self) -> Vec<StrategyRecord> {
        self.strategies.iter().map(|s| s.value().clone()).collect()
    }

    pub fn pause_strategy(&self, id: &Uuid) -> eyre::Result<StrategyRecord> {
        let mut entry = self.strategies.get_mut(id)
            .ok_or_else(|| eyre::eyre!("Strategy not found"))?;
        entry.status = StrategyStatus::Paused;
        entry.updated_at = Utc::now();
        let record = entry.clone();
        drop(entry);

        // Cancel the running task
        if let Some((_, handle)) = self.tasks.remove(id) {
            handle.abort();
        }
        self.save_strategies();
        Ok(record)
    }

    pub fn resume_strategy(&self, id: &Uuid) -> eyre::Result<StrategyRecord> {
        let mut entry = self.strategies.get_mut(id)
            .ok_or_else(|| eyre::eyre!("Strategy not found"))?;
        entry.status = StrategyStatus::Active;
        entry.updated_at = Utc::now();
        let record = entry.clone();
        drop(entry);

        self.spawn_strategy_task(&record);
        self.save_strategies();
        Ok(record)
    }

    pub fn delete_strategy(&self, id: &Uuid) -> eyre::Result<()> {
        if let Some((_, handle)) = self.tasks.remove(id) {
            handle.abort();
        }
        self.strategies.remove(id)
            .ok_or_else(|| eyre::eyre!("Strategy not found"))?;
        self.save_strategies();
        Ok(())
    }

    pub fn get_history(&self, id: &Uuid) -> eyre::Result<Vec<StrategyExecution>> {
        let entry = self.strategies.get(id)
            .ok_or_else(|| eyre::eyre!("Strategy not found"))?;
        Ok(entry.executions.clone())
    }

    fn spawn_strategy_task(&self, record: &StrategyRecord) {
        let id = record.id;
        let kind = record.kind;
        let strategies = self.strategies.clone();
        let chain_manager = self.chain_manager.clone();

        let interval_secs = get_tick_interval(&record.config, kind);

        let handle = tokio::spawn(async move {
            let strategy: Box<dyn Strategy> = match kind {
                StrategyKind::Dca => Box::new(dca::DcaStrategy),
                StrategyKind::LimitOrder => Box::new(limit::LimitOrderStrategy),
                StrategyKind::RangeLp => Box::new(range::RangeLpStrategy),
                StrategyKind::Momentum => Box::new(momentum::MomentumStrategy),
                StrategyKind::Arb => Box::new(arb::ArbStrategy),
                StrategyKind::Rebalance => Box::new(rebalance::RebalanceStrategy),
                StrategyKind::CopyTrade => Box::new(copytrade::CopyTradeStrategy),
            };

            loop {
                // Check if still active
                let record = match strategies.get(&id) {
                    Some(r) if r.status == StrategyStatus::Active => r.clone(),
                    _ => break,
                };

                let ctx = StrategyContext {
                    chain_manager: chain_manager.clone(),
                    record: record.clone(),
                };

                match strategy.tick(&ctx).await {
                    Ok(actions) => {
                        let action_desc: Vec<String> = actions.iter().map(|a| match a {
                            Action::Swap { token_in, token_out, amount, .. } =>
                                format!("swap {} {} -> {}", amount, token_in, token_out),
                            Action::Skip { reason } => format!("skip: {}", reason),
                        }).collect();

                        if let Some(mut entry) = strategies.get_mut(&id) {
                            entry.executions.push(StrategyExecution {
                                timestamp: Utc::now(),
                                action: action_desc.join(", "),
                                result: "ok".to_string(),
                                tx_hash: None,
                            });
                            // Keep last 100 executions
                            if entry.executions.len() > 100 {
                                let start = entry.executions.len() - 100;
                                entry.executions = entry.executions[start..].to_vec();
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Strategy {} tick error: {}", id, e);
                        if let Some(mut entry) = strategies.get_mut(&id) {
                            entry.executions.push(StrategyExecution {
                                timestamp: Utc::now(),
                                action: "tick".to_string(),
                                result: format!("error: {}", e),
                                tx_hash: None,
                            });
                        }
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(interval_secs)).await;
            }
        });

        self.tasks.insert(id, handle);
    }

    fn save_strategies(&self) {
        let records: Vec<StrategyRecord> = self.strategies
            .iter()
            .map(|s| s.value().clone())
            .collect();
        let path = format!("{}/strategies.json", self.data_path);
        if let Ok(json) = serde_json::to_string_pretty(&records) {
            let _ = std::fs::write(&path, json);
        }
    }

    fn load_strategies(&self) {
        let path = format!("{}/strategies.json", self.data_path);
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(records) = serde_json::from_str::<Vec<StrategyRecord>>(&data) {
                for record in records {
                    let should_run = record.status == StrategyStatus::Active;
                    self.strategies.insert(record.id, record.clone());
                    if should_run {
                        self.spawn_strategy_task(&record);
                    }
                }
            }
        }
    }
}

fn get_tick_interval(config: &serde_json::Value, kind: StrategyKind) -> u64 {
    config.get("interval_secs")
        .and_then(|v| v.as_u64())
        .unwrap_or(match kind {
            StrategyKind::Dca => 3600,        // 1 hour default
            StrategyKind::LimitOrder => 30,    // 30 seconds
            StrategyKind::RangeLp => 300,      // 5 minutes
            StrategyKind::Momentum => 60,      // 1 minute
            StrategyKind::Arb => 10,           // 10 seconds
            StrategyKind::Rebalance => 3600,   // 1 hour
            StrategyKind::CopyTrade => 60,     // 1 minute
        })
}
