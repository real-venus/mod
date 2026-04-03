use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, delete},
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use alloy::providers::Provider;

use crate::chains::ChainManager;
use crate::discovery::{self, DiscoveryManager};
use crate::pool;
use crate::quote;
use crate::swap;
use crate::scraper;
use crate::performance;
use crate::strategy::StrategyEngine;
use crate::watchlist::WatchlistManager;
use crate::whitelist::WhitelistManager;
use crate::types::*;

pub struct AppState {
    pub chain_manager: Arc<ChainManager>,
    pub strategy_engine: Arc<StrategyEngine>,
    pub whitelist_manager: Arc<WhitelistManager>,
    pub watchlist_manager: Arc<WatchlistManager>,
    pub discovery_manager: Arc<DiscoveryManager>,
    pub data_path: String,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/chains", get(chains))
        .route("/tokens", get(tokens))
        .route("/pools", get(pools))
        .route("/pool/{address}", get(pool_state))
        .route("/quote", get(get_quote))
        .route("/swap/build", post(build_swap))
        .route("/balance", get(balance))
        // Strategy endpoints
        .route("/strategies", get(list_strategies).post(create_strategy))
        .route("/strategies/{id}", get(get_strategy).delete(delete_strategy))
        .route("/strategies/{id}/history", get(strategy_history))
        .route("/strategies/{id}/pause", post(pause_strategy))
        .route("/strategies/{id}/resume", post(resume_strategy))
        // Watchlist endpoints
        .route("/watchlist", get(get_watchlist).post(add_to_watchlist))
        .route("/watchlist/{address}", delete(remove_from_watchlist))
        .route("/watchlist/{address}/trades", get(get_wallet_trades))
        .route("/watchlist/{address}/performance", get(get_wallet_performance))
        .route("/watchlist/{address}/sync", post(sync_wallet))
        // Whitelist endpoints
        .route("/whitelist", get(get_token_whitelist).post(add_token_to_whitelist))
        .route("/whitelist/{chain}/{address}", delete(remove_token_from_whitelist))
        // Discovery endpoints
        .route("/top-traders/scan", post(start_discovery_scan))
        .route("/top-traders/scan/status", get(get_scan_status))
        .route("/top-traders", get(get_top_traders))
        .with_state(state)
}

// --- Core endpoints ---

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut chain_health = Vec::new();
    for chain_id in state.chain_manager.chains() {
        let connected = if let Some(provider) = state.chain_manager.provider(&chain_id) {
            match provider.get_block_number().await {
                Ok(num) => {
                    chain_health.push(ChainHealth {
                        chain: chain_id,
                        connected: true,
                        block_number: Some(num),
                    });
                    continue;
                }
                Err(_) => false,
            }
        } else {
            false
        };
        chain_health.push(ChainHealth {
            chain: chain_id,
            connected,
            block_number: None,
        });
    }

    Json(HealthResponse {
        status: if chain_health.iter().any(|c| c.connected) { "healthy" } else { "unhealthy" }.to_string(),
        chains: chain_health,
    })
}

async fn chains(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let configs = state.chain_manager.all_configs();
    let result: Vec<serde_json::Value> = configs.iter().map(|(id, config)| {
        serde_json::json!({
            "chain": id,
            "chain_id": id.id(),
            "name": id.name(),
            "explorer": id.explorer(),
            "router": config.router,
            "quoter": config.quoter,
            "position_manager": config.position_manager,
        })
    }).collect();
    Json(result)
}

#[derive(Deserialize)]
struct ChainQuery {
    chain: String,
}

async fn tokens(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ChainQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&q.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", q.chain) })))?;
    let config = state.chain_manager.config(&chain_id)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Chain not configured".into() })))?;
    Ok(Json(config.tokens.clone()))
}

async fn pools(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ChainQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&q.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", q.chain) })))?;
    let config = state.chain_manager.config(&chain_id)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Chain not configured".into() })))?;
    Ok(Json(config.pools.clone()))
}

#[derive(Deserialize)]
struct PoolQuery {
    chain: String,
}

async fn pool_state(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Query(q): Query<PoolQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&q.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", q.chain) })))?;
    let provider = state.chain_manager.provider(&chain_id)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Chain not configured".into() })))?;

    let ps = pool::get_pool_state(provider, &address, chain_id).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;
    Ok(Json(ps))
}

#[derive(Deserialize)]
struct QuoteQuery {
    chain: String,
    token_in: String,
    token_out: String,
    amount: String,
    fee: Option<u32>,
}

async fn get_quote(
    State(state): State<Arc<AppState>>,
    Query(q): Query<QuoteQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&q.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", q.chain) })))?;
    let provider = state.chain_manager.provider(&chain_id)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Chain not configured".into() })))?;
    let config = state.chain_manager.config(&chain_id).unwrap();

    let result = quote::get_quote(
        provider, config, &q.token_in, &q.token_out, &q.amount, q.fee.unwrap_or(3000),
    ).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    Ok(Json(result))
}

