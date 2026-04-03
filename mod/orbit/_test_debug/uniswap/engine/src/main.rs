use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

use uniswap_engine::*;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    // Load .env
    let _ = dotenvy::dotenv();

    // Load engine config from config.json
    let engine_config = config::load_engine_config();

    // Setup logging
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive(engine_config.log_level.parse()?))
        .init();

    // Load chain configs from config.json
    let chain_configs = config::load_chain_configs();
    tracing::info!("Loaded {} chain configs", chain_configs.len());
    for (chain_id, cfg) in &chain_configs {
        tracing::info!("  {} ({}): router={}", chain_id.name(), chain_id.id(), cfg.router);
    }

    // Create chain manager
    let chain_manager = Arc::new(chains::ChainManager::new(chain_configs.clone())?);

    // Create strategy engine
    let strategy_engine = Arc::new(strategy::StrategyEngine::new(chain_manager.clone()));
    let active_count = strategy_engine.list_strategies().iter()
        .filter(|s| s.status == types::StrategyStatus::Active).count();
    tracing::info!("Strategy engine loaded, {} active strategies", active_count);

    // Create whitelist manager (seeded from chain configs)
    let data_path = engine_config.data_path.clone();
    let _ = std::fs::create_dir_all(&data_path);
    let _ = std::fs::create_dir_all(format!("{}/trades", data_path));

    let whitelist_manager = Arc::new(whitelist::WhitelistManager::new(&data_path, &chain_configs));
    tracing::info!("Whitelist manager loaded");

    // Create watchlist manager
    let watchlist_manager = Arc::new(watchlist::WatchlistManager::new(&data_path));
    let watch_count = watchlist_manager.get_watchlist().len();
    tracing::info!("Watchlist loaded, {} watched wallets", watch_count);

    // Create discovery manager
    let discovery_manager = Arc::new(discovery::DiscoveryManager::new(&data_path));
    tracing::info!("Discovery manager loaded");

    // Build app state
    let state = Arc::new(routes::AppState {
        chain_manager,
        strategy_engine,
        whitelist_manager,
        watchlist_manager,
        discovery_manager,
        data_path,
    });

    // CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = routes::create_router(state).layer(cors);

    // Start server
    let addr = format!("0.0.0.0:{}", engine_config.port);
    tracing::info!("Uniswap Engine starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
