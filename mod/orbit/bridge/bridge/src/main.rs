use serde::{ Serialize, Deserialize };
use subxt::{ OnlineClient, SubstrateConfig, utils::AccountId32 };
use anyhow::Result;
use std::collections::HashMap;
use clap::{ Parser, Subcommand };

#[derive(Parser)]
#[command(version, about, long_about = None)]
#[command(propagate_version = true)]
struct CliArgs {
    #[command(subcommand)]
    command: CliCommands,

    /// Shows report that includes some interesting info
    #[arg(short = 'r', long)]
    show_report: bool,
}

#[derive(Subcommand)]
enum CliCommands {
    /// Takes a snapshot of the commune chain and aggregates system
    /// account balances with the stake belonging to those accounts.
    Snap,
}

use crate::chain::runtime_types::{
    frame_system::AccountInfo as ChainAccountInfo,
    pallet_balances::types::AccountData as ChainAccountData,
};

#[subxt::subxt(runtime_metadata_path = "./metadata.commune.scale")]
pub mod chain {}

#[derive(Serialize, Deserialize, Debug)]
pub struct AccountData {
    pub free: u64,
    pub reserved: u64,
    pub frozen: u64,
    pub flags: u128,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Account {
    pub nonce: u32,
    pub consumers: u32,
    pub providers: u32,
    pub sufficients: u32,
    pub data: AccountData,
}

impl From<ChainAccountInfo<u32, ChainAccountData<u64>>> for Account {
    fn from(value: ChainAccountInfo<u32, ChainAccountData<u64>>) -> Self {
        Self {
            nonce: value.nonce,
            consumers: value.consumers,
            providers: value.providers,
            sufficients: value.sufficients,
            data: AccountData {
                free: value.data.free,
                reserved: value.data.reserved,
                frozen: value.data.frozen,
                flags: value.data.flags.0,
            },
        }
    }
}

pub async fn iter(api: &OnlineClient<SubstrateConfig>) -> Result<Vec<(String, Account)>> {
    let mut accounts: Vec<(String, Account)> = Vec::new();
    let storage_query = subxt::dynamic::storage("System", "Account", vec![]);
    let mut results = api.storage().at_latest().await?.iter(storage_query).await?;

    let mut idx = 0;

    while let Some(Ok(kv)) = results.next().await {
        let mut address = String::new();
        let key = kv.keys.as_slice()[0].clone();
        let key_value = key.value;
        if let scale_value::ValueDef::Composite(key_value_values) = &key_value {
            if let scale_value::Composite::Unnamed(unnamed_composite) = key_value_values {
                let first_value = unnamed_composite.first().unwrap();
                if let scale_value::ValueDef::Composite(first_vv) = &first_value.value {
                    if let scale_value::Composite::Unnamed(finally) = first_vv {
                        let kb = finally
                            .iter()
                            .map(|v| v.as_u128().unwrap_or(0) as u8)
                            .collect::<Vec<u8>>();
                        // Ensure kb has at least 32 bytes before slicing
                        if kb.len() >= 32 {
                            // Copy the first 32 bytes into a fixed-size array
                            let mut kb_fixed = [0u8; 32];
                            kb_fixed.copy_from_slice(&kb[0..32]);
                            address = AccountId32::from(kb_fixed).to_string();
                        } else {
                            println!("kb length is less than 32 bytes, cannot create AccountId32");
                        }
                    }
                }
            }
        }

        let raw_account: ChainAccountInfo<u32, ChainAccountData<u64>> = kv.value.as_type()?;
        let account: Account = raw_account.into();
        idx += 1;
        println!("#{}:\t{}\tfree: {}", idx, &address, &account.data.free);
        accounts.push((address, account));
    }
    Ok(accounts)
}

pub async fn stake_to(api: &OnlineClient<SubstrateConfig>) -> Result<Vec<(String, String, u128)>> {
    let mut stake_to: Vec<(String, String, u128)> = Vec::new();
    let storage_query = subxt::dynamic::storage("SubspaceModule", "StakeTo", vec![]);
    let mut results = api.storage().at_latest().await?.iter(storage_query).await?;

    let mut idx = 0;

    while let Some(Ok(kv)) = results.next().await {
        let raw_key_from = kv.keys.as_slice()[0].clone();
        let mut key_from = String::new();

        if
            let scale_value::ValueDef::Composite(scale_value::Composite::Unnamed(rkf_map)) =
                raw_key_from.value
        {
            let address_map = rkf_map.first().unwrap();
            if
                let scale_value::ValueDef::Composite(
                    scale_value::Composite::Unnamed(address_map_inner),
                ) = &address_map.value
            {
                let address_bytes = address_map_inner
                    .iter()
                    .map(|v| v.as_u128().unwrap_or(0) as u8)
                    .collect::<Vec<u8>>();
                if address_bytes.len() >= 32 {
                    let mut address_bytes_fixed = [0u8; 32];
                    address_bytes_fixed.copy_from_slice(&address_bytes[0..32]);
                    key_from = AccountId32::from(address_bytes_fixed).to_string();
                } else {
                    println!("Address length is less than 32 bytes, cannot create AccountId32");
                }
            }
        }

        let raw_key_to = kv.keys.as_slice()[1].clone();
        let mut key_to = String::new();

        if
            let scale_value::ValueDef::Composite(scale_value::Composite::Unnamed(rkt_map)) =
                raw_key_to.value
        {
            let address_map = rkt_map.first().unwrap();
            if
                let scale_value::ValueDef::Composite(
                    scale_value::Composite::Unnamed(address_map_inner),
                ) = &address_map.value
            {
                let address_bytes = address_map_inner
                    .iter()
                    .map(|v| v.as_u128().unwrap_or(0) as u8)
                    .collect::<Vec<u8>>();
                if address_bytes.len() >= 32 {
                    let mut address_bytes_fixed = [0u8; 32];
                    address_bytes_fixed.copy_from_slice(&address_bytes[0..32]);
                    key_to = AccountId32::from(address_bytes_fixed).to_string();
                } else {
                    println!("Address length is less than 32 bytes, cannot create AccountId32");
                }
            }
        }

        let mut staked: u128 = 0;
        if let Ok(v) = kv.value.to_value() {
            if let Some(s) = v.as_u128() {
                staked = s;
            }
        }

        println!("#{}:", idx);
        println!("\tF:\t{}", key_from);
        println!("\tT:\t{}", key_to);
        println!("\tS:\t{}", staked);

        idx += 1;
        stake_to.push((key_from, key_to, staked));
    }

    Ok(stake_to)
}

async fn fetch_accounts(api: &OnlineClient<SubstrateConfig>) -> Result<()> {
    let accounts = iter(&api).await?;

    // Save the accounts Vec<Account> to a JSON file called "accounts.json"
    let json = serde_json::to_string_pretty(&accounts)?;
    tokio::fs::write("accounts.json", json).await?;

    Ok(())
}

async fn fetch_stake(api: &OnlineClient<SubstrateConfig>) -> Result<()> {
    let stake = stake_to(&api).await?;

    let json = serde_json::to_string_pretty(&stake)?;
    tokio::fs::write("stake.json", json).await?;

    Ok(())
}

async fn parse_accounts() -> Result<Vec<(String, Account)>> {
    let accounts_data = tokio::fs::read_to_string("accounts.json").await?;
    let accounts_json: serde_json::Value = serde_json::from_str(&accounts_data)?;
    // Convert accounts_json (serde_json::Value) into Vec<(String, Account)>
    let accounts_vec: Vec<(String, Account)> = accounts_json
        .as_array()
        .expect("accounts_json should be an array")
        .iter()
        .map(|item| {
            let arr = item.as_array().expect("each item should be an array");
            let address = arr[0].as_str().expect("first item is address string").to_string();
            let account_obj = &arr[1];
            let account: Account = serde_json
                ::from_value(account_obj.clone())
                .expect("should parse to Account");
            (address, account)
        })
        .collect();

    Ok(accounts_vec)
}

async fn parse_stake() -> Result<Vec<(String, String, u128)>> {
    let stake_data = tokio::fs::read_to_string("stake.json").await?;
    let stake_json: serde_json::Value = serde_json::from_str(&stake_data)?;
    let stake_vec: Vec<(String, String, u128)> = stake_json
        .as_array()
        .expect("stake_json should be an array")
        .iter()
        .map(|item| {
            let arr = item.as_array().expect("each item should be an array");
            let from = arr[0].as_str().expect("first item is string").to_string();
            let to = arr[1].as_str().expect("second item is string").to_string();
            let staked = arr[2]
                .as_u64()
                .map(|v| v as u128)
                .expect("third item should be u128-compatible");
            (from, to, staked)
        })
        .collect();

    Ok(stake_vec)
}

async fn map_balances(
    accounts: Vec<(String, Account)>,
    stake: Vec<(String, String, u128)>
) -> HashMap<String, u128> {
    let mut balance_sum_map: HashMap<String, u128> = HashMap::new();

    for (from, _to, staked) in &stake {
        let entry = balance_sum_map.entry(from.clone()).or_insert(0u128);
        *entry += staked;
    }
    println!("{} final stake entries compared to {}", balance_sum_map.len(), stake.len());

    for (address, account) in &accounts {
        let entry = balance_sum_map.entry(address.clone()).or_insert(0u128);
        *entry += account.data.free as u128;
        *entry += account.data.reserved as u128;
        *entry += account.data.frozen as u128;
    }
    println!("{} final balance entries compared to {}", balance_sum_map.len(), accounts.len());

    balance_sum_map
}

async fn save_balances(balances: HashMap<String, u128>) -> Result<()> {
    let json = serde_json::to_string_pretty(&balances)?;
    tokio::fs::write("total_balances.json", json).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli_args = CliArgs::parse();
    let api = OnlineClient::<SubstrateConfig>::from_url(
        "wss://commune-archive-node-0.communeai.net"
    ).await?;

    match cli_args.command {
        CliCommands::Snap => {
            fetch_accounts(&api).await?;
            fetch_stake(&api).await?;
            let accounts = parse_accounts().await?;
            let stake = parse_stake().await?;
            let balances = map_balances(accounts, stake).await;
            save_balances(balances.clone()).await?;

            if cli_args.show_report {
                let total_issuance = balances
                    .iter()
                    .map(|(_, &b)| b)
                    .reduce(|a, b| a + b)
                    .unwrap();
                println!("Total Issuance: {}", bal(total_issuance));

                const EXISTENTIAL_DEPOSIT: u128 = 500;
                let mut nonexistent_accounts: Vec<(String, u128)> = Vec::new();
                for (account, total_balance) in &balances {
                    if *total_balance < EXISTENTIAL_DEPOSIT {
                        nonexistent_accounts.push((account.clone(), total_balance.clone()));
                    }
                }
                let nonexistent_total = nonexistent_accounts
                    .iter()
                    .map(|a| a.1)
                    .reduce(|acc, b| acc + b)
                    .unwrap();

                println!(
                    "{} nonexistent accounts totalling {}",
                    nonexistent_accounts.len(),
                    bal(nonexistent_total)
                );

                // Convert the balances into a vector of tuples and sort descending by value
                let mut sorted_balances: Vec<(&String, &u128)> = balances.iter().collect();
                sorted_balances.sort_by(|a, b| b.1.cmp(a.1));

                // Optional: print top 10 balances
                println!("Top 10 highest total balances:");
                for (address, total_balance) in sorted_balances.iter().take(10) {
                    println!(
                        "{}: {} ({:.4}%)",
                        address,
                        bal(**total_balance),
                        (bal(**total_balance) / bal(total_issuance)) * 100.0
                    );
                }
                Ok(())
            } else {
                Ok(())
            }
        }
    }
}

fn bal(balance: u128) -> f64 {
    (balance as f64) / 1_000_000_000f64
}
