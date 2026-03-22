/// Integration tests that hit real RPC endpoints (Base + Polygon mainnet)
/// These test actual on-chain data, no mocks.
///
/// Run unit tests: cargo test
/// Run RPC tests:  cargo test -- --ignored --test-threads=1

use std::sync::Arc;
use alloy::primitives::Address;
use alloy::providers::{Provider, RootProvider};
use alloy::network::Ethereum;

fn base_provider() -> Arc<RootProvider<Ethereum>> {
    let url: reqwest::Url = "https://mainnet.base.org".parse().unwrap();
    Arc::new(RootProvider::new_http(url))
}

fn polygon_provider() -> Arc<RootProvider<Ethereum>> {
    let url: reqwest::Url = std::env::var("POLYGON_RPC_URL")
        .unwrap_or_else(|_| "https://polygon-bor-rpc.publicnode.com".to_string())
        .parse().unwrap();
    Arc::new(RootProvider::new_http(url))
}

// --- Chain connectivity ---

#[tokio::test]
#[ignore] // requires RPC access
async fn test_base_rpc_connected() {
    let provider = base_provider();
    let block = provider.get_block_number().await.unwrap();
    assert!(block > 0, "Base block number should be > 0, got {}", block);
    println!("Base latest block: {}", block);
}

#[tokio::test]
#[ignore] // requires RPC access
async fn test_polygon_rpc_connected() {
    let provider = polygon_provider();
    let block = provider.get_block_number().await.unwrap();
    assert!(block > 0, "Polygon block number should be > 0, got {}", block);
    println!("Polygon latest block: {}", block);
}

// --- Pool state reads (real on-chain data) ---

mod pool_tests {
    use super::*;
    use alloy::sol;

    sol! {
        #[sol(rpc)]
        interface IUniswapV3Pool {
            function slot0() external view returns (
                uint160 sqrtPriceX96,
                int24 tick,
                uint16 observationIndex,
                uint16 observationCardinality,
                uint16 observationCardinalityNext,
                uint8 feeProtocol,
                bool unlocked
            );
            function liquidity() external view returns (uint128);
            function token0() external view returns (address);
            function token1() external view returns (address);
            function fee() external view returns (uint24);
        }
    }

    // Base WETH/USDC pool
    const BASE_WETH_USDC_POOL: &str = "0xd0b53D9277642d899DF5C87A3966A349A798F224";
    // Polygon WETH/USDC pool
    const POLYGON_WETH_USDC_POOL: &str = "0x45dDa9cb7c25131DF268515131580e8DAf2e3aF7";

    #[tokio::test]
    #[ignore]
    async fn test_base_pool_slot0() {
        let provider = base_provider();
        let addr: Address = BASE_WETH_USDC_POOL.parse().unwrap();
        let pool = IUniswapV3Pool::new(addr, &*provider);

        let slot0 = pool.slot0().call().await.unwrap();

        // sqrtPriceX96 should be non-zero for an active pool
        assert!(slot0.sqrtPriceX96 > alloy::primitives::U160::ZERO, "sqrtPriceX96 should be > 0");

        // Calculate price from sqrtPriceX96
        let sqrt_f = slot0.sqrtPriceX96.to::<u128>() as f64 / (2_u128.pow(96) as f64);
        let price = sqrt_f * sqrt_f;
        println!("Base WETH/USDC pool price (raw): {:.10}", price);
        println!("Base WETH/USDC tick: {}", slot0.tick);

        // Price should be reasonable (WETH/USDC with 18/6 decimals)
        assert!(price > 0.0, "Price should be positive");
    }

    #[tokio::test]
    #[ignore]
    async fn test_base_pool_liquidity() {
        let provider = base_provider();
        let addr: Address = BASE_WETH_USDC_POOL.parse().unwrap();
        let pool = IUniswapV3Pool::new(addr, &*provider);

        let liquidity: u128 = pool.liquidity().call().await.unwrap();
        assert!(liquidity > 0, "Pool should have liquidity, got {}", liquidity);
        println!("Base WETH/USDC liquidity: {}", liquidity);
    }

