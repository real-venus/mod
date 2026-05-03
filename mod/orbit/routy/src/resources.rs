use std::sync::Arc;
use sysinfo::System;
use tokio::sync::RwLock;
use tracing::debug;

use crate::config::Config;

pub struct ResourceMonitor {
    system: Arc<RwLock<System>>,
    config: Arc<Config>,
    cpu_usage: Arc<RwLock<f32>>,
}

impl ResourceMonitor {
    pub fn new(config: Arc<Config>) -> Self {
        let mut system = System::new();
        system.refresh_cpu();

        Self {
            system: Arc::new(RwLock::new(system)),
            config,
            cpu_usage: Arc::new(RwLock::new(0.0)),
        }
    }

    pub fn start_monitoring(&self) {
        if !self.config.enable_monitoring {
            return;
        }

        let system = Arc::clone(&self.system);
        let cpu_usage = Arc::clone(&self.cpu_usage);

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));

            loop {
                interval.tick().await;

                let mut sys = system.write().await;
                sys.refresh_cpu();

                // Wait a bit for CPU measurement to be accurate
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                sys.refresh_cpu();

                // Calculate average CPU usage across all cores
                let cpus = sys.cpus();
                if !cpus.is_empty() {
                    let total: f32 = cpus.iter().map(|cpu| cpu.cpu_usage()).sum();
                    let avg = total / cpus.len() as f32;

                    let mut usage = cpu_usage.write().await;
                    *usage = avg;

                    debug!("CPU usage: {:.2}%", avg);
                }
            }
        });
    }

    pub async fn get_cpu_usage(&self) -> f32 {
        *self.cpu_usage.read().await
    }

    pub async fn get_memory_usage(&self) -> u64 {
        let sys = self.system.read().await;
        sys.used_memory()
    }

    pub async fn get_total_memory(&self) -> u64 {
        let sys = self.system.read().await;
        sys.total_memory()
    }

    pub async fn is_within_limits(&self) -> bool {
        let cpu = self.get_cpu_usage().await;
        let memory_mb = self.get_memory_usage().await / 1024 / 1024;

        cpu < self.config.cpu_limit_percent
            && (memory_mb as usize) < self.config.memory_limit_mb
    }
}
