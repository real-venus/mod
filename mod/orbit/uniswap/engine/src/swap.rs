use std::sync::Arc;
use alloy::primitives::{Address, U256, U160};
use alloy::providers::Provider;
use alloy::sol;
use crate::chains;
use crate::config::ChainConfig;

sol! {
    #[sol(rpc)]
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

    #[sol(rpc)]
    interface IERC20 {
        function approve(address spender, uint256 amount) external returns (bool);
        function allowance(address owner, address spender) external view returns (uint256);
        function decimals() external view returns (uint8);
    }
}

/// Build swap calldata for client-side signing (the frontend signs, not the server)
pub fn build_swap_calldata(
    config: &ChainConfig,
    token_in: &str,
    token_out: &str,
    amount_in: U256,
    amount_out_min: U256,
    recipient: &str,
    fee: u32,
) -> eyre::Result<SwapCalldata> {
    let token_in_addr: Address = token_in.parse()?;
    let token_out_addr: Address = token_out.parse()?;
    let recipient_addr: Address = recipient.parse()?;

    let params = ISwapRouter::ExactInputSingleParams {
        tokenIn: token_in_addr,
        tokenOut: token_out_addr,
        fee: fee.try_into().unwrap(),
        recipient: recipient_addr,
        amountIn: amount_in,
        amountOutMinimum: amount_out_min,
        sqrtPriceLimitX96: U160::ZERO,
    };

    let call = ISwapRouter::exactInputSingleCall { params };
    let calldata = alloy::sol_types::SolCall::abi_encode(&call);

    Ok(SwapCalldata {
        to: config.router.clone(),
        data: format!("0x{}", hex::encode(&calldata)),
        value: "0".to_string(),
    })
}

/// Build approval calldata
pub fn build_approve_calldata(
    token_address: &str,
    spender: &str,
) -> eyre::Result<SwapCalldata> {
    let spender_addr: Address = spender.parse()?;

    let call = IERC20::approveCall {
        spender: spender_addr,
        amount: U256::MAX,
    };
    let calldata = alloy::sol_types::SolCall::abi_encode(&call);

    Ok(SwapCalldata {
        to: token_address.to_string(),
        data: format!("0x{}", hex::encode(&calldata)),
        value: "0".to_string(),
    })
}

/// Check if approval is needed
pub async fn check_allowance(
    provider: Arc<chains::Provider>,
    token_address: &str,
    owner: &str,
    spender: &str,
    required_amount: U256,
) -> eyre::Result<bool> {
    let token_addr: Address = token_address.parse()?;
    let owner_addr: Address = owner.parse()?;
    let spender_addr: Address = spender.parse()?;

    let erc20 = IERC20::new(token_addr, &*provider);
    let allowance: U256 = erc20.allowance(owner_addr, spender_addr).call().await?;

    Ok(allowance >= required_amount)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SwapCalldata {
    pub to: String,
    pub data: String,
    pub value: String,
}