    #[tokio::test]
    #[ignore]
    async fn test_base_pool_tokens() {
        let provider = base_provider();
        let addr: Address = BASE_WETH_USDC_POOL.parse().unwrap();
        let pool = IUniswapV3Pool::new(addr, &*provider);

        let token0: Address = pool.token0().call().await.unwrap();
        let token1: Address = pool.token1().call().await.unwrap();
        let fee: u32 = pool.fee().call().await.unwrap().to::<u32>();

        println!("token0: {}", token0);
        println!("token1: {}", token1);
        println!("fee: {}", fee);

        // Verify these are real addresses (non-zero)
        assert_ne!(token0, Address::ZERO, "token0 should not be zero address");
        assert_ne!(token1, Address::ZERO, "token1 should not be zero address");
        assert!(fee > 0, "fee should be > 0");
    }

    #[tokio::test]
    #[ignore]
    async fn test_polygon_pool_slot0() {
        let provider = polygon_provider();
        let addr: Address = POLYGON_WETH_USDC_POOL.parse().unwrap();
        let pool = IUniswapV3Pool::new(addr, &*provider);

        let slot0 = pool.slot0().call().await.unwrap();
        assert!(slot0.sqrtPriceX96 > alloy::primitives::U160::ZERO, "sqrtPriceX96 should be > 0");

        let sqrt_f = slot0.sqrtPriceX96.to::<u128>() as f64 / (2_u128.pow(96) as f64);
        let price = sqrt_f * sqrt_f;
        println!("Polygon WETH/USDC pool price (raw): {:.10}", price);
        println!("Polygon WETH/USDC tick: {}", slot0.tick);
        assert!(price > 0.0, "Price should be positive");
    }

    #[tokio::test]
    #[ignore]
    async fn test_polygon_pool_liquidity() {
        let provider = polygon_provider();
        let addr: Address = POLYGON_WETH_USDC_POOL.parse().unwrap();
        let pool = IUniswapV3Pool::new(addr, &*provider);

        let liquidity: u128 = pool.liquidity().call().await.unwrap();
        assert!(liquidity > 0, "Polygon pool should have liquidity");
        println!("Polygon WETH/USDC liquidity: {}", liquidity);
    }
}

// --- ERC20 token reads ---

mod token_tests {
    use super::*;
    use alloy::sol;

    sol! {
        #[sol(rpc)]
        interface IERC20 {
            function decimals() external view returns (uint8);
            function symbol() external view returns (string);
            function balanceOf(address account) external view returns (uint256);
            function totalSupply() external view returns (uint256);
        }
    }

    // Base USDC
    const BASE_USDC: &str = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    // Base WETH
    const BASE_WETH: &str = "0x4200000000000000000000000000000000000006";
    // Polygon USDC
    const POLYGON_USDC: &str = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
    // Polygon WMATIC
    const POLYGON_WMATIC: &str = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

    #[tokio::test]
    #[ignore]
    async fn test_base_usdc_metadata() {
        let provider = base_provider();
        let addr: Address = BASE_USDC.parse().unwrap();
        let token = IERC20::new(addr, &*provider);

        let decimals: u8 = token.decimals().call().await.unwrap();
        let symbol: String = token.symbol().call().await.unwrap();

        assert_eq!(decimals, 6, "USDC should have 6 decimals");
        assert!(symbol == "USDC" || symbol == "USDbC",
            "Symbol should be USDC or USDbC, got {}", symbol);
        println!("Base USDC: symbol={}, decimals={}", symbol, decimals);
    }

    #[tokio::test]
    #[ignore]
    async fn test_base_weth_metadata() {
        let provider = base_provider();
        let addr: Address = BASE_WETH.parse().unwrap();
        let token = IERC20::new(addr, &*provider);

        let decimals: u8 = token.decimals().call().await.unwrap();
        assert_eq!(decimals, 18, "WETH should have 18 decimals");
        println!("Base WETH decimals: {}", decimals);
    }

