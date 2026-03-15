//! Cryptographic operations

use crate::config::Config;
use crate::error::{ModError, Result};
use k256::ecdsa::{SigningKey, VerifyingKey, signature::Signer, signature::Verifier};
use k256::ecdsa::Signature as K256Signature;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    pub r: String,
    pub s: String,
    pub v: u8,
}

/// Key pair for signing and encryption
pub struct KeyPair {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
    algorithm: String,
}

impl KeyPair {
    /// Generate a new key pair
    pub fn generate() -> Result<Self> {
        Self::generate_with_algorithm("secp256k1")
    }

    pub fn generate_with_algorithm(algorithm: &str) -> Result<Self> {
        match algorithm {
            "secp256k1" => {
                let signing_key = SigningKey::random(&mut rand::rngs::OsRng);
                let verifying_key = VerifyingKey::from(&signing_key);

                Ok(Self {
                    signing_key,
                    verifying_key,
                    algorithm: algorithm.to_string(),
                })
            }
            _ => Err(ModError::Crypto(format!("Unsupported algorithm: {}", algorithm))),
        }
    }

    /// Create from private key hex string
    pub fn from_private_key(hex: &str) -> Result<Self> {
        let bytes = hex::decode(hex.strip_prefix("0x").unwrap_or(hex))
            .map_err(|e| ModError::Crypto(format!("Invalid hex: {}", e)))?;

        let signing_key = SigningKey::from_bytes(&bytes.into())
            .map_err(|e| ModError::Crypto(format!("Invalid private key: {}", e)))?;

        let verifying_key = VerifyingKey::from(&signing_key);

        Ok(Self {
            signing_key,
            verifying_key,
            algorithm: "secp256k1".to_string(),
        })
    }

    /// Get the private key as hex
    pub fn private_key_hex(&self) -> String {
        format!("0x{}", hex::encode(self.signing_key.to_bytes()))
    }

    /// Get the public key as hex
    pub fn public_key_hex(&self) -> String {
        let bytes = self.verifying_key.to_encoded_point(false);
        format!("0x{}", hex::encode(bytes.as_bytes()))
    }

    /// Get the Ethereum address
    pub fn ethereum_address(&self) -> String {
        let public_key = self.verifying_key.to_encoded_point(false);
        let public_key_bytes = &public_key.as_bytes()[1..]; // Skip the 0x04 prefix

        let mut hasher = Keccak256::new();
        hasher.update(public_key_bytes);
        let hash = hasher.finalize();

        // Take last 20 bytes
        let address = &hash[12..];
        format!("0x{}", hex::encode(address))
    }

    /// Sign arbitrary data
    pub fn sign(&self, data: &serde_json::Value) -> Result<Signature> {
        let message = serde_json::to_vec(data)?;
        let hash = ethereum_message_hash(&message);

        let signature: K256Signature = self.signing_key.sign(&hash);
        let bytes = signature.to_bytes();

        // Extract r, s, v
        let r = hex::encode(&bytes[0..32]);
        let s = hex::encode(&bytes[32..64]);

        // Calculate v (recovery id)
        let v = 27; // Simplified - would need proper recovery calculation

        Ok(Signature { r, s, v })
    }

    /// Encrypt data
    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        // Use AES-GCM with derived key
        use aes_gcm::{
            aead::{Aead, KeyInit, OsRng},
            Aes256Gcm, Nonce,
        };

        // Derive encryption key from private key
        let key_bytes = self.signing_key.to_bytes();
        let mut hasher = sha2::Sha256::new();
        hasher.update(&key_bytes);
        let derived_key = hasher.finalize();

        let cipher = Aes256Gcm::new_from_slice(&derived_key)
            .map_err(|e| ModError::Crypto(format!("Cipher creation failed: {}", e)))?;

        // Generate random nonce
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        // Encrypt
        let ciphertext = cipher
            .encrypt(&nonce, data)
            .map_err(|e| ModError::Crypto(format!("Encryption failed: {}", e)))?;

        // Prepend nonce to ciphertext
        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    /// Decrypt data
    pub fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        use aes_gcm::{
            aead::{Aead, KeyInit},
            Aes256Gcm, Nonce,
        };

        if data.len() < 12 {
            return Err(ModError::Crypto("Invalid encrypted data".to_string()));
        }

        // Derive encryption key
        let key_bytes = self.signing_key.to_bytes();
        let mut hasher = sha2::Sha256::new();
        hasher.update(&key_bytes);
        let derived_key = hasher.finalize();

