//! Ed25519 key operations
//!
//! Mirrors Python `mod/core/key/key/ed25519/`.

use crate::error::{ModError, Result};
use ed25519_dalek::{VerifyingKey, Signature, Verifier};

/// Verify an ed25519 signature against raw bytes and a verifying key
pub fn verify_ed25519(data: &[u8], sig_bytes: &[u8], verifying: &VerifyingKey) -> Result<bool> {
    let sig_array: [u8; 64] = sig_bytes.try_into()
        .map_err(|_| ModError::Crypto("Ed25519 signature must be 64 bytes".to_string()))?;
    let sig = Signature::from_bytes(&sig_array);
    if verifying.verify(data, &sig).is_ok() {
        return Ok(true);
    }
    // Try with <Bytes> wrapper (Substrate convention)
    let wrapped = [b"<Bytes>", data, b"</Bytes>"].concat();
    Ok(verifying.verify(&wrapped, &sig).is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{SigningKey, Signer};

    #[test]
    fn test_sign_and_verify() {
        let signing = SigningKey::generate(&mut rand::rngs::OsRng);
        let verifying = VerifyingKey::from(&signing);
        let msg = b"hello world";
        let sig = signing.sign(msg);
        assert!(verify_ed25519(msg, &sig.to_bytes(), &verifying).unwrap());
    }
}
