use std::sync::Arc;
use alloy::primitives::{Address, U256, U160};
use alloy::providers::Provider;
use alloy::sol;
use crate::chains;
use crate::types::QuoteResult;
use crate::config::ChainConfig;

sol! {
    #[sol(rpc)]
    interface IQuoterV2 {
        function quoteExactInputSingle(
            address tokenIn,
            address tokenOut,
            uint24 fee,
            uint256 amountIn,
            uint160 sqrtPriceLimitX96
        ) external returns (uint256 amountOut);
    }

    #[sol(rpc)]
    interface IERC20 {
        function decimals() external view returns (uint8);
        function symbol() external view returns (string);
        function balanceOf(address account) external view returns (uint256);
        function allowance(address owner, address spender) external view returns (uint256);
    }
}

pub async fn get_quote(
    provider: Arc<chains::Provider>,
    config: &ChainConfig,
    token_in: &str,
    token_out: &str,
    amount_in: &str,
    fee: u32,
) -> eyre::Result<QuoteResult> {
    let token_in_addr: Address = token_in.parse()?;
    let token_out_addr: Address = token_out.parse()?;
    let quoter_addr: Address = config.quoter.parse()?;

    // Get decimals for input token
    let erc20_in = IERC20::new(token_in_addr, &*provider);
    let decimals: u8 = erc20_in.decimals().call().await?;

    // Parse amount with proper decimals
    let amount: U256 = parse_amount(amount_in, decimals)?;

    let quoter = IQuoterV2::new(quoter_addr, &*provider);

    // Use staticcall simulation
    let result = quoter
        .quoteExactInputSingle(token_in_addr, token_out_addr, fee.try_into().unwrap(), amount, U160::ZERO)
        .call()
        .await;

    match result {
        Ok(out) => {
            let erc20_out = IERC20::new(token_out_addr, &*provider);
            let out_decimals: u8 = erc20_out.decimals().call().await?;
            let amount_out_f = format_amount(&out, out_decimals);

            Ok(QuoteResult {
                chain: config.chain_id,
                token_in: token_in.to_string(),
                token_out: token_out.to_string(),
                amount_in: amount_in.to_string(),
                amount_out: amount_out_f,
                price_impact: 0.0,
                gas_estimate: "150000".to_string(),
            })
        }
        Err(e) => {
            Err(eyre::eyre!("Quote failed: {}", e))
        }
    }
}

pub async fn get_balance(
    provider: Arc<chains::Provider>,
    token_address: &str,
    wallet_address: &str,
) -> eyre::Result<(String, u8)> {
    let token_addr: Address = token_address.parse()?;
    let wallet_addr: Address = wallet_address.parse()?;
    let erc20 = IERC20::new(token_addr, &*provider);

    let balance: U256 = erc20.balanceOf(wallet_addr).call().await?;
    let decimals: u8 = erc20.decimals().call().await?;

    Ok((format_amount(&balance, decimals), decimals))
}

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
    let value = U256::from_str_radix(&combined, 10)?;
    Ok(value)
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
