use axum::{
    extract::Path,
    http::StatusCode,
    response::{Html, IntoResponse, Json},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(serve_html))
        .route("/api/rates", get(get_rates))
        .route("/api/prices", get(get_prices))
        .route("/api/positions/:address", get(get_positions))
        .layer(CorsLayer::permissive());

    let addr = "0.0.0.0:8420";
    println!("ModFi running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn serve_html() -> Html<&'static str> {
    Html(include_str!("../app/mod.html"))
}

// --- Rates endpoint: real APY from DeFi Llama ---

#[derive(Deserialize)]
struct LlamaPool {
    chain: Option<String>,
    project: Option<String>,
    symbol: Option<String>,
    apy: Option<f64>,
    #[serde(rename = "tvlUsd")]
    tvl_usd: Option<f64>,
}

#[derive(Deserialize)]
struct LlamaResponse {
    data: Vec<LlamaPool>,
}

#[derive(Serialize, Clone)]
struct RateInfo {
    protocol: String,
    token: String,
    apy: f64,
    tvl: f64,
}

#[derive(Serialize)]
struct RatesResponse {
    rates: Vec<RateInfo>,
    timestamp: u64,
}

fn match_project(project: &str) -> Option<&'static str> {
    match project {
        "aave-v3" => Some("aave-v3"),
        "compound-v3" => Some("compound-v3"),
        "moonwell-apollo" | "moonwell" => Some("moonwell"),
        "morpho" | "morpho-blue" => Some("morpho"),
        "extra-finance" => Some("extra-finance"),
        "aerodrome-v2" | "aerodrome" | "aerodrome-v1" => Some("aerodrome"),
        _ => None,
    }
}

async fn get_rates() -> impl IntoResponse {
    let client = reqwest::Client::new();
    let res = client
        .get("https://yields.llama.fi/pools")
        .send()
        .await;

    let res = match res {
        Ok(r) if r.status().is_success() => r,
        _ => return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "Failed to fetch rates"}))).into_response(),
    };

    let data: LlamaResponse = match res.json().await {
        Ok(d) => d,
        Err(_) => return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "Failed to parse rates"}))).into_response(),
    };

    // Track best rate per (protocol, token) key
    let mut best: HashMap<String, RateInfo> = HashMap::new();

    for pool in &data.data {
        let chain = pool.chain.as_deref().unwrap_or("");
        let project = pool.project.as_deref().unwrap_or("");
        let symbol = pool.symbol.as_deref().unwrap_or("").to_uppercase();

        if chain != "Base" {
            continue;
        }

        let protocol = match match_project(project) {
            Some(p) => p,
            None => continue,
        };

        // Match known tokens (exact match to avoid SYRUPUSDC etc.)
        let token = if symbol == "USDC" {
            "USDC"
        } else if symbol == "USDT" {
            "USDT"
        } else if symbol == "WETH" || symbol == "ETH" {
            "ETH"
        } else if symbol == "CBETH" {
            "cbETH"
        } else {
            continue;
        };

        let apy = pool.apy.unwrap_or(0.0);
        let tvl = pool.tvl_usd.unwrap_or(0.0);

        let key = format!("{}:{}", protocol, token);
        let entry = best.get(&key);
        if entry.is_none() || apy > entry.unwrap().apy {
            best.insert(key, RateInfo {
                protocol: protocol.into(),
                token: token.into(),
                apy: (apy * 100.0).round() / 100.0,
                tvl: tvl.round(),
            });
        }
    }

    let rates: Vec<RateInfo> = best.into_values().collect();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    Json(RatesResponse { rates, timestamp }).into_response()
}

// --- Prices endpoint: real prices from DeFi Llama ---

#[derive(Serialize)]
struct PricesResponse {
    prices: HashMap<String, f64>,
    timestamp: u64,
}

#[derive(Deserialize)]
struct CoinPrice {
    price: f64,
}

