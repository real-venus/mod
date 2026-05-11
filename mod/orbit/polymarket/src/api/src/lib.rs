pub mod routes;
pub mod proxy;
pub mod pipeline;
pub mod cache;
pub mod categories;
pub mod types;

use std::sync::Arc;

pub use cache::ProxyCache;
pub use pipeline::PipelineState;

#[derive(Clone)]
pub struct AppState {
    pub http: reqwest::Client,
    pub proxy_cache: Arc<ProxyCache>,
    pub pipeline: Arc<PipelineState>,
}

pub fn router() -> axum::Router<AppState> {
    routes::router()
}