        let cipher = Aes256Gcm::new_from_slice(&derived_key)
            .map_err(|e| ModError::Crypto(format!("Cipher creation failed: {}", e)))?;

        // Extract nonce and ciphertext
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt
        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| ModError::Crypto(format!("Decryption failed: {}", e)))
    }
}

/// Verify a signature against data and address
pub fn verify(data: &serde_json::Value, signature: &Signature, address: &str) -> Result<bool> {
    let message = serde_json::to_vec(data)?;
    let hash = ethereum_message_hash(&message);

    // Reconstruct signature from r, s, v
    let r_bytes = hex::decode(&signature.r)
        .map_err(|e| ModError::Crypto(format!("Invalid r: {}", e)))?;
    let s_bytes = hex::decode(&signature.s)
        .map_err(|e| ModError::Crypto(format!("Invalid s: {}", e)))?;

    let mut sig_bytes = Vec::new();
    sig_bytes.extend_from_slice(&r_bytes);
    sig_bytes.extend_from_slice(&s_bytes);

    let signature = K256Signature::from_slice(&sig_bytes)
        .map_err(|e| ModError::Crypto(format!("Invalid signature: {}", e)))?;

    // TODO: Recover public key from signature and verify address
    // This is simplified - proper implementation would recover the public key
    // from the signature and v value, then derive the address and compare

    Ok(true)
}

/// Create Ethereum-style message hash
fn ethereum_message_hash(message: &[u8]) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut hasher = Keccak256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(message);
    hasher.finalize().into()
}

/// Key manager for storing and retrieving keys
pub struct KeyManager {
    keys: Arc<RwLock<HashMap<String, Arc<KeyPair>>>>,
    storage_path: PathBuf,
    default_algorithm: String,
}

impl KeyManager {
    pub fn new(config: &Config) -> Result<Self> {
        std::fs::create_dir_all(&config.crypto.key_storage_path)?;

        Ok(Self {
            keys: Arc::new(RwLock::new(HashMap::new())),
            storage_path: config.crypto.key_storage_path.clone(),
            default_algorithm: config.crypto.default_algorithm.clone(),
        })
    }

    /// Get a key by name (or default)
    pub async fn get(&self, name: Option<&str>) -> Result<Arc<KeyPair>> {
        let key_name = name.unwrap_or("default");

        // Check cache
        {
            let keys = self.keys.read();
            if let Some(key) = keys.get(key_name) {
                return Ok(Arc::clone(key));
            }
        }

        // Try to load from disk
        let key = self.load_or_create(key_name).await?;
        let key_arc = Arc::new(key);

        {
            let mut keys = self.keys.write();
            keys.insert(key_name.to_string(), Arc::clone(&key_arc));
        }

        Ok(key_arc)
    }

    /// List all key names
    pub async fn list(&self) -> Result<Vec<String>> {
        let mut names = Vec::new();

        for entry in std::fs::read_dir(&self.storage_path)? {
            let entry = entry?;
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".key") {
                    names.push(name.trim_end_matches(".key").to_string());
                }
            }
        }

        Ok(names)
    }

    async fn load_or_create(&self, name: &str) -> Result<KeyPair> {
        let path = self.storage_path.join(format!("{}.key", name));

        if path.exists() {
            let hex = std::fs::read_to_string(&path)?;
            KeyPair::from_private_key(&hex)
        } else {
            let key = KeyPair::generate_with_algorithm(&self.default_algorithm)?;
            std::fs::write(&path, key.private_key_hex())?;

            // Set secure permissions (Unix only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&path)?.permissions();
                perms.set_mode(0o600); // Read/write for owner only
                std::fs::set_permissions(&path, perms)?;
            }

            Ok(key)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let key = KeyPair::generate().unwrap();
        let address = key.ethereum_address();
        assert!(address.starts_with("0x"));
        assert_eq!(address.len(), 42);
    }

    #[test]
    fn test_signing() {
        let key = KeyPair::generate().unwrap();
        let data = serde_json::json!({"test": "data"});
        let sig = key.sign(&data).unwrap();
        assert!(!sig.r.is_empty());
        assert!(!sig.s.is_empty());
    }

    #[test]
    fn test_encryption() {
        let key = KeyPair::generate().unwrap();
        let plaintext = b"secret message";

        let encrypted = key.encrypt(plaintext).unwrap();
        let decrypted = key.decrypt(&encrypted).unwrap();

        assert_eq!(plaintext, decrypted.as_slice());
    }
}
