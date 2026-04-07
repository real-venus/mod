use anyhow::{anyhow, Result};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use alloy_primitives::{Address, B256, U256, keccak256};
use alloy_sol_types::{SolStruct, sol};
use k256::ecdsa::SigningKey;
use reqwest::header::HeaderMap;
use std::str::FromStr;

use crate::types::ApiCreds;

type HmacSha256 = Hmac<Sha256>;

// ─── EIP-712 Domain for Polymarket Auth ───

sol! {
    #[derive(Debug)]
    struct ClobAuth {
        string message;
        address address_;
        uint256 timestamp;
        uint256 nonce;
    }
}

const CLOB_DOMAIN_NAME: &str = "ClobAuthDomain";
const CLOB_DOMAIN_VERSION: &str = "1";
const POLYGON_CHAIN_ID: u64 = 137;

// ─── EIP-712 Domain Separator ───

fn domain_separator() -> B256 {
    let type_hash = keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId)"
    );
    let name_hash = keccak256(CLOB_DOMAIN_NAME.as_bytes());
    let version_hash = keccak256(CLOB_DOMAIN_VERSION.as_bytes());

    let mut encoded = Vec::with_capacity(128);
    encoded.extend_from_slice(type_hash.as_slice());
    encoded.extend_from_slice(name_hash.as_slice());
    encoded.extend_from_slice(version_hash.as_slice());
    encoded.extend_from_slice(&U256::from(POLYGON_CHAIN_ID).to_be_bytes::<32>());

    keccak256(&encoded)
}

fn struct_hash(address: &str, timestamp: u64, nonce: u64) -> Result<B256> {
    let type_hash = keccak256(
        b"ClobAuth(string message,address address,uint256 timestamp,uint256 nonce)"
    );
    let message_hash = keccak256(
        b"This message attests that I control the given wallet"
    );
    let addr = Address::from_str(address)
        .map_err(|e| anyhow!("invalid address: {}", e))?;

    let mut encoded = Vec::with_capacity(160);
    encoded.extend_from_slice(type_hash.as_slice());
    encoded.extend_from_slice(message_hash.as_slice());
    encoded.extend_from_slice(&addr.into_word().0);
    encoded.extend_from_slice(&U256::from(timestamp).to_be_bytes::<32>());
    encoded.extend_from_slice(&U256::from(nonce).to_be_bytes::<32>());

    Ok(keccak256(&encoded))
}

/// Sign EIP-712 typed data for L1 authentication
pub fn sign_l1_auth(
    private_key: &SigningKey,
    address: &str,
    timestamp: u64,
    nonce: u64,
) -> Result<String> {
    let domain_sep = domain_separator();
    let s_hash = struct_hash(address, timestamp, nonce)?;

    let mut msg = Vec::with_capacity(66);
    msg.extend_from_slice(b"\x19\x01");
    msg.extend_from_slice(domain_sep.as_slice());
    msg.extend_from_slice(s_hash.as_slice());

    let digest = keccak256(&msg);

    let (sig, recid) = private_key
        .sign_prehash_recoverable(digest.as_slice())
        .map_err(|e| anyhow!("signing failed: {}", e))?;

    let mut sig_bytes = [0u8; 65];
    sig_bytes[..64].copy_from_slice(&sig.to_bytes());
    sig_bytes[64] = recid.to_byte() + 27;

    Ok(format!("0x{}", hex::encode(sig_bytes)))
}

/// Build L1 auth headers for key derivation
pub fn l1_headers(
    private_key: &SigningKey,
    address: &str,
) -> Result<HeaderMap> {
    let timestamp = chrono::Utc::now().timestamp() as u64;
    let nonce: u64 = 0;
    let signature = sign_l1_auth(private_key, address, timestamp, nonce)?;

    let mut headers = HeaderMap::new();
    headers.insert("POLY_ADDRESS", address.parse()?);
    headers.insert("POLY_SIGNATURE", signature.parse()?);
    headers.insert("POLY_TIMESTAMP", timestamp.to_string().parse()?);
    headers.insert("POLY_NONCE", nonce.to_string().parse()?);

    Ok(headers)
}

// ─── L2 HMAC Authentication ───

/// Build HMAC-SHA256 signature for L2 API requests
pub fn build_hmac_signature(
    secret: &str,
    timestamp: &str,
    method: &str,
    path: &str,
    body: &str,
) -> Result<String> {
    let message = format!("{}{}{}{}", timestamp, method.to_uppercase(), path, body);

    let secret_bytes = BASE64.decode(secret)
        .map_err(|e| anyhow!("invalid secret base64: {}", e))?;

    let mut mac = HmacSha256::new_from_slice(&secret_bytes)
        .map_err(|e| anyhow!("HMAC init failed: {}", e))?;
    mac.update(message.as_bytes());

    let result = mac.finalize();
    Ok(BASE64.encode(result.into_bytes()))
}

/// Build L2 auth headers for authenticated API requests
pub fn l2_headers(
    creds: &ApiCreds,
    address: &str,
    method: &str,
    path: &str,
    body: &str,
) -> Result<HeaderMap> {
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let signature = build_hmac_signature(&creds.secret, &timestamp, method, path, body)?;

    let mut headers = HeaderMap::new();
    headers.insert("POLY_ADDRESS", address.parse()?);
    headers.insert("POLY_API_KEY", creds.api_key.parse()?);
    headers.insert("POLY_PASSPHRASE", creds.passphrase.parse()?);
    headers.insert("POLY_SIGNATURE", signature.parse()?);
    headers.insert("POLY_TIMESTAMP", timestamp.parse()?);

    Ok(headers)
}

// ─── Address from Private Key ───

pub fn address_from_key(key: &SigningKey) -> String {
    use k256::ecdsa::VerifyingKey;

    let verifying_key = VerifyingKey::from(key);
    let pubkey_bytes = verifying_key.to_encoded_point(false);
    let hash = keccak256(&pubkey_bytes.as_bytes()[1..]);
    format!("0x{}", hex::encode(&hash[12..]))
}

pub fn parse_private_key(hex_key: &str) -> Result<SigningKey> {
    let clean = hex_key.strip_prefix("0x").unwrap_or(hex_key);
    let bytes = hex::decode(clean)
        .map_err(|e| anyhow!("invalid hex key: {}", e))?;
    SigningKey::from_bytes(bytes.as_slice().into())
        .map_err(|e| anyhow!("invalid private key: {}", e))
}
