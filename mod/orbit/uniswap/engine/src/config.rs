use crate::types::{ChainId, TokenInfo, PoolInfo};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ChainConfig {
    pub chain_id: ChainId,
    pub rpc_url: String,
    pub router: String,
    pub quoter: String,
    pub position_manager: String,
    pub tokens: HashMap<String, TokenInfo>,
    pub pools: Vec<PoolInfo>,
}

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub port: u16,
    pub data_path: String,
    pub log_level: String,
}

/// Load config.json from parent directory (or CONFIG_PATH env)
fn load_config_json() -> Option<serde_json::Value> {
    let paths = [
        std::env::var("CONFIG_PATH").unwrap_or_default(),
        "../config.json".to_string(),
        "config.json".to_string(),
        "../../config.json".to_string(),
    ];
    for p in &paths {
        if p.is_empty() { continue; }
        if let Ok(data) = std::fs::read_to_string(p) {
            if let Ok(json) = serde_json::from_str(&data) {
                tracing::info!("Loaded config from {}", p);
                return Some(json);
            }
        }
    }
    tracing::warn!("config.json not found, using defaults");
    None
}

pub fn load_engine_config() -> EngineConfig {
    let json = load_config_json();
    let engine = json.as_ref().and_then(|j| j.get("engine"));

    EngineConfig {
        port: std::env::var("PORT")
            .ok().and_then(|s| s.parse().ok())
            .or_else(|| engine.and_then(|e| e.get("port")).and_then(|p| p.as_u64()).map(|p| p as u16))
            .unwrap_or(8080),
        data_path: std::env::var("DATA_PATH")
            .ok()
            .or_else(|| engine.and_then(|e| e.get("data_path")).and_then(|d| d.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| "data".to_string()),
        log_level: std::env::var("RUST_LOG")
            .ok()
            .or_else(|| engine.and_then(|e| e.get("log_level")).and_then(|l| l.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| "uniswap_engine=info".to_string()),
    }
}

pub fn load_chain_configs() -> HashMap<ChainId, ChainConfig> {
    let json = load_config_json();
    let chains = json.as_ref().and_then(|j| j.get("chains"));

    let mut configs = HashMap::new();

    // Base
    let base_chain = chains.and_then(|c| c.get("base"));
    let base_rpc = std::env::var("BASE_RPC_URL")
        .ok()
        .or_else(|| base_chain.and_then(|c| c.get("rpc_url")).and_then(|r| r.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| "https://base.gateway.tenderly.co".to_string());

    let base_contracts = base_chain.and_then(|c| c.get("contracts"));
    let base_tokens_json = base_chain.and_then(|c| c.get("tokens"));
    let base_pools_json = base_chain.and_then(|c| c.get("pools"));

    let mut base_tokens = HashMap::new();
    if let Some(tokens) = base_tokens_json.and_then(|t| t.as_object()) {
        for (sym, info) in tokens {
            base_tokens.insert(sym.clone(), TokenInfo {
                symbol: sym.clone(),
                address: info.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string(),
                decimals: info.get("decimals").and_then(|d| d.as_u64()).unwrap_or(18) as u8,
            });
        }
    } else {
        // Fallback defaults
        base_tokens.insert("WETH".into(), TokenInfo { symbol: "WETH".into(), address: "0x4200000000000000000000000000000000000006".into(), decimals: 18 });
        base_tokens.insert("USDC".into(), TokenInfo { symbol: "USDC".into(), address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".into(), decimals: 6 });
        base_tokens.insert("DAI".into(), TokenInfo { symbol: "DAI".into(), address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb".into(), decimals: 18 });
        base_tokens.insert("USDT".into(), TokenInfo { symbol: "USDT".into(), address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2".into(), decimals: 6 });
    }

    let base_pools = if let Some(pools) = base_pools_json.and_then(|p| p.as_array()) {
        pools.iter().filter_map(|p| {
            Some(PoolInfo {
                name: p.get("name")?.as_str()?.to_string(),
                address: p.get("address")?.as_str()?.to_string(),
                token0: p.get("token0")?.as_str()?.to_string(),
                token1: p.get("token1")?.as_str()?.to_string(),
                fee: p.get("fee")?.as_u64()? as u32,
            })
        }).collect()
    } else {
        vec![
            PoolInfo { name: "WETH/USDC".into(), address: "0xd0b53D9277642d899DF5C87A3966A349A798F224".into(), token0: "WETH".into(), token1: "USDC".into(), fee: 3000 },
            PoolInfo { name: "WETH/DAI".into(), address: "0x6c6Bc977E13Df9b0de53b251522280BB72383700".into(), token0: "WETH".into(), token1: "DAI".into(), fee: 3000 },
        ]
    };

    configs.insert(ChainId::Base, ChainConfig {
        chain_id: ChainId::Base,
        rpc_url: base_rpc,
        router: base_contracts.and_then(|c| c.get("router")).and_then(|r| r.as_str()).unwrap_or("0x2626664c2603336E57B271c5C0b26F421741e481").to_string(),
        quoter: base_contracts.and_then(|c| c.get("quoter")).and_then(|q| q.as_str()).unwrap_or("0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a").to_string(),
        position_manager: base_contracts.and_then(|c| c.get("position_manager")).and_then(|p| p.as_str()).unwrap_or("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1").to_string(),
        tokens: base_tokens,
        pools: base_pools,
    });

    // Polygon
    let polygon_chain = chains.and_then(|c| c.get("polygon"));
    let polygon_rpc = std::env::var("POLYGON_RPC_URL")
        .ok()
        .or_else(|| polygon_chain.and_then(|c| c.get("rpc_url")).and_then(|r| r.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| "https://polygon-bor-rpc.publicnode.com".to_string());

    let polygon_contracts = polygon_chain.and_then(|c| c.get("contracts"));
    let polygon_tokens_json = polygon_chain.and_then(|c| c.get("tokens"));
    let polygon_pools_json = polygon_chain.and_then(|c| c.get("pools"));

    let mut polygon_tokens = HashMap::new();
    if let Some(tokens) = polygon_tokens_json.and_then(|t| t.as_object()) {
        for (sym, info) in tokens {
            polygon_tokens.insert(sym.clone(), TokenInfo {
                symbol: sym.clone(),
                address: info.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string(),
                decimals: info.get("decimals").and_then(|d| d.as_u64()).unwrap_or(18) as u8,
            });
        }
    } else {
        polygon_tokens.insert("WMATIC".into(), TokenInfo { symbol: "WMATIC".into(), address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270".into(), decimals: 18 });
        polygon_tokens.insert("WETH".into(), TokenInfo { symbol: "WETH".into(), address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619".into(), decimals: 18 });
        polygon_tokens.insert("USDC".into(), TokenInfo { symbol: "USDC".into(), address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359".into(), decimals: 6 });
        polygon_tokens.insert("USDT".into(), TokenInfo { symbol: "USDT".into(), address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F".into(), decimals: 6 });
        polygon_tokens.insert("DAI".into(), TokenInfo { symbol: "DAI".into(), address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063".into(), decimals: 18 });
    }

    let polygon_pools = if let Some(pools) = polygon_pools_json.and_then(|p| p.as_array()) {
        pools.iter().filter_map(|p| {
            Some(PoolInfo {
                name: p.get("name")?.as_str()?.to_string(),
                address: p.get("address")?.as_str()?.to_string(),
                token0: p.get("token0")?.as_str()?.to_string(),
                token1: p.get("token1")?.as_str()?.to_string(),
                fee: p.get("fee")?.as_u64()? as u32,
            })
        }).collect()
    } else {
        vec![
            PoolInfo { name: "WETH/USDC".into(), address: "0x45dDa9cb7c25131DF268515131580e8DAf2e3aF7".into(), token0: "WETH".into(), token1: "USDC".into(), fee: 3000 },
            PoolInfo { name: "WMATIC/USDC".into(), address: "0xA374094527e1673A86dE625aa59517c5dE346d32".into(), token0: "WMATIC".into(), token1: "USDC".into(), fee: 3000 },
            PoolInfo { name: "WMATIC/WETH".into(), address: "0x167384319B41F7094e62f7506409Eb38079AbfF8".into(), token0: "WMATIC".into(), token1: "WETH".into(), fee: 3000 },
        ]
    };

    configs.insert(ChainId::Polygon, ChainConfig {
        chain_id: ChainId::Polygon,
        rpc_url: polygon_rpc,
        router: polygon_contracts.and_then(|c| c.get("router")).and_then(|r| r.as_str()).unwrap_or("0xE592427A0AEce92De3Edee1F18E0157C05861564").to_string(),
        quoter: polygon_contracts.and_then(|c| c.get("quoter")).and_then(|q| q.as_str()).unwrap_or("0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6").to_string(),
        position_manager: polygon_contracts.and_then(|c| c.get("position_manager")).and_then(|p| p.as_str()).unwrap_or("0xC36442b4a4522E871399CD717aBDD847Ab11FE88").to_string(),
        tokens: polygon_tokens,
        pools: polygon_pools,
    });

    configs
}
