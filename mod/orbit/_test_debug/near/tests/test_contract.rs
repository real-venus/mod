/// Integration tests for the NEAR Token contract using near-workspaces.
/// These spin up a NEAR sandbox and test real contract interactions.
use near_workspaces::{Account, Contract};
use serde_json::json;

const WASM: &[u8] = include_bytes!("../target/near/near_token.wasm");

async fn setup() -> (near_workspaces::Worker<near_workspaces::network::Sandbox>, Contract, Account, Account) {
    let worker = near_workspaces::sandbox().await.unwrap();
    let contract = worker.dev_deploy(WASM).await.unwrap();

    // Initialize the contract
    contract
        .call("new")
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    let alice = worker.dev_create_account().await.unwrap();
    let bob = worker.dev_create_account().await.unwrap();

    (worker, contract, alice, bob)
}

// ── Mint & Balance Tests ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_mint_and_check_balance() {
    let (_worker, contract, _alice, _bob) = setup().await;

    // Mint tokens to a NEAR address
    let result = contract
        .call("mint")
        .args_json(json!({
            "addr_type": "Near",
            "address": contract.id().to_string(),
            "token_type": "MOD",
            "amount": "1000"
        }))
        .transact()
        .await
        .unwrap();
    assert!(result.is_success(), "mint failed: {:?}", result);

    // Check balance
    let balance: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Near",
            "address": contract.id().to_string(),
            "token_type": "MOD"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(balance, "1000");
}

#[tokio::test]
async fn test_balance_of_unknown_account_is_zero() {
    let (_worker, contract, _alice, _bob) = setup().await;

    let balance: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Near",
            "address": "nonexistent.testnet",
            "token_type": "MOD"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(balance, "0");
}

#[tokio::test]
async fn test_mint_multiple_token_types() {
    let (_worker, contract, _alice, _bob) = setup().await;
    let addr = contract.id().to_string();

    // Mint MOD tokens
    contract
        .call("mint")
        .args_json(json!({
            "addr_type": "Near",
            "address": &addr,
            "token_type": "MOD",
            "amount": "500"
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    // Mint USDC tokens
    contract
        .call("mint")
        .args_json(json!({
            "addr_type": "Near",
            "address": &addr,
            "token_type": "USDC",
            "amount": "2000"
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    let mod_bal: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Near",
            "address": &addr,
            "token_type": "MOD"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();

    let usdc_bal: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Near",
            "address": &addr,
            "token_type": "USDC"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();

    assert_eq!(mod_bal, "500");
    assert_eq!(usdc_bal, "2000");
}

#[tokio::test]
async fn test_mint_accumulates() {
    let (_worker, contract, _alice, _bob) = setup().await;
    let addr = contract.id().to_string();

    for _ in 0..3 {
        contract
            .call("mint")
            .args_json(json!({
                "addr_type": "Near",
                "address": &addr,
                "token_type": "MOD",
                "amount": "100"
            }))
            .transact()
            .await
            .unwrap()
            .into_result()
            .unwrap();
    }

    let balance: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Near",
            "address": &addr,
            "token_type": "MOD"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(balance, "300");
}

// ── Access Control Tests ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_only_owner_can_mint() {
    let (_worker, contract, alice, _bob) = setup().await;

    // Alice (not owner) tries to mint — should fail
    let result = alice
        .call(contract.id(), "mint")
        .args_json(json!({
            "addr_type": "Near",
            "address": alice.id().to_string(),
            "token_type": "MOD",
            "amount": "1000"
        }))
        .transact()
        .await
        .unwrap();

    assert!(result.is_failure(), "non-owner mint should fail");
}

// ── Nonce Tests ──────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_nonce_starts_at_zero() {
    let (_worker, contract, _alice, _bob) = setup().await;

    let nonce: u64 = contract
        .view("nonce_of")
        .args_json(json!({
            "addr_type": "Near",
            "address": "anyone.testnet"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(nonce, 0);
}

// ── Ethereum Address Tests ───────────────────────────────────────────────────

#[tokio::test]
async fn test_eth_address_balance() {
    let (_worker, contract, _alice, _bob) = setup().await;
    let eth_addr = "0x742d35cc6634c0532925a3b844bc9e7595f2bd38";

    contract
        .call("mint")
        .args_json(json!({
            "addr_type": "Ethereum",
            "address": eth_addr,
            "token_type": "ETH",
            "amount": "5000"
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    let balance: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Ethereum",
            "address": eth_addr,
            "token_type": "ETH"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(balance, "5000");
}

// ── Solana Address Tests ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_solana_address_balance() {
    let (_worker, contract, _alice, _bob) = setup().await;
    // Valid base58 Solana-style address (32 bytes when decoded)
    let sol_addr = "11111111111111111111111111111111";

    contract
        .call("mint")
        .args_json(json!({
            "addr_type": "Solana",
            "address": sol_addr,
            "token_type": "SOL",
            "amount": "3000"
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    let balance: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Solana",
            "address": sol_addr,
            "token_type": "SOL"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(balance, "3000");
}

// ── Cross-chain Balance Isolation ────────────────────────────────────────────

#[tokio::test]
async fn test_cross_chain_balances_isolated() {
    let (_worker, contract, _alice, _bob) = setup().await;
    let addr = contract.id().to_string();

    // Mint as NEAR address
    contract
        .call("mint")
        .args_json(json!({
            "addr_type": "Near",
            "address": &addr,
            "token_type": "MOD",
            "amount": "100"
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    // Same string but as Ethereum address should have 0 balance
    let balance: String = contract
        .view("balance_of")
        .args_json(json!({
            "addr_type": "Ethereum",
            "address": &addr,
            "token_type": "MOD"
        }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(balance, "0", "cross-chain balances should be isolated");
}

// ── Register NEAR Key Tests ─────────────────────────────────────────────────

#[tokio::test]
async fn test_register_near_key() {
    let (_worker, contract, alice, _bob) = setup().await;

    // Generate a fake 32-byte pubkey hex
    let pubkey_hex = "a]b".repeat(10); // invalid — should fail
    let result = alice
        .call(contract.id(), "register_near_key")
        .args_json(json!({ "pubkey_hex": pubkey_hex }))
        .transact()
        .await
        .unwrap();
    assert!(result.is_failure(), "invalid hex should fail");

    // Valid 32-byte hex pubkey
    let valid_pubkey = "0".repeat(64); // 32 zero bytes
    let result = alice
        .call(contract.id(), "register_near_key")
        .args_json(json!({ "pubkey_hex": valid_pubkey }))
        .transact()
        .await
        .unwrap();
    // This will fail because all-zero is not a valid ed25519 point,
    // but register_near_key doesn't validate — it just stores.
    // So it should succeed at the storage level.
    assert!(result.is_success(), "valid hex pubkey registration should succeed");
}
