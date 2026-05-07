use std::sync::Arc;

use crate::{config::Config, ratelimit::RateLimiter, store::Store};

pub type AppState = Arc<SharedState>;

pub struct SharedState {
    pub config: Config,
    pub store: Store,
    pub rate_limiter: RateLimiter,
}

impl SharedState {
    pub fn new(config: Config) -> anyhow::Result<Self> {
        let store = Store::open(
            &config.snapshot_path(),
            config.claims_path(),
            config.commitments_path(),
            config.used_sigs_path(),
        )?;
        let rate_limiter = RateLimiter::new(60, 30);
        Ok(Self {
            config,
            store,
            rate_limiter,
        })
    }
}
