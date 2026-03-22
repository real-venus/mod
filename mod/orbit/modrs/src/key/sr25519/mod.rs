//! Sr25519 (Substrate/Polkadot) key operations
//!
//! Mirrors Python `mod/core/key/key/sr25519/`.

use crate::error::{ModError, Result};
use schnorrkel::{PublicKey, signing_context};

/// Verify an sr25519 signature against raw bytes and a public key
pub fn verify_sr25519(data: &[u8], sig_bytes: &[u8], public: &PublicKey) -> Result<bool> {
    let sig = schnorrkel::Signature::from_bytes(sig_bytes)
        .map_err(|e| ModError::Crypto(format!("Invalid sr25519 signature: {:?}", e)))?;
    let ctx = signing_context(b"substrate");
    Ok(public.verify(ctx.bytes(data), &sig).is_ok())
}

/// Encode public key bytes to SS58 address format
pub fn ss58_encode(public_key: &[u8; 32], prefix: u8) -> String {
    use blake2::{Blake2b512, Digest};

    let mut payload = vec![prefix];
    payload.extend_from_slice(public_key);

    // SS58 checksum: blake2b("SS58PRE" || prefix || pubkey)[0..2]
    let mut hasher = Blake2b512::new();
    hasher.update(b"SS58PRE");
    hasher.update(&payload);
    let hash = hasher.finalize();
    payload.extend_from_slice(&hash[0..2]);

    bs58::encode(payload).into_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use schnorrkel::MiniSecretKey;

    #[test]
    fn test_ss58_encode() {
        let mini = MiniSecretKey::generate_with(&mut rand_core::OsRng);
        let kp = mini.expand_to_keypair(schnorrkel::ExpansionMode::Ed25519);
        let addr = ss58_encode(&kp.public.to_bytes(), 42);
        assert!(!addr.is_empty());
        // SS58 generic prefix 42 addresses typically start with '5'
        assert!(addr.starts_with('5'));
    }

    #[test]
    fn test_sign_and_verify() {
        let mini = MiniSecretKey::generate_with(&mut rand_core::OsRng);
        let kp = mini.expand_to_keypair(schnorrkel::ExpansionMode::Ed25519);
        let ctx = signing_context(b"substrate");
        let msg = b"hello substrate";
        let sig = kp.sign(ctx.bytes(msg));
        assert!(verify_sr25519(msg, &sig.to_bytes(), &kp.public).unwrap());
    }
}
