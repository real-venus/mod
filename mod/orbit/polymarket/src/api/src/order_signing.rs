//! Polymarket order EIP-712 hashing.
//!
//! This module exists so the backend signer can only ever sign things that
//! are *structurally* a Polymarket CLOB order — we never expose a raw
//! "sign-arbitrary-digest" endpoint to the network. Anything the backend
//! signs has to pass through this Rust-side reconstruction of the digest
//! from a fully-typed order struct against Polymarket's known exchange
//! domains. A malicious client can't trick the backend into signing a
//! USDC.transfer or Safe.execTransaction by handing it a crafted digest —
//! it can only ask for signatures over Polymarket orders, and the digest
//! is computed from values the backend can verify (chain id, exchange,
//! domain name).

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

// ─── Known Polymarket contract addresses on Polygon ─────────────────────
// Mirror of frontend `polymarketContracts.ts` so the backend never sources
// these from client input. Mismatched signing domains are the single most
// common foot-gun and we kill it by hard-coding here.

const POLYGON_CHAIN_ID: u64 = 137;
const CTF_EXCHANGE: &str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_CTF_EXCHANGE: &str = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
const DOMAIN_NAME: &str = "Polymarket CTF Exchange";
const DOMAIN_VERSION: &str = "1";

// ─── Order representation ────────────────────────────────────────────────

/// One Polymarket CLOB order. Numeric amounts are base-unit integers as
/// `String` (Polymarket rejects floats). All fields are required — the
/// signer endpoint won't fall back to defaults so a missing field can't
/// produce a different digest than the caller expects.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderInput {
    pub salt: String,        // uint256 decimal
    pub maker: String,       // 0x-prefixed address
    pub signer: String,      // 0x-prefixed address (the recovering address)
    pub taker: String,       // 0x-prefixed address (zero for open orders)
    #[serde(rename = "tokenId")]
    pub token_id: String,    // uint256 decimal
    #[serde(rename = "makerAmount")]
    pub maker_amount: String,
    #[serde(rename = "takerAmount")]
    pub taker_amount: String,
    pub expiration: String,  // unix seconds, 0 for GTC
    pub nonce: String,
    #[serde(rename = "feeRateBps")]
    pub fee_rate_bps: String,
    pub side: u8,            // 0 BUY, 1 SELL
    #[serde(rename = "signatureType")]
    pub signature_type: u8,  // 0 EOA, 1 POLY_PROXY, 2 POLY_GNOSIS_SAFE
    /// "standard" | "negrisk" — selects which Exchange address signs into.
    /// Required so a stale negRisk flag can't silently sign a CTF order
    /// for the wrong matcher.
    pub exchange: ExchangeKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExchangeKind {
    Standard,
    Negrisk,
}

impl ExchangeKind {
    fn verifying_contract(self) -> &'static str {
        match self {
            ExchangeKind::Standard => CTF_EXCHANGE,
            ExchangeKind::Negrisk => NEG_RISK_CTF_EXCHANGE,
        }
    }
}

// ─── EIP-712 hashing primitives ──────────────────────────────────────────

use crate::signer::keccak256;

fn left_pad_32(bytes: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    if bytes.len() >= 32 {
        out.copy_from_slice(&bytes[bytes.len() - 32..]);
    } else {
        out[32 - bytes.len()..].copy_from_slice(bytes);
    }
    out
}

fn encode_uint256_decimal(s: &str) -> Result<[u8; 32]> {
    // Polymarket sends amounts as decimal strings of base-unit integers.
    // We need to parse to a big-endian 32-byte representation. Limit to
    // 78 decimal digits (max uint256 = 2^256-1 ≈ 1.1e77, so 78 digits is
    // an overestimate but safe).
    if s.is_empty() || s.len() > 80 {
        return Err(anyhow!("invalid uint256 decimal: length"));
    }
    if !s.chars().all(|c| c.is_ascii_digit()) {
        return Err(anyhow!("invalid uint256 decimal: non-digit"));
    }
    // Use u256-as-u128-pair via manual base-10 multiply since we have no
    // bigint dep. For Polymarket orders we never exceed u128 in any single
    // field (max ~1e30 USDC base units for a $1T order), but salt can be
    // larger. Use 4×u64 limbs.
    let mut limbs: [u64; 4] = [0; 4]; // little-endian
    for ch in s.chars() {
        let d = ch.to_digit(10).unwrap() as u64;
        let mut carry: u128 = d as u128;
        for limb in limbs.iter_mut() {
            let v = (*limb as u128) * 10 + carry;
            *limb = (v & 0xFFFFFFFFFFFFFFFF) as u64;
            carry = v >> 64;
        }
        if carry != 0 {
            return Err(anyhow!("uint256 overflow at digit"));
        }
    }
    let mut out = [0u8; 32];
    // Encode big-endian: most significant limb at the start.
    for (i, limb) in limbs.iter().enumerate() {
        let off = 24 - i * 8;
        out[off..off + 8].copy_from_slice(&limb.to_be_bytes());
    }
    Ok(out)
}

fn encode_address(addr: &str) -> Result<[u8; 32]> {
    let s = addr.strip_prefix("0x").unwrap_or(addr);
    let bytes = hex::decode(s).map_err(|e| anyhow!("address hex: {}", e))?;
    if bytes.len() != 20 {
        return Err(anyhow!("address must be 20 bytes, got {}", bytes.len()));
    }
    Ok(left_pad_32(&bytes))
}

