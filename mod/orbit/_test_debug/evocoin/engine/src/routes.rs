use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use alloy::primitives::{Address, U256};
use alloy::providers::Provider;

use crate::config::EngineConfig;
use crate::contracts::{self, ContractAddresses, EthProvider};
use crate::types::*;

pub struct AppState {
    pub provider: EthProvider,
    pub config: EngineConfig,
    pub contracts: ContractAddresses,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/spokes", get(list_spokes))
        .route("/spokes/{address}", get(get_spoke))
        .route("/spokes/creator/{address}", get(get_creator_spokes))
        .route("/price/{address}", get(get_price))
        .route("/balance/{token}/{wallet}", get(get_balance))
        .route("/info", get(protocol_info))
        // Write endpoints (build unsigned tx data for client-side signing)
        .route("/tx/create", post(build_create_tx))
        .route("/tx/buy", post(build_buy_tx))
        .route("/tx/sell", post(build_sell_tx))
        .with_state(state)
}

// --- Read endpoints ---

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let block = state.provider.get_block_number().await.unwrap_or(0);
    Json(HealthResponse {
        status: if block > 0 { "healthy".into() } else { "disconnected".into() },
        chain_id: state.config.chain_id,
        rpc_url: state.config.rpc_url.clone(),
        contracts: ContractStatus {
            evo_token: state.contracts.evo_token.clone(),
            hub_exchange: state.contracts.hub_exchange.clone(),
            evo_registry: state.contracts.evo_registry.clone(),
            token_factory: state.contracts.token_factory.clone(),
        },
    })
}

async fn protocol_info(State(state): State<Arc<AppState>>) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let registry_addr: Address = state.contracts.evo_registry.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid registry address".into() })))?;
    let evo_addr: Address = state.contracts.evo_token.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid evo token address".into() })))?;

    let registry = contracts::IEvoRegistry::new(registry_addr, &state.provider);
    let evo = contracts::IEvoToken::new(evo_addr, &state.provider);

    let count = registry.getTokenCount().call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;
    let supply = evo.totalSupply().call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    Ok(Json(serde_json::json!({
        "spoke_count": count._0.to_string(),
        "evo_total_supply": supply._0.to_string(),
        "chain_id": state.config.chain_id,
        "contracts": {
            "evo_token": state.contracts.evo_token,
            "hub_exchange": state.contracts.hub_exchange,
            "evo_registry": state.contracts.evo_registry,
            "token_factory": state.contracts.token_factory,
        }
    })))
}

async fn list_spokes(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PaginationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let registry_addr: Address = state.contracts.evo_registry.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid registry address".into() })))?;
    let exchange_addr: Address = state.contracts.hub_exchange.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid exchange address".into() })))?;

    let registry = contracts::IEvoRegistry::new(registry_addr, &state.provider);
    let exchange = contracts::IHubExchange::new(exchange_addr, &state.provider);

    let offset = U256::from(q.offset.unwrap_or(0));
    let limit = U256::from(q.limit.unwrap_or(50));

    let tokens = registry.getTokensPaginated(offset, limit).call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    let mut spokes = Vec::new();
    for t in &tokens._0 {
        let spot_price = match exchange.getSpotPrice(t.tokenAddress).call().await {
            Ok(p) => p._0.to_string(),
            Err(_) => "0".to_string(),
        };

        spokes.push(SpokeInfo {
            address: format!("{:?}", t.tokenAddress),
            name: t.name.clone(),
            symbol: t.symbol.clone(),
            curve_type: t.curveType,
            curve_param: t.curveParam.to_string(),
            creator: format!("{:?}", t.creator),
            reserve_balance: String::new(),
            total_volume: String::new(),
            total_trades: String::new(),
            total_supply: String::new(),
            spot_price,
            fitness_score: t.fitnessScore.to_string(),
            active: t.active,
            metadata: t.metadata.clone(),
            created_at: t.createdAt.to_string(),
        });
    }

    Ok(Json(spokes))
}