    #[tokio::test]
    #[ignore]
    async fn test_base_usdc_total_supply() {
        let provider = base_provider();
        let addr: Address = BASE_USDC.parse().unwrap();
        let token = IERC20::new(addr, &*provider);

        let supply: alloy::primitives::U256 = token.totalSupply().call().await.unwrap();
        assert!(supply > alloy::primitives::U256::ZERO, "Total supply should be > 0");
        println!("Base USDC total supply: {}", supply);
    }

    #[tokio::test]
    #[ignore]
    async fn test_polygon_usdc_metadata() {
        let provider = polygon_provider();
        let addr: Address = POLYGON_USDC.parse().unwrap();
        let token = IERC20::new(addr, &*provider);

        let decimals: u8 = token.decimals().call().await.unwrap();
        assert_eq!(decimals, 6, "Polygon USDC should have 6 decimals");
        println!("Polygon USDC decimals: {}", decimals);
    }

    #[tokio::test]
    #[ignore]
    async fn test_polygon_wmatic_metadata() {
        let provider = polygon_provider();
        let addr: Address = POLYGON_WMATIC.parse().unwrap();
        let token = IERC20::new(addr, &*provider);

        let decimals: u8 = token.decimals().call().await.unwrap();
        let symbol: String = token.symbol().call().await.unwrap();

        assert_eq!(decimals, 18, "WMATIC should have 18 decimals");
        println!("Polygon WMATIC: symbol={}, decimals={}", symbol, decimals);
    }
}

// --- Swap calldata encoding ---

mod swap_tests {
    use alloy::primitives::{Address, U256, U160};
    use alloy::sol;
    use alloy::sol_types::SolCall;

    sol! {
        interface ISwapRouter {
            struct ExactInputSingleParams {
                address tokenIn;
                address tokenOut;
                uint24 fee;
                address recipient;
                uint256 amountIn;
                uint256 amountOutMinimum;
                uint160 sqrtPriceLimitX96;
            }

            function exactInputSingle(ExactInputSingleParams calldata params)
                external payable returns (uint256 amountOut);
        }
    }

    #[test]
    fn test_swap_calldata_encoding() {
        let token_in: Address = "0x4200000000000000000000000000000000000006".parse().unwrap();
        let token_out: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".parse().unwrap();
        let recipient: Address = "0x0000000000000000000000000000000000000001".parse().unwrap();

        let params = ISwapRouter::ExactInputSingleParams {
            tokenIn: token_in,
            tokenOut: token_out,
            fee: 3000u32.try_into().unwrap(),
            recipient,
            amountIn: U256::from(1_000_000_000_000_000_000u128), // 1 ETH
            amountOutMinimum: U256::from(2400_000_000u128),       // 2400 USDC (6 decimals)
            sqrtPriceLimitX96: U160::ZERO,
        };

        let call = ISwapRouter::exactInputSingleCall { params };
        let encoded = SolCall::abi_encode(&call);

        // Should start with the function selector (4 bytes)
        assert!(encoded.len() > 4, "Encoded calldata should be > 4 bytes");

        // Function selector for exactInputSingle
        let selector = &encoded[..4];
        println!("Selector: 0x{}", hex::encode(selector));
        println!("Full calldata length: {} bytes", encoded.len());
        println!("Calldata: 0x{}", hex::encode(&encoded));

        // Verify we can decode it back
        let decoded = ISwapRouter::exactInputSingleCall::abi_decode(&encoded).unwrap();
        assert_eq!(decoded.params.tokenIn, token_in);
        assert_eq!(decoded.params.tokenOut, token_out);
        assert_eq!(decoded.params.amountIn, U256::from(1_000_000_000_000_000_000u128));
    }

    #[test]
    fn test_approve_calldata_encoding() {
        use alloy::sol;

        sol! {
            interface IERC20 {
                function approve(address spender, uint256 amount) external returns (bool);
            }
        }

        let spender: Address = "0x2626664c2603336E57B271c5C0b26F421741e481".parse().unwrap();
        let call = IERC20::approveCall {
            spender,
            amount: U256::MAX,
        };
        let encoded = SolCall::abi_encode(&call);

        assert!(encoded.len() > 4);
        let decoded = IERC20::approveCall::abi_decode(&encoded).unwrap();
        assert_eq!(decoded.spender, spender);
        assert_eq!(decoded.amount, U256::MAX);
        println!("Approve calldata: 0x{}", hex::encode(&encoded));
    }
}