#[derive(Deserialize)]
struct BuildSwapRequest {
    chain: String,
    token_in: String,
    token_out: String,
    amount_in: String,
    amount_out_min: String,
    recipient: String,
    fee: Option<u32>,
}

async fn build_swap(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BuildSwapRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&req.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", req.chain) })))?;
    let config = state.chain_manager.config(&chain_id)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Chain not configured".into() })))?;

    let amount_in = alloy::primitives::U256::from_str_radix(
        req.amount_in.trim_start_matches("0x"), if req.amount_in.starts_with("0x") { 16 } else { 10 }
    ).map_err(|e| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Invalid amount_in: {}", e) })))?;

    let amount_out_min = alloy::primitives::U256::from_str_radix(
        req.amount_out_min.trim_start_matches("0x"), if req.amount_out_min.starts_with("0x") { 16 } else { 10 }
    ).map_err(|e| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Invalid amount_out_min: {}", e) })))?;

    let calldata = swap::build_swap_calldata(
        config, &req.token_in, &req.token_out,
        amount_in, amount_out_min, &req.recipient, req.fee.unwrap_or(3000),
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    let approve_calldata = swap::build_approve_calldata(&req.token_in, &config.router)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    Ok(Json(serde_json::json!({
        "swap": calldata,
        "approve": approve_calldata,
        "router": config.router,
    })))
}

#[derive(Deserialize)]
struct BalanceQuery {
    chain: String,
    token: String,
    wallet: String,
}

async fn balance(
    State(state): State<Arc<AppState>>,
    Query(q): Query<BalanceQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&q.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", q.chain) })))?;
    let provider = state.chain_manager.provider(&chain_id)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Chain not configured".into() })))?;

    let (balance_str, decimals) = quote::get_balance(provider, &q.token, &q.wallet).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    Ok(Json(serde_json::json!({
        "balance": balance_str,
        "decimals": decimals,
        "token": q.token,
        "wallet": q.wallet,
    })))
}

// --- Strategy endpoints ---

async fn list_strategies(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(state.strategy_engine.list_strategies())
}

async fn create_strategy(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateStrategyRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let record = state.strategy_engine.create_strategy(req)
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(ApiError { error: e.to_string() })))?;
    Ok((StatusCode::CREATED, Json(record)))
}

async fn get_strategy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let record = state.strategy_engine.get_strategy(&id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(ApiError { error: "Strategy not found".into() })))?;
    Ok(Json(record))
}

async fn delete_strategy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    state.strategy_engine.delete_strategy(&id)
        .map_err(|e| (StatusCode::NOT_FOUND, Json(ApiError { error: e.to_string() })))?;
    Ok(Json(serde_json::json!({"deleted": true})))
}

async fn strategy_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let history = state.strategy_engine.get_history(&id)
        .map_err(|e| (StatusCode::NOT_FOUND, Json(ApiError { error: e.to_string() })))?;
    Ok(Json(history))
}

async fn pause_strategy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let record = state.strategy_engine.pause_strategy(&id)
        .map_err(|e| (StatusCode::NOT_FOUND, Json(ApiError { error: e.to_string() })))?;
    Ok(Json(record))
}

async fn resume_strategy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let record = state.strategy_engine.resume_strategy(&id)
        .map_err(|e| (StatusCode::NOT_FOUND, Json(ApiError { error: e.to_string() })))?;
    Ok(Json(record))
}

// --- Watchlist endpoints ---

async fn get_watchlist(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(state.watchlist_manager.get_watchlist())
}