async fn get_spoke(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let spoke_addr: Address = address.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid address".into() })))?;
    let registry_addr: Address = state.contracts.evo_registry.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid registry address".into() })))?;
    let exchange_addr: Address = state.contracts.hub_exchange.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid exchange address".into() })))?;

    let registry = contracts::IEvoRegistry::new(registry_addr, &state.provider);
    let exchange = contracts::IHubExchange::new(exchange_addr, &state.provider);

    let t = registry.getTokenByAddress(spoke_addr).call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    let info = exchange.getSpokeInfo(spoke_addr).call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    let spot_price = match exchange.getSpotPrice(spoke_addr).call().await {
        Ok(p) => p._0.to_string(),
        Err(_) => "0".to_string(),
    };

    Ok(Json(SpokeInfo {
        address: format!("{:?}", spoke_addr),
        name: t._0.name.clone(),
        symbol: t._0.symbol.clone(),
        curve_type: info.curveType,
        curve_param: info.curveParam.to_string(),
        creator: format!("{:?}", info.creator),
        reserve_balance: info.reserveBalance.to_string(),
        total_volume: info.totalVolume.to_string(),
        total_trades: info.totalTrades.to_string(),
        total_supply: info.totalSupply.to_string(),
        spot_price,
        fitness_score: t._0.fitnessScore.to_string(),
        active: info.active,
        metadata: t._0.metadata.clone(),
        created_at: t._0.createdAt.to_string(),
    }))
}

async fn get_creator_spokes(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let creator_addr: Address = address.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid address".into() })))?;
    let registry_addr: Address = state.contracts.evo_registry.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid registry address".into() })))?;

    let registry = contracts::IEvoRegistry::new(registry_addr, &state.provider);
    let ids = registry.getCreatorTokens(creator_addr).call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    let id_strings: Vec<String> = ids._0.iter().map(|id| id.to_string()).collect();
    Ok(Json(serde_json::json!({ "creator": address, "token_ids": id_strings })))
}

async fn get_price(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let spoke_addr: Address = address.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid address".into() })))?;
    let exchange_addr: Address = state.contracts.hub_exchange.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid exchange address".into() })))?;

    let exchange = contracts::IHubExchange::new(exchange_addr, &state.provider);
    let price = exchange.getSpotPrice(spoke_addr).call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    Ok(Json(serde_json::json!({
        "spoke": address,
        "spot_price": price._0.to_string(),
    })))
}

async fn get_balance(
    State(state): State<Arc<AppState>>,
    Path((token, wallet)): Path<(String, String)>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let token_addr: Address = token.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid token address".into() })))?;
    let wallet_addr: Address = wallet.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ApiError { error: "Invalid wallet address".into() })))?;

    let erc20 = contracts::IEvoToken::new(token_addr, &state.provider);
    let balance = erc20.balanceOf(wallet_addr).call().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: e.to_string() })))?;

    Ok(Json(serde_json::json!({
        "token": token,
        "wallet": wallet,
        "balance": balance._0.to_string(),
    })))
}

// --- Write endpoints (return unsigned tx calldata) ---

async fn build_create_tx(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTokenRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let factory_addr = &state.contracts.token_factory;
    let metadata = req.metadata.unwrap_or_else(|| "{}".to_string());

    // Return the calldata and target for client-side signing
    Ok(Json(serde_json::json!({
        "to": factory_addr,
        "function": "createToken",
        "args": {
            "name": req.name,
            "symbol": req.symbol,
            "curveType": req.curve_type,
            "curveParam": req.curve_param,
            "buyFeeBps": req.buy_fee_bps,
            "sellFeeBps": req.sell_fee_bps,
            "burnBps": req.burn_bps,
            "metadata": metadata,
        }
    })))
}

async fn build_buy_tx(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BuyRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let exchange_addr = &state.contracts.hub_exchange;
    let min_out = req.min_tokens_out.unwrap_or_else(|| "0".to_string());

    Ok(Json(serde_json::json!({
        "to": exchange_addr,
        "function": "buy",
        "args": {
            "spoke": req.spoke,
            "evoAmount": req.evo_amount,
            "minTokensOut": min_out,
        },
        "approve": {
            "token": state.contracts.evo_token,
            "spender": exchange_addr,
            "amount": req.evo_amount,
        }
    })))
}

async fn build_sell_tx(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SellRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let exchange_addr = &state.contracts.hub_exchange;
    let min_out = req.min_evo_out.unwrap_or_else(|| "0".to_string());

    Ok(Json(serde_json::json!({
        "to": exchange_addr,
        "function": "sell",
        "args": {
            "spoke": req.spoke,
            "tokenAmount": req.token_amount,
            "minEvoOut": min_out,
        }
    })))
}
