pub mod routes;
pub mod proxy;
pub mod pipeline;
pub mod cache;
pub mod categories;
pub mod types;
pub mod strats;
pub mod auth;

use std::sync::Arc;

pub use cache::ProxyCache;
pub use pipeline::PipelineState;
pub use strats::StratStore;

#[derive(Clone)]
pub struct AppState {
    pub http: reqwest::Client,
    pub proxy_cache: Arc<ProxyCache>,
    pub pipeline: Arc<PipelineState>,
    pub strat_store: Arc<StratStore>,
}

pub fn router() -> axum::Router<AppState> {
    routes::router()
}