// --- Amount parsing/formatting ---

mod amount_tests {
    use alloy::primitives::U256;

    fn parse_amount(amount: &str, decimals: u8) -> eyre::Result<U256> {
        let parts: Vec<&str> = amount.split('.').collect();
        let (whole, frac) = match parts.len() {
            1 => (parts[0], ""),
            2 => (parts[0], parts[1]),
            _ => return Err(eyre::eyre!("Invalid amount format")),
        };
        let frac_padded = format!("{:0<width$}", frac, width = decimals as usize);
        let frac_trimmed = &frac_padded[..decimals as usize];
        let combined = format!("{}{}", whole, frac_trimmed);
        Ok(U256::from_str_radix(&combined, 10)?)
    }

    fn format_amount(amount: &U256, decimals: u8) -> String {
        let s = amount.to_string();
        let dec = decimals as usize;
        if s.len() <= dec {
            let padded = format!("{:0>width$}", s, width = dec + 1);
            let (whole, frac) = padded.split_at(padded.len() - dec);
            format!("{}.{}", whole, frac)
        } else {
            let (whole, frac) = s.split_at(s.len() - dec);
            format!("{}.{}", whole, frac)
        }
    }

    #[test]
    fn test_parse_whole_number() {
        let result = parse_amount("100", 6).unwrap();
        assert_eq!(result, U256::from(100_000_000u128));
    }

    #[test]
    fn test_parse_decimal() {
        let result = parse_amount("1.5", 18).unwrap();
        assert_eq!(result, U256::from(1_500_000_000_000_000_000u128));
    }

    #[test]
    fn test_parse_small_decimal() {
        let result = parse_amount("0.001", 6).unwrap();
        assert_eq!(result, U256::from(1000u128));
    }

    #[test]
    fn test_format_large_amount() {
        let amount = U256::from(2500_000_000u128); // 2500 USDC
        let formatted = format_amount(&amount, 6);
        assert_eq!(formatted, "2500.000000");
    }

    #[test]
    fn test_format_small_amount() {
        let amount = U256::from(1000u128); // 0.001 USDC
        let formatted = format_amount(&amount, 6);
        assert_eq!(formatted, "0.001000");
    }

    #[test]
    fn test_format_eth() {
        let amount = U256::from(1_000_000_000_000_000_000u128); // 1 ETH
        let formatted = format_amount(&amount, 18);
        assert_eq!(formatted, "1.000000000000000000");
    }

    #[test]
    fn test_roundtrip() {
        let original = "123.456789";
        let parsed = parse_amount(original, 6).unwrap();
        let formatted = format_amount(&parsed, 6);
        assert_eq!(formatted, original);
    }
}

// --- Config tests ---

mod config_tests {
    #[test]
    fn test_chain_id_base() {
        use uniswap_engine::types::ChainId;
        let chain = ChainId::from_str("base").unwrap();
        assert_eq!(chain.id(), 8453);
        assert_eq!(chain.name(), "base");
    }

    #[test]
    fn test_chain_id_polygon() {
        use uniswap_engine::types::ChainId;
        let chain = ChainId::from_str("polygon").unwrap();
        assert_eq!(chain.id(), 137);
        assert_eq!(chain.name(), "polygon");
    }

    #[test]
    fn test_chain_id_matic_alias() {
        use uniswap_engine::types::ChainId;
        let chain = ChainId::from_str("matic").unwrap();
        assert_eq!(chain.id(), 137);
    }

    #[test]
    fn test_chain_id_unknown() {
        use uniswap_engine::types::ChainId;
        assert!(ChainId::from_str("ethereum").is_none());
    }
}

// --- Strategy validation tests ---

