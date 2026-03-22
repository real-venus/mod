//! ECDSA (secp256k1 / Ethereum) key operations
//!
//! Mirrors Python `mod/core/key/key/edcsa/`.

use crate::error::{ModError, Result};
use k256::ecdsa::{VerifyingKey, Signature as K256Signature};
use sha3::{Digest, Keccak256};

/// Derive Ethereum address from a verifying key
pub fn ethereum_address_from_verifying_key(vk: &VerifyingKey) -> String {
    let public_key = vk.to_encoded_point(false);
    let public_key_bytes = &public_key.as_bytes()[1..]; // skip 0x04 prefix

    let mut hasher = Keccak256::new();
    hasher.update(public_key_bytes);
    let hash = hasher.finalize();

    let address = &hash[12..];
    format!("0x{}", hex::encode(address))
}

/// Create Ethereum-style message hash
pub fn ethereum_message_hash(message: &[u8]) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut hasher = Keccak256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(message);
    hasher.finalize().into()
}

/// Verify a secp256k1 signature against raw bytes
pub fn verify_secp256k1(data: &[u8], sig_bytes: &[u8], verifying: &VerifyingKey) -> Result<bool> {
    let sig = K256Signature::from_slice(sig_bytes)
        .map_err(|e| ModError::Crypto(format!("Invalid signature: {}", e)))?;
    use k256::ecdsa::signature::Verifier;
    let hash = ethereum_message_hash(data);
    Ok(verifying.verify(&hash, &sig).is_ok())
}

/// Check if a string looks like an Ethereum address (0x + 40 hex chars)
pub fn is_ethereum_address(s: &str) -> bool {
    s.len() == 42
        && s.starts_with("0x")
        && s[2..].chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_ethereum_address() {
        assert!(is_ethereum_address("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"));
        assert!(!is_ethereum_address("not_an_address"));
        assert!(!is_ethereum_address("0x742d35")); // too short
    }

    #[test]
    fn test_message_hash() {
        let hash = ethereum_message_hash(b"hello");
        assert_eq!(hash.len(), 32);
    }
}