#[derive(Deserialize)]
struct CoinsResponse {
    coins: HashMap<String, CoinPrice>,
}

const TOKENS: &[(&str, &str)] = &[
    ("USDC", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    ("USDT", "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"),
    ("ETH", "0x4200000000000000000000000000000000000006"),
];

async fn get_prices() -> impl IntoResponse {
    let keys: Vec<String> = TOKENS.iter().map(|(_, addr)| format!("base:{}", addr)).collect();
    let url = format!("https://coins.llama.fi/prices/current/{}", keys.join(","));

    let client = reqwest::Client::new();
    let res = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "Failed to fetch prices"}))).into_response(),
    };

    let data: CoinsResponse = match res.json().await {
        Ok(d) => d,
        Err(_) => return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "Failed to parse prices"}))).into_response(),
    };

    let mut prices = HashMap::new();
    for (symbol, addr) in TOKENS {
        let key = format!("base:{}", addr);
        if let Some(coin) = data.coins.get(&key) {
            prices.insert(symbol.to_string(), coin.price);
        }
    }

    if prices.is_empty() {
        return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "No price data"}))).into_response();
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    Json(PricesResponse { prices, timestamp }).into_response()
}

// --- Positions endpoint: on-chain balances via Base RPC ---

#[derive(Serialize)]
struct PositionsResponse {
    address: String,
    balances: HashMap<String, String>,
    timestamp: u64,
}

#[derive(Serialize)]
struct RpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct RpcResponse {
    result: Option<String>,
}

async fn rpc_call(client: &reqwest::Client, method: &str, params: serde_json::Value) -> Option<String> {
    let req = RpcRequest {
        jsonrpc: "2.0",
        id: 1,
        method: method.into(),
        params,
    };

    let res = client
        .post("https://mainnet.base.org")
        .json(&req)
        .send()
        .await
        .ok()?;

    let data: RpcResponse = res.json().await.ok()?;
    data.result
}

fn hex_to_balance(hex: &str, decimals: u32) -> String {
    let hex = hex.trim_start_matches("0x");
    if hex.is_empty() || hex == "0" {
        return "0.000000".into();
    }

    let value = u128::from_str_radix(hex, 16).unwrap_or(0);
    let divisor = 10u128.pow(decimals);
    let whole = value / divisor;
    let frac = value % divisor;
    let frac_str = format!("{:0>width$}", frac, width = decimals as usize);
    format!("{}.{}", whole, &frac_str[..6.min(frac_str.len())])
}

async fn get_positions(Path(address): Path<String>) -> impl IntoResponse {
    if !address.starts_with("0x") || address.len() != 42 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid address"}))).into_response();
    }

    let client = reqwest::Client::new();
    let padded = format!("{:0>64}", &address[2..]);

    // balanceOf(address) = 0x70a08231
    let balance_of = |token_addr: &str| {
        let data = format!("0x70a08231{}", padded);
        serde_json::json!([{"to": token_addr, "data": data}, "latest"])
    };

    let (usdc, usdt, weth, eth) = tokio::join!(
        rpc_call(&client, "eth_call", balance_of("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")),
        rpc_call(&client, "eth_call", balance_of("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2")),
        rpc_call(&client, "eth_call", balance_of("0x4200000000000000000000000000000000000006")),
        rpc_call(&client, "eth_getBalance", serde_json::json!([&address, "latest"])),
    );

    let mut balances = HashMap::new();
    balances.insert("USDC".into(), hex_to_balance(&usdc.unwrap_or_default(), 6));
    balances.insert("USDT".into(), hex_to_balance(&usdt.unwrap_or_default(), 6));
    balances.insert("WETH".into(), hex_to_balance(&weth.unwrap_or_default(), 18));
    balances.insert("ETH".into(), hex_to_balance(&eth.unwrap_or_default(), 18));

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    Json(PositionsResponse {
        address,
        balances,
        timestamp,
    }).into_response()
}