async fn add_to_watchlist(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AddWalletRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    if req.address.len() != 42 || !req.address.starts_with("0x") {
        return Err((StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid address format".into() })));
    }
    let wallet = state.watchlist_manager.add_wallet(req.address, req.nickname);
    Ok((StatusCode::CREATED, Json(wallet)))
}

async fn remove_from_watchlist(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let removed = state.watchlist_manager.remove_wallet(&address);
    if removed {
        Ok(Json(serde_json::json!({"removed": true})))
    } else {
        Err((StatusCode::NOT_FOUND, Json(ApiError { error: "Wallet not found in watchlist".into() })))
    }
}

async fn get_wallet_trades(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Query(q): Query<TradesQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let trades = scraper::load_cached_trades(&state.data_path, &address);

    // Filter by chain if specified
    let filtered: Vec<_> = if let Some(chain_str) = &q.chain {
        if let Some(chain) = ChainId::from_str(chain_str) {
            trades.into_iter().filter(|t| t.chain == chain).collect()
        } else {
            trades
        }
    } else {
        trades
    };

    // Filter by days
    let days = q.days.unwrap_or(30);
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
    let filtered: Vec<_> = filtered.into_iter()
        .filter(|t| t.timestamp >= cutoff)
        .collect();

    Ok(Json(filtered))
}

async fn get_wallet_performance(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    let trades = scraper::load_cached_trades(&state.data_path, &address);
    let perf = performance::calculate_performance(&address, &trades);
    Json(perf)
}

async fn sync_wallet(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_manager = &state.chain_manager;
    let whitelist = &state.whitelist_manager;

    let mut all_trades: Vec<WalletTrade> = Vec::new();

    // Scrape across all chains
    for chain_id in chain_manager.chains() {
        match scraper::scrape_wallet_trades(
            chain_manager, whitelist, &address, chain_id, 30,
        ).await {
            Ok(trades) => {
                tracing::info!("Scraped {} trades for {} on {}", trades.len(), &address[..10], chain_id.name());
                all_trades.extend(trades);
            }
            Err(e) => {
                tracing::warn!("Error scraping {} on {}: {}", &address[..10], chain_id.name(), e);
            }
        }
    }

    // Merge with existing cached trades (dedup by tx_hash)
    let mut cached = scraper::load_cached_trades(&state.data_path, &address);
    let existing_hashes: std::collections::HashSet<String> = cached.iter().map(|t| t.tx_hash.clone()).collect();
    for trade in all_trades {
        if !existing_hashes.contains(&trade.tx_hash) {
            cached.push(trade);
        }
    }

    // Sort by block number
    cached.sort_by(|a, b| a.block_number.cmp(&b.block_number));

    // Prune trades older than 30 days
    let cutoff = chrono::Utc::now() - chrono::Duration::days(30);
    cached.retain(|t| t.timestamp >= cutoff);

    let count = cached.len();
    scraper::save_trades(&state.data_path, &address, &cached);
    state.watchlist_manager.update_sync_time(&address);

    Ok(Json(serde_json::json!({
        "synced": true,
        "trade_count": count,
        "wallet": address,
    })))
}

// --- Whitelist endpoints ---

async fn get_token_whitelist(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ChainQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&q.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", q.chain) })))?;
    Ok(Json(state.whitelist_manager.get_whitelist(chain_id)))
}

async fn add_token_to_whitelist(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AddWhitelistRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&req.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", req.chain) })))?;

    if req.address.len() != 42 || !req.address.starts_with("0x") {
        return Err((StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid token address".into() })));
    }

    if state.whitelist_manager.is_whitelisted(chain_id, &req.address) {
        return Err((StatusCode::CONFLICT, Json(ApiError { error: "Token already whitelisted".into() })));
    }

    let token = state.whitelist_manager.add_token(chain_id, req.address, req.symbol, req.decimals);
    Ok((StatusCode::CREATED, Json(token)))
}

async fn remove_token_from_whitelist(
    State(state): State<Arc<AppState>>,
    Path((chain, address)): Path<(String, String)>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", chain) })))?;

    let removed = state.whitelist_manager.remove_token(chain_id, &address);
    if removed {
        Ok(Json(serde_json::json!({"removed": true})))
    } else {
        Err((StatusCode::NOT_FOUND, Json(ApiError { error: "Token not found in whitelist".into() })))
    }
}

// --- Discovery endpoints ---

async fn start_discovery_scan(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ScanRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&req.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", req.chain) })))?;

    if state.discovery_manager.is_scanning() {
        return Err((StatusCode::CONFLICT, Json(ApiError { error: "Scan already in progress".into() })));
    }

    let days = req.days.unwrap_or(7);
    let dm = state.discovery_manager.clone();
    let cm = state.chain_manager.clone();
    let wm = state.whitelist_manager.clone();

    tokio::spawn(async move {
        if let Err(e) = dm.scan_top_traders(&cm, &wm, chain_id, days).await {
            tracing::error!("Discovery scan failed: {}", e);
            dm.set_error(e.to_string());
        }
    });

    Ok(Json(serde_json::json!({
        "started": true,
        "chain": chain_id,
        "days": days,
    })))
}

async fn get_scan_status(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(state.discovery_manager.get_status())
}

async fn get_top_traders(
    State(state): State<Arc<AppState>>,
    Query(q): Query<TopTradersQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let chain_id = ChainId::from_str(&q.chain)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(ApiError { error: format!("Unknown chain: {}", q.chain) })))?;

    let days = q.days.unwrap_or(7);
    let limit = q.limit.unwrap_or(50) as usize;

    match discovery::load_cached_top_traders(&state.data_path, chain_id, days) {
        Some(mut cache) => {
            cache.traders.truncate(limit);
            Ok(Json(cache))
        }
        None => {
            Err((StatusCode::NOT_FOUND, Json(ApiError {
                error: format!("No cached data for {} {}d. Start a scan first.", chain_id.name(), days),
            })))
        }
    }
}
