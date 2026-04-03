use std::collections::HashMap;
use chrono::{Utc, Duration};

use crate::types::{WalletTrade, WalletPerformance, TokenSummary};

/// Calculate 30-day performance for a wallet from its trade history
pub fn calculate_performance(wallet: &str, trades: &[WalletTrade]) -> WalletPerformance {
    let cutoff = Utc::now() - Duration::days(30);
    let recent_trades: Vec<&WalletTrade> = trades.iter()
        .filter(|t| t.timestamp >= cutoff)
        .collect();

    if recent_trades.is_empty() {
        return WalletPerformance {
            wallet: wallet.to_string(),
            total_trades: 0,
            tokens_bought: vec![],
            tokens_sold: vec![],
            most_traded: vec![],
            avg_trade_size_usd: 0.0,
            total_volume_usd: 0.0,
            first_trade: None,
            last_trade: None,
            active_days: 0,
            trades_per_day: 0.0,
        };
    }

    // Track tokens bought and sold
    let mut bought: HashMap<String, (String, u128, u32)> = HashMap::new(); // symbol -> (address, total_amount, count)
    let mut sold: HashMap<String, (String, u128, u32)> = HashMap::new();
    let mut token_frequency: HashMap<String, u32> = HashMap::new();
    let mut unique_days: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Track volume via stablecoin amounts
    let stablecoins = ["USDC", "USDT", "DAI"];
    let mut total_volume_usd: f64 = 0.0;

    for trade in &recent_trades {
        // Track what was bought (token_out = what user receives)
        let entry = bought.entry(trade.token_out_symbol.clone())
            .or_insert((trade.token_out.clone(), 0, 0));
        entry.1 += trade.amount_out.parse::<u128>().unwrap_or(0);
        entry.2 += 1;

        // Track what was sold (token_in = what user sends)
        let entry = sold.entry(trade.token_in_symbol.clone())
            .or_insert((trade.token_in.clone(), 0, 0));
        entry.1 += trade.amount_in.parse::<u128>().unwrap_or(0);
        entry.2 += 1;

        // Track frequency
        *token_frequency.entry(trade.token_in_symbol.clone()).or_insert(0) += 1;
        *token_frequency.entry(trade.token_out_symbol.clone()).or_insert(0) += 1;

        // Track unique trading days
        unique_days.insert(trade.timestamp.format("%Y-%m-%d").to_string());

        // Estimate USD volume from stablecoin side
        if stablecoins.contains(&trade.token_in_symbol.as_str()) {
            let decimals = get_stablecoin_decimals(&trade.token_in_symbol);
            let amount = trade.amount_in.parse::<f64>().unwrap_or(0.0) / 10f64.powi(decimals);
            total_volume_usd += amount;
        } else if stablecoins.contains(&trade.token_out_symbol.as_str()) {
            let decimals = get_stablecoin_decimals(&trade.token_out_symbol);
            let amount = trade.amount_out.parse::<f64>().unwrap_or(0.0) / 10f64.powi(decimals);
            total_volume_usd += amount;
        }
    }

    // Sort by frequency for most_traded
    let mut freq_vec: Vec<(String, u32)> = token_frequency.into_iter().collect();
    freq_vec.sort_by(|a, b| b.1.cmp(&a.1));
    let most_traded: Vec<String> = freq_vec.into_iter()
        .take(5)
        .map(|(sym, _)| sym)
        .collect();

    let tokens_bought: Vec<TokenSummary> = bought.into_iter().map(|(sym, (addr, amt, count))| {
        TokenSummary {
            symbol: sym,
            address: addr,
            total_amount: amt.to_string(),
            trade_count: count,
        }
    }).collect();

    let tokens_sold: Vec<TokenSummary> = sold.into_iter().map(|(sym, (addr, amt, count))| {
        TokenSummary {
            symbol: sym,
            address: addr,
            total_amount: amt.to_string(),
            trade_count: count,
        }
    }).collect();

    let total_trades = recent_trades.len() as u32;
    let active_days = unique_days.len() as u32;
    let trades_per_day = if active_days > 0 {
        total_trades as f64 / active_days as f64
    } else {
        0.0
    };

    let avg_trade_size_usd = if total_trades > 0 && total_volume_usd > 0.0 {
        total_volume_usd / total_trades as f64
    } else {
        0.0
    };

    let first_trade = recent_trades.iter().map(|t| t.timestamp).min();
    let last_trade = recent_trades.iter().map(|t| t.timestamp).max();

    WalletPerformance {
        wallet: wallet.to_string(),
        total_trades,
        tokens_bought,
        tokens_sold,
        most_traded,
        avg_trade_size_usd,
        total_volume_usd,
        first_trade,
        last_trade,
        active_days,
        trades_per_day,
    }
}

fn get_stablecoin_decimals(symbol: &str) -> i32 {
    match symbol {
        "USDC" | "USDT" => 6,
        "DAI" => 18,
        _ => 18,
    }
}
