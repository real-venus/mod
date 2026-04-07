use anyhow::{anyhow, Result};
use alloy_primitives::{Address, U256, keccak256};
use k256::ecdsa::SigningKey;
use std::str::FromStr;
use uuid::Uuid;

use crate::types::{OrderData, Side, SignatureType, SignedOrder};

// ─── CTF Exchange EIP-712 Order Signing ───

const CTF_EXCHANGE: &str = "0x4bfb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_CTF_EXCHANGE: &str = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

fn exchange_domain_separator(neg_risk: bool) -> alloy_primitives::B256 {
    let type_hash = keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    let name_hash = keccak256(b"Polymarket CTF Exchange");
    let version_hash = keccak256(b"1");
    let chain_id = U256::from(137u64);
    let exchange = if neg_risk { NEG_RISK_CTF_EXCHANGE } else { CTF_EXCHANGE };
    let contract = Address::from_str(exchange).unwrap();

    let mut encoded = Vec::with_capacity(160);
    encoded.extend_from_slice(type_hash.as_slice());
    encoded.extend_from_slice(name_hash.as_slice());
    encoded.extend_from_slice(version_hash.as_slice());
    encoded.extend_from_slice(&chain_id.to_be_bytes::<32>());
    encoded.extend_from_slice(&contract.into_word().0);

    keccak256(&encoded)
}

const ORDER_TYPE_HASH: [u8; 32] = {
    // precomputed keccak256 of the Order type string
    // We'll compute it at runtime instead
    [0u8; 32]
};

fn order_type_hash() -> alloy_primitives::B256 {
    keccak256(
        b"Order(uint256 salt,address maker,address signer,address taker,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 side,uint8 signatureType)"
    )
}

fn order_struct_hash(order: &OrderData) -> Result<alloy_primitives::B256> {
    let th = order_type_hash();

    let salt = U256::from_str(&order.salt)
        .map_err(|e| anyhow!("invalid salt: {}", e))?;
    let maker = Address::from_str(&order.maker)
        .map_err(|e| anyhow!("invalid maker: {}", e))?;
    let signer = Address::from_str(&order.signer)
        .map_err(|e| anyhow!("invalid signer: {}", e))?;
    let taker = Address::from_str(&order.taker)
        .map_err(|e| anyhow!("invalid taker: {}", e))?;
    let token_id = U256::from_str(&order.token_id)
        .map_err(|e| anyhow!("invalid token_id: {}", e))?;
    let maker_amount = U256::from_str(&order.maker_amount)
        .map_err(|e| anyhow!("invalid maker_amount: {}", e))?;
    let taker_amount = U256::from_str(&order.taker_amount)
        .map_err(|e| anyhow!("invalid taker_amount: {}", e))?;
    let expiration = U256::from_str(&order.expiration)
        .map_err(|e| anyhow!("invalid expiration: {}", e))?;
    let nonce = U256::from_str(&order.nonce)
        .map_err(|e| anyhow!("invalid nonce: {}", e))?;
    let fee_rate = U256::from_str(&order.fee_rate_bps)
        .map_err(|e| anyhow!("invalid fee_rate_bps: {}", e))?;
    let side = U256::from(order.side.as_u8());
    let sig_type = U256::from(order.signature_type as u8);

    let mut encoded = Vec::with_capacity(416);
    encoded.extend_from_slice(th.as_slice());
    encoded.extend_from_slice(&salt.to_be_bytes::<32>());
    encoded.extend_from_slice(&maker.into_word().0);
    encoded.extend_from_slice(&signer.into_word().0);
    encoded.extend_from_slice(&taker.into_word().0);
    encoded.extend_from_slice(&token_id.to_be_bytes::<32>());
    encoded.extend_from_slice(&maker_amount.to_be_bytes::<32>());
    encoded.extend_from_slice(&taker_amount.to_be_bytes::<32>());
    encoded.extend_from_slice(&expiration.to_be_bytes::<32>());
    encoded.extend_from_slice(&nonce.to_be_bytes::<32>());
    encoded.extend_from_slice(&fee_rate.to_be_bytes::<32>());
    encoded.extend_from_slice(&side.to_be_bytes::<32>());
    encoded.extend_from_slice(&sig_type.to_be_bytes::<32>());

    Ok(keccak256(&encoded))
}

/// Sign an order with EIP-712 for the CTF Exchange
pub fn sign_order(
    key: &SigningKey,
    order: &OrderData,
    neg_risk: bool,
) -> Result<String> {
    let domain_sep = exchange_domain_separator(neg_risk);
    let s_hash = order_struct_hash(order)?;

    let mut msg = Vec::with_capacity(66);
    msg.extend_from_slice(b"\x19\x01");
    msg.extend_from_slice(domain_sep.as_slice());
    msg.extend_from_slice(s_hash.as_slice());

    let digest = keccak256(&msg);

    let (sig, recid) = key
        .sign_prehash_recoverable(digest.as_slice())
        .map_err(|e| anyhow!("signing failed: {}", e))?;

    let mut sig_bytes = [0u8; 65];
    sig_bytes[..64].copy_from_slice(&sig.to_bytes());
    sig_bytes[64] = recid.to_byte() + 27;

    Ok(format!("0x{}", hex::encode(sig_bytes)))
}

/// Generate a random salt for order uniqueness
pub fn generate_salt() -> String {
    let uuid = Uuid::new_v4();
    let bytes = uuid.as_bytes();
    let hash = keccak256(bytes);
    U256::from_be_slice(hash.as_slice()).to_string()
}

/// Build a complete order from trading parameters
pub fn build_order(
    maker: &str,
    signer: &str,
    token_id: &str,
    price: f64,
    size: f64,
    side: Side,
    fee_rate_bps: u64,
    nonce: u64,
    expiration: u64,
    sig_type: SignatureType,
) -> OrderData {
    // price is in [0, 1], size is number of shares
    // BUY:  maker pays USDC (makerAmount), receives shares (takerAmount)
    // SELL: maker sends shares (makerAmount), receives USDC (takerAmount)
    let (maker_amount, taker_amount) = match side {
        Side::Buy => {
            let cost = (price * size * 1e6) as u128; // USDC has 6 decimals
            let shares = (size * 1e6) as u128;
            (cost.to_string(), shares.to_string())
        }
        Side::Sell => {
            let shares = (size * 1e6) as u128;
            let proceeds = (price * size * 1e6) as u128;
            (shares.to_string(), proceeds.to_string())
        }
    };

    OrderData {
        salt: generate_salt(),
        maker: maker.to_string(),
        signer: signer.to_string(),
        taker: "0x0000000000000000000000000000000000000000".to_string(),
        token_id: token_id.to_string(),
        maker_amount,
        taker_amount,
        expiration: expiration.to_string(),
        nonce: nonce.to_string(),
        fee_rate_bps: fee_rate_bps.to_string(),
        side,
        signature_type: sig_type,
    }
}

/// Create and sign an order in one step
pub fn create_signed_order(
    key: &SigningKey,
    address: &str,
    token_id: &str,
    price: f64,
    size: f64,
    side: Side,
    neg_risk: bool,
    fee_rate_bps: u64,
    expiration: u64,
    sig_type: SignatureType,
) -> Result<SignedOrder> {
    let order = build_order(
        address, address, token_id, price, size, side,
        fee_rate_bps, 0, expiration, sig_type,
    );
    let signature = sign_order(key, &order, neg_risk)?;
    Ok(SignedOrder { order, signature })
}