mod strategy_tests {
    use serde_json::json;

    // Test DCA config validation
    #[test]
    fn test_dca_valid_config() {
        let config = json!({
            "token_in": "0x4200000000000000000000000000000000000006",
            "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount_per_tick": "100",
            "fee": 3000,
            "interval_secs": 3600
        });
        use uniswap_engine::strategy::dca::DcaStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(DcaStrategy::validate_config(&config).is_ok());
    }

    #[test]
    fn test_dca_missing_token_in() {
        let config = json!({
            "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount_per_tick": "100"
        });
        use uniswap_engine::strategy::dca::DcaStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(DcaStrategy::validate_config(&config).is_err());
    }

    #[test]
    fn test_dca_missing_amount() {
        let config = json!({
            "token_in": "0x4200000000000000000000000000000000000006",
            "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        });
        use uniswap_engine::strategy::dca::DcaStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(DcaStrategy::validate_config(&config).is_err());
    }

    // Test Limit Order config validation
    #[test]
    fn test_limit_valid_config() {
        let config = json!({
            "pool_address": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
            "token_in": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "token_out": "0x4200000000000000000000000000000000000006",
            "amount": "1000",
            "target_price": 0.0004,
            "direction": "below",
            "fee": 3000
        });
        use uniswap_engine::strategy::limit::LimitOrderStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(LimitOrderStrategy::validate_config(&config).is_ok());
    }

    #[test]
    fn test_limit_missing_target_price() {
        let config = json!({
            "pool_address": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
            "token_in": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "token_out": "0x4200000000000000000000000000000000000006",
            "amount": "1000"
        });
        use uniswap_engine::strategy::limit::LimitOrderStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(LimitOrderStrategy::validate_config(&config).is_err());
    }

    // Test Range LP config validation
    #[test]
    fn test_range_lp_valid_config() {
        let config = json!({
            "pool_address": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
            "tick_lower": -887220,
            "tick_upper": 887220,
            "token0": "0x4200000000000000000000000000000000000006",
            "token1": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        });
        use uniswap_engine::strategy::range::RangeLpStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(RangeLpStrategy::validate_config(&config).is_ok());
    }

    #[test]
    fn test_range_lp_missing_ticks() {
        let config = json!({
            "pool_address": "0xd0b53D9277642d899DF5C87A3966A349A798F224"
        });
        use uniswap_engine::strategy::range::RangeLpStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(RangeLpStrategy::validate_config(&config).is_err());
    }

    // Test Momentum config validation
    #[test]
    fn test_momentum_valid_config() {
        let config = json!({
            "pool_address": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
            "token_in": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "token_out": "0x4200000000000000000000000000000000000006",
            "amount": "500",
            "sma_short": 10,
            "sma_long": 50
        });
        use uniswap_engine::strategy::momentum::MomentumStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(MomentumStrategy::validate_config(&config).is_ok());
    }

    // Test Arb config validation
    #[test]
    fn test_arb_valid_config() {
        let config = json!({
            "pool_base": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
            "pool_polygon": "0x45dDa9cb7c25131DF268515131580e8DAf2e3aF7",
            "amount": "1000",
            "min_spread": 0.005,
            "token_in_base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "token_out_base": "0x4200000000000000000000000000000000000006",
            "token_in_polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
            "token_out_polygon": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"
        });
        use uniswap_engine::strategy::arb::ArbStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(ArbStrategy::validate_config(&config).is_ok());
    }

    // Test Rebalance config validation
    #[test]
    fn test_rebalance_valid_config() {
        let config = json!({
            "wallet": "0x0000000000000000000000000000000000000001",
            "targets": {
                "0x4200000000000000000000000000000000000006": 0.5,
                "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": 0.5
            },
            "base_token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "threshold": 0.05,
            "fee": 3000
        });
        use uniswap_engine::strategy::rebalance::RebalanceStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(RebalanceStrategy::validate_config(&config).is_ok());
    }

    #[test]
    fn test_rebalance_missing_wallet() {
        let config = json!({
            "targets": {},
            "base_token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        });
        use uniswap_engine::strategy::rebalance::RebalanceStrategy;
        use uniswap_engine::strategy::Strategy;
        assert!(RebalanceStrategy::validate_config(&config).is_err());
    }
}

// --- Discovery & RPC Round-Robin tests ---

mod discovery_tests {
    use uniswap_engine::types::ChainId;
    use uniswap_engine::discovery::RpcRoundRobin;
    use uniswap_engine::scraper::decode_int256;

    #[test]
    fn test_rpc_round_robin_cycles() {
        let rr = RpcRoundRobin::new(ChainId::Base, "https://mainnet.base.org");
        assert!(rr.len() >= 2, "Should have multiple gateways, got {}", rr.len());

        let first = rr.next().to_string();
        let second = rr.next().to_string();
        // After cycling through all, should come back
        for _ in 0..rr.len() - 2 {
            rr.next();
        }
        let wrapped = rr.next().to_string();
        assert_eq!(first, wrapped, "Should wrap around to first gateway");
        // Second call should give second gateway
        let second_again = rr.next().to_string();
        assert_eq!(second, second_again);
    }

    #[test]
    fn test_rpc_round_robin_primary_first() {
        let primary = "https://custom-rpc.example.com";
        let rr = RpcRoundRobin::new(ChainId::Base, primary);
        let first = rr.next();
        assert_eq!(first, primary, "Primary RPC should be first in rotation");
    }

    #[test]
    fn test_rpc_round_robin_no_duplicates() {
        let rr = RpcRoundRobin::new(ChainId::Base, "https://mainnet.base.org");
        let mut seen = std::collections::HashSet::new();
        for _ in 0..rr.len() {
            let url = rr.next().to_string();
            assert!(seen.insert(url.clone()), "Duplicate gateway found: {}", url);
        }
    }

    #[test]
    fn test_rpc_round_robin_skip() {
        let rr = RpcRoundRobin::new(ChainId::Base, "https://mainnet.base.org");
        let first = rr.next().to_string();
        rr.skip(); // skip past next
        let after_skip = rr.next().to_string();
        assert_ne!(first, after_skip, "Skip should advance past next gateway");
    }

    #[test]
    fn test_polygon_has_gateways() {
        let rr = RpcRoundRobin::new(ChainId::Polygon, "https://polygon-bor-rpc.publicnode.com");
        assert!(rr.len() >= 2, "Polygon should have multiple gateways");
    }

    // --- Swap event parsing tests ---

    #[test]
    fn test_decode_int256_positive() {
        // 1 ETH = 1000000000000000000 in hex
        let mut data = [0u8; 32];
        let val_bytes = 1_000_000_000_000_000_000u128.to_be_bytes();
        data[16..32].copy_from_slice(&val_bytes);
        let result = decode_int256(&data);
        assert_eq!(result, 1_000_000_000_000_000_000i128);
    }

    #[test]
    fn test_decode_int256_negative() {
        // -1 in two's complement (all 0xff)
        let data = [0xffu8; 32];
        let result = decode_int256(&data);
        assert_eq!(result, -1i128);
    }

    #[test]
    fn test_decode_int256_zero() {
        let data = [0u8; 32];
        let result = decode_int256(&data);
        assert_eq!(result, 0i128);
    }

    #[test]
    fn test_decode_int256_negative_amount() {
        // Simulate a typical negative swap amount: -500 USDC (6 decimals) = -500_000_000
        // Two's complement of -500000000
        let val: i128 = -500_000_000;
        let mut data = if val < 0 { [0xffu8; 32] } else { [0u8; 32] };
        let bytes = (val as u128).to_be_bytes();
        data[16..32].copy_from_slice(&bytes);
        let result = decode_int256(&data);
        assert_eq!(result, val);
    }

    // --- USD volume estimation (unit tests for the logic) ---

    #[test]
    fn test_usd_volume_stable_token0() {
        // If token0 is USDC (6 decimals), abs_amount0 = 1_000_000 (= 1 USDC)
        // The estimate should use the stable amount directly
        let abs_amount0: u128 = 1_000_000;
        let decimals: u8 = 6;
        let usd = abs_amount0 as f64 / 10f64.powi(decimals as i32);
        assert!((usd - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_usd_volume_large_trade() {
        // 100k USDC
        let abs_amount: u128 = 100_000_000_000; // 100k with 6 decimals
        let decimals: u8 = 6;
        let usd = abs_amount as f64 / 10f64.powi(decimals as i32);
        assert!((usd - 100_000.0).abs() < 0.01);
    }

    // --- Cache save/load tests ---

    #[test]
    fn test_cache_roundtrip() {
        use uniswap_engine::types::{TopTradersCache, TopTrader};

        let cache = TopTradersCache {
            chain: ChainId::Base,
            days: 7,
            scanned_at: chrono::Utc::now(),
            from_block: 1000,
            to_block: 2000,
            traders: vec![
                TopTrader {
                    rank: 1,
                    address: "0x1234567890abcdef1234567890abcdef12345678".into(),
                    trade_count: 42,
                    total_volume_usd: 123456.78,
                    most_traded: vec!["WETH".into(), "USDC".into()],
                    last_active: chrono::Utc::now(),
                    first_seen: chrono::Utc::now() - chrono::Duration::days(3),
                },
            ],
        };

        let tmp = std::env::temp_dir().join("uniswap_test_cache");
        let _ = std::fs::create_dir_all(tmp.join("discovery"));
        let data_path = tmp.to_str().unwrap();

        uniswap_engine::discovery::save_top_traders(data_path, &cache);
        let loaded = uniswap_engine::discovery::load_cached_top_traders(data_path, ChainId::Base, 7);

        assert!(loaded.is_some(), "Cache should load after save");
        let loaded = loaded.unwrap();
        assert_eq!(loaded.chain, ChainId::Base);
        assert_eq!(loaded.days, 7);
        assert_eq!(loaded.traders.len(), 1);
        assert_eq!(loaded.traders[0].rank, 1);
        assert_eq!(loaded.traders[0].trade_count, 42);
        assert!((loaded.traders[0].total_volume_usd - 123456.78).abs() < 0.01);
        assert_eq!(loaded.traders[0].most_traded, vec!["WETH", "USDC"]);

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_cache_load_nonexistent() {
        let loaded = uniswap_engine::discovery::load_cached_top_traders("/nonexistent/path", ChainId::Base, 7);
        assert!(loaded.is_none());
    }

    #[test]
    fn test_cache_different_days() {
        use uniswap_engine::types::{TopTradersCache, TopTrader};

        let tmp = std::env::temp_dir().join("uniswap_test_cache_days");
        let _ = std::fs::create_dir_all(tmp.join("discovery"));
        let data_path = tmp.to_str().unwrap();

        let cache_7d = TopTradersCache {
            chain: ChainId::Base, days: 7,
            scanned_at: chrono::Utc::now(),
            from_block: 1000, to_block: 2000,
            traders: vec![TopTrader {
                rank: 1, address: "0xaaa".into(), trade_count: 10,
                total_volume_usd: 100.0, most_traded: vec![],
                last_active: chrono::Utc::now(), first_seen: chrono::Utc::now(),
            }],
        };
        let cache_30d = TopTradersCache {
            chain: ChainId::Base, days: 30,
            scanned_at: chrono::Utc::now(),
            from_block: 500, to_block: 2000,
            traders: vec![TopTrader {
                rank: 1, address: "0xbbb".into(), trade_count: 50,
                total_volume_usd: 500.0, most_traded: vec![],
                last_active: chrono::Utc::now(), first_seen: chrono::Utc::now(),
            }],
        };

        uniswap_engine::discovery::save_top_traders(data_path, &cache_7d);
        uniswap_engine::discovery::save_top_traders(data_path, &cache_30d);

        let loaded_7 = uniswap_engine::discovery::load_cached_top_traders(data_path, ChainId::Base, 7).unwrap();
        let loaded_30 = uniswap_engine::discovery::load_cached_top_traders(data_path, ChainId::Base, 30).unwrap();
        assert_eq!(loaded_7.traders[0].address, "0xaaa");
        assert_eq!(loaded_30.traders[0].address, "0xbbb");

        // 14d should not exist
        assert!(uniswap_engine::discovery::load_cached_top_traders(data_path, ChainId::Base, 14).is_none());

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // --- RPC integration test (hits real chain, gated behind #[ignore]) ---

    #[tokio::test]
    #[ignore]
    async fn test_rpc_round_robin_real_requests() {
        let rr = RpcRoundRobin::new(ChainId::Base, "https://mainnet.base.org");
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (test)")
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap();

        let mut successes = 0;
        for i in 0..rr.len() {
            let url = rr.next();
            let body = serde_json::json!({
                "jsonrpc": "2.0",
                "method": "eth_blockNumber",
                "params": [],
                "id": i,
            });

            match client.post(url).json(&body).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let json: serde_json::Value = resp.json().await.unwrap();
                    if json.get("result").is_some() {
                        println!("Gateway OK: {}", url);
                        successes += 1;
                    } else {
                        println!("Gateway error response: {} -> {}", url, json);
                    }
                }
                Ok(resp) => println!("Gateway HTTP error: {} -> {}", url, resp.status()),
                Err(e) => println!("Gateway connection error: {} -> {}", url, e),
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }

        assert!(successes >= 2, "At least 2 gateways should work, got {}", successes);
        println!("{}/{} gateways responding", successes, rr.len());
    }

    #[tokio::test]
    #[ignore]
    async fn test_discovery_scan_small_window() {
        // Scan just 100 blocks (~3 minutes) to verify the pipeline works end-to-end
        use uniswap_engine::discovery::RpcRoundRobin;

        let rr = RpcRoundRobin::new(ChainId::Base, "https://mainnet.base.org");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap();

        // Get current block
        let body = serde_json::json!({
            "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1
        });
        let resp = client.post(rr.next()).json(&body).send().await.unwrap();
        let json: serde_json::Value = resp.json().await.unwrap();
        let block_hex = json["result"].as_str().unwrap();
        let current_block = u64::from_str_radix(block_hex.trim_start_matches("0x"), 16).unwrap();

        // Fetch logs for last 100 blocks from WETH/USDC pool
        let from_block = current_block - 100;
        let filter = serde_json::json!({
            "fromBlock": format!("0x{:x}", from_block),
            "toBlock": format!("0x{:x}", current_block),
            "topics": ["0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"],
            "address": ["0xd0b53d9277642d899df5c87a3966a349a798f224"],
        });
        let body = serde_json::json!({
            "jsonrpc": "2.0", "method": "eth_getLogs", "params": [filter], "id": 2
        });
        let resp = client.post(rr.next()).json(&body).send().await.unwrap();
        let json: serde_json::Value = resp.json().await.unwrap();
        let logs = json["result"].as_array().unwrap();

        println!("Fetched {} swap events from blocks {}-{}", logs.len(), from_block, current_block);
        assert!(logs.len() > 0, "WETH/USDC pool should have swaps in last 100 blocks");

        // Verify log structure
        let log = &logs[0];
        let topics = log["topics"].as_array().unwrap();
        assert_eq!(topics.len(), 3, "Swap event should have 3 topics");
        assert_eq!(
            topics[0].as_str().unwrap(),
            "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
        );

        // Decode data
        let data_hex = log["data"].as_str().unwrap().trim_start_matches("0x");
        let data_bytes = hex::decode(data_hex).unwrap();
        assert!(data_bytes.len() >= 160, "Swap event data should be >= 160 bytes");

        let amount0 = decode_int256(&data_bytes[0..32]);
        let amount1 = decode_int256(&data_bytes[32..64]);
        println!("First swap: amount0={}, amount1={}", amount0, amount1);
        // One should be positive, other negative (swap in/out)
        assert!(amount0 != 0 || amount1 != 0, "Amounts should be non-zero");
    }
}
