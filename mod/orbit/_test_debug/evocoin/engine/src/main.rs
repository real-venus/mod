use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

mod config;
mod contracts;
mod routes;
mod types;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let _ = dotenvy::dotenv();

    let cfg = config::load_config();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive(cfg.log_level.parse()?),
        )
        .init();

    tracing::info!("EvoCoin Engine starting...");
    tracing::info!("RPC: {}", cfg.rpc_url);
    tracing::info!("Chain ID: {}", cfg.chain_id);

    let provider = contracts::create_provider(&cfg.rpc_url)?;
    let contract_addrs = contracts::ContractAddresses {
        evo_token: cfg.evo_token.clone(),
        hub_exchange: cfg.hub_exchange.clone(),
        evo_registry: cfg.evo_registry.clone(),
        token_factory: cfg.token_factory.clone(),
    };

    let state = Arc::new(routes::AppState {
        provider,
        config: cfg.clone(),
        contracts: contract_addrs,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::create_router(state).layer(cors);

    let addr = format!("0.0.0.0:{}", cfg.port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
