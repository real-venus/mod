//! Solana (Ed25519 + Base58) key operations
//!
//! Mirrors Python `mod/core/key/key/solana/`.

use crate::error::{ModError, Result};
use crate::key::{KeyPair, KeyInner, KeyType};
use ed25519_dalek::{SigningKey as Ed25519SigningKey, VerifyingKey as Ed25519VerifyingKey};

pub struct SolanaKey;

impl SolanaKey {
    /// Create a KeyPair from a base58 Solana private key (32 or 64 bytes)
    pub fn from_base58(b58: &str) -> Result<KeyPair> {
        let bytes = bs58::decode(b58).into_vec()
            .map_err(|e| ModError::Crypto(format!("Invalid base58: {}", e)))?;

        let secret_bytes: [u8; 32] = if bytes.len() == 64 {
            bytes[..32].try_into().unwrap()
        } else if bytes.len() == 32 {
            bytes.try_into().unwrap()
        } else {
            return Err(ModError::Crypto(format!(
                "Solana key must be 32 or 64 bytes, got {}",
                bytes.len()
            )));
        };

        let signing = Ed25519SigningKey::from_bytes(&secret_bytes);
        let verifying = Ed25519VerifyingKey::from(&signing);
        Ok(KeyPair {
            inner: KeyInner::Solana { signing, verifying },
            key_type: KeyType::Solana,
        })
    }
}

/// Check if a string is a valid Solana address (Base58, decodes to 32 bytes)
pub fn is_valid_solana_address(addr: &str) -> bool {
    match bs58::decode(addr).into_vec() {
        Ok(bytes) => bytes.len() == 32,
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_solana_address() {
        // Generate a solana key and check its address
        let key = KeyPair::generate_for(KeyType::Solana).unwrap();
        let addr = key.address();
        assert!(is_valid_solana_address(&addr));
    }

    #[test]
    fn test_invalid_addresses() {
        assert!(!is_valid_solana_address("not_valid"));
        assert!(!is_valid_solana_address("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"));
    }
}
