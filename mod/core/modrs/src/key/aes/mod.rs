//! AES-GCM symmetric encryption
//!
//! Mirrors Python `mod/core/key/key/aes/`.

use crate::error::{ModError, Result};
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use sha2::Digest;

/// AES-256-GCM encryption helper
pub struct AesKey;

impl AesKey {
    /// Encrypt data using a pre-derived 32-byte key
    pub fn encrypt_with_derived(derived_key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>> {
        let cipher = Aes256Gcm::new_from_slice(derived_key)
            .map_err(|e| ModError::Crypto(format!("Cipher creation failed: {}", e)))?;

        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, data)
            .map_err(|e| ModError::Crypto(format!("Encryption failed: {}", e)))?;

        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    /// Decrypt data using a pre-derived 32-byte key
    pub fn decrypt_with_derived(derived_key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>> {
        if data.len() < 12 {
            return Err(ModError::Crypto("Invalid encrypted data".to_string()));
        }

        let cipher = Aes256Gcm::new_from_slice(derived_key)
            .map_err(|e| ModError::Crypto(format!("Cipher creation failed: {}", e)))?;

        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| ModError::Crypto(format!("Decryption failed: {}", e)))
    }

    /// Encrypt with a raw key (SHA-256 hashed to derive AES key)
    pub fn encrypt_with_key(key_bytes: &[u8], data: &[u8]) -> Result<Vec<u8>> {
        let derived = derive_aes_key(key_bytes);
        Self::encrypt_with_derived(&derived, data)
    }

    /// Decrypt with a raw key
    pub fn decrypt_with_key(key_bytes: &[u8], data: &[u8]) -> Result<Vec<u8>> {
        let derived = derive_aes_key(key_bytes);
        Self::decrypt_with_derived(&derived, data)
    }

    /// Encrypt with a password string
    pub fn encrypt_with_password(password: &str, data: &[u8]) -> Result<Vec<u8>> {
        Self::encrypt_with_key(password.as_bytes(), data)
    }

    /// Decrypt with a password string
    pub fn decrypt_with_password(password: &str, data: &[u8]) -> Result<Vec<u8>> {
        Self::decrypt_with_key(password.as_bytes(), data)
    }
}

/// Derive a 32-byte AES key via SHA-256
fn derive_aes_key(input: &[u8]) -> [u8; 32] {
    let mut hasher = sha2::Sha256::new();
    hasher.update(input);
    hasher.finalize().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_with_key() {
        let key = [42u8; 32];
        let plaintext = b"hello world";

        let encrypted = AesKey::encrypt_with_key(&key, plaintext).unwrap();
        let decrypted = AesKey::decrypt_with_key(&key, &encrypted).unwrap();

        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_encrypt_decrypt_with_password() {
        let password = "my_secret_password";
        let plaintext = b"sensitive data";

        let encrypted = AesKey::encrypt_with_password(password, plaintext).unwrap();
        let decrypted = AesKey::decrypt_with_password(password, &encrypted).unwrap();

        assert_eq!(plaintext, decrypted.as_slice());
    }
}