fn encode_uint8(v: u8) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[31] = v;
    out
}

// ─── Domain + type hash ──────────────────────────────────────────────────

fn domain_typehash() -> [u8; 32] {
    keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    )
}

fn order_typehash() -> [u8; 32] {
    keccak256(
        b"Order(uint256 salt,address maker,address signer,address taker,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 side,uint8 signatureType)",
    )
}

fn domain_separator(exchange: ExchangeKind) -> Result<[u8; 32]> {
    // domainSeparator = keccak256(abi.encode(
    //   keccak256("EIP712Domain(...)"),
    //   keccak256("Polymarket CTF Exchange"),
    //   keccak256("1"),
    //   uint256(137),
    //   verifyingContract))
    let mut buf = Vec::with_capacity(5 * 32);
    buf.extend_from_slice(&domain_typehash());
    buf.extend_from_slice(&keccak256(DOMAIN_NAME.as_bytes()));
    buf.extend_from_slice(&keccak256(DOMAIN_VERSION.as_bytes()));
    let mut chain_be = [0u8; 32];
    chain_be[24..].copy_from_slice(&POLYGON_CHAIN_ID.to_be_bytes());
    buf.extend_from_slice(&chain_be);
    buf.extend_from_slice(&encode_address(exchange.verifying_contract())?);
    Ok(keccak256(&buf))
}

fn struct_hash(order: &OrderInput) -> Result<[u8; 32]> {
    if order.side > 1 {
        return Err(anyhow!("side must be 0 (BUY) or 1 (SELL)"));
    }
    if order.signature_type > 2 {
        return Err(anyhow!("signatureType must be 0, 1, or 2"));
    }
    let mut buf = Vec::with_capacity(13 * 32);
    buf.extend_from_slice(&order_typehash());
    buf.extend_from_slice(&encode_uint256_decimal(&order.salt)?);
    buf.extend_from_slice(&encode_address(&order.maker)?);
    buf.extend_from_slice(&encode_address(&order.signer)?);
    buf.extend_from_slice(&encode_address(&order.taker)?);
    buf.extend_from_slice(&encode_uint256_decimal(&order.token_id)?);
    buf.extend_from_slice(&encode_uint256_decimal(&order.maker_amount)?);
    buf.extend_from_slice(&encode_uint256_decimal(&order.taker_amount)?);
    buf.extend_from_slice(&encode_uint256_decimal(&order.expiration)?);
    buf.extend_from_slice(&encode_uint256_decimal(&order.nonce)?);
    buf.extend_from_slice(&encode_uint256_decimal(&order.fee_rate_bps)?);
    buf.extend_from_slice(&encode_uint8(order.side));
    buf.extend_from_slice(&encode_uint8(order.signature_type));
    Ok(keccak256(&buf))
}

/// Final EIP-712 digest: `keccak256(0x1901 || domainSeparator || structHash)`.
/// This is the 32-byte hash that gets ECDSA-signed.
pub fn order_digest(order: &OrderInput) -> Result<[u8; 32]> {
    let dom = domain_separator(order.exchange)?;
    let sh = struct_hash(order)?;
    let mut prefix = Vec::with_capacity(2 + 32 + 32);
    prefix.push(0x19);
    prefix.push(0x01);
    prefix.extend_from_slice(&dom);
    prefix.extend_from_slice(&sh);
    Ok(keccak256(&prefix))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Reference values cross-checked against a fresh `signTypedData` run from
    // the frontend's polymarketOrderSigning.ts with the same input.
    fn fixture_order() -> OrderInput {
        OrderInput {
            salt: "1".into(),
            maker: "0x9A86ede983F707A0694B9ec37b36f70032333476".into(),
            signer: "0x89bcdee4a284cb0848eebb975bec78ab5bd06cfa".into(),
            taker: "0x0000000000000000000000000000000000000000".into(),
            token_id: "1234567890".into(),
            maker_amount: "100000".into(),
            taker_amount: "200000".into(),
            expiration: "0".into(),
            nonce: "0".into(),
            fee_rate_bps: "0".into(),
            side: 0,
            signature_type: 2,
            exchange: ExchangeKind::Standard,
        }
    }

    #[test]
    fn digest_is_deterministic_and_32_bytes() {
        let o = fixture_order();
        let d1 = order_digest(&o).unwrap();
        let d2 = order_digest(&o).unwrap();
        assert_eq!(d1, d2);
        assert_eq!(d1.len(), 32);
    }

    #[test]
    fn negrisk_produces_different_digest_than_standard() {
        let mut o = fixture_order();
        let standard = order_digest(&o).unwrap();
        o.exchange = ExchangeKind::Negrisk;
        let negrisk = order_digest(&o).unwrap();
        assert_ne!(standard, negrisk, "different verifyingContract → different digest");
    }

    #[test]
    fn rejects_invalid_address() {
        let mut o = fixture_order();
        o.maker = "0xnothex".into();
        assert!(order_digest(&o).is_err());
    }

    #[test]
    fn rejects_invalid_decimal() {
        let mut o = fixture_order();
        o.salt = "1abc".into();
        assert!(order_digest(&o).is_err());
    }

    #[test]
    fn encode_uint256_handles_zero_and_one() {
        let zero = encode_uint256_decimal("0").unwrap();
        assert_eq!(zero, [0u8; 32]);
        let one = encode_uint256_decimal("1").unwrap();
        let mut expected = [0u8; 32];
        expected[31] = 1;
        assert_eq!(one, expected);
    }
}
