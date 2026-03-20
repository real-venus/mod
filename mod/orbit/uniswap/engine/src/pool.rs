use std::sync::Arc;
use alloy::primitives::Address;
use alloy::providers::Provider;
use alloy::sol;
use crate::chains;
use crate::types::{ChainId, PoolState};

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

pub async fn get_pool_state(
    provider: Arc<chains::Provider>,
    pool_address: &str,
    chain: ChainId,
) -> eyre::Result<PoolState> {
    let addr: Address = pool_address.parse()?;
    let pool = IUniswapV3Pool::new(addr, &*provider);

    let slot0 = pool.slot0().call().await?;
    let liquidity = pool.liquidity().call().await?;

    let sqrt_price = slot0.sqrtPriceX96;

    // price = (sqrtPriceX96 / 2^96)^2
    let sqrt_f = sqrt_price.to::<u128>() as f64 / (2_u128.pow(96) as f64);
    let price = sqrt_f * sqrt_f;

    let timestamp = chrono::Utc::now().timestamp();

    Ok(PoolState {
        address: pool_address.to_string(),
        chain,
        sqrt_price_x96: sqrt_price.to_string(),
        tick: slot0.tick.as_i32(),
        liquidity: liquidity.to_string(),
        price,
        timestamp,
    })
}

pub async fn get_pool_price(
    provider: Arc<chains::Provider>,
    pool_address: &str,
) -> eyre::Result<f64> {
    let addr: Address = pool_address.parse()?;
    let pool = IUniswapV3Pool::new(addr, &*provider);
    let slot0 = pool.slot0().call().await?;
    let sqrt_f = slot0.sqrtPriceX96.to::<u128>() as f64 / (2_u128.pow(96) as f64);
    Ok(sqrt_f * sqrt_f)
}
