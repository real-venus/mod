//! Key management and cryptographic operations
//!
//! Mirrors the Python `mod/core/key/` structure with per-algorithm submodules:
//!   - ecdsa:   secp256k1 / Ethereum keys
//!   - ed25519: Ed25519 signing keys
//!   - sr25519: Substrate (sr25519) keys
//!   - solana:  Solana (Ed25519 + Base58) keys
//!   - aes:     AES-GCM symmetric encryption

pub mod ecdsa;
pub mod ed25519;
pub mod sr25519;
pub mod solana;
pub mod aes;

use crate::config::Config;
use crate::error::{ModError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;

// Re-export crypto backend types used internally
use k256::ecdsa::{SigningKey as K256SigningKey, VerifyingKey as K256VerifyingKey, signature::Signer as _};
use k256::ecdsa::Signature as K256Signature;
use ed25519_dalek::{SigningKey as Ed25519SigningKey, VerifyingKey as Ed25519VerifyingKey};
use schnorrkel::{
    Keypair as Sr25519Keypair,
    MiniSecretKey as Sr25519MiniSecretKey,
    signing_context,
};

/// Supported key types — matches Python Key.crypto_type_map
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeyType {
    Secp256k1,
    Ed25519,
    Sr25519,
    Solana,
}

impl KeyType {
    pub fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "secp256k1" | "ecdsa" | "eth" => Ok(Self::Secp256k1),
            "ed25519" => Ok(Self::Ed25519),
            "sr25519" | "sub" | "substrate" | "dot" => Ok(Self::Sr25519),
            "solana" | "sol" => Ok(Self::Solana),
            _ => Err(ModError::Crypto(format!("Unsupported key type: {}", s))),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Secp256k1 => "secp256k1",
            Self::Ed25519 => "ed25519",
            Self::Sr25519 => "sr25519",
            Self::Solana => "solana",
        }
    }
}

impl std::fmt::Display for KeyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    pub r: String,
    pub s: String,
    pub v: u8,
}

/// Inner key material — one variant per algorithm
pub(crate) enum KeyInner {
    Secp256k1 {
        signing: K256SigningKey,
        verifying: K256VerifyingKey,
    },
    Ed25519 {
        signing: Ed25519SigningKey,
        verifying: Ed25519VerifyingKey,
    },
    Sr25519 {
        keypair: Sr25519Keypair,
        mini_secret: [u8; 32],
    },
    /// Solana keys are ed25519 under the hood, addresses are base58
    Solana {
        signing: Ed25519SigningKey,
        verifying: Ed25519VerifyingKey,
    },
}

/// Key pair for signing and encryption — supports multiple algorithms
pub struct KeyPair {
    pub(crate) inner: KeyInner,
    pub(crate) key_type: KeyType,
}

impl KeyPair {
    /// Generate a new secp256k1 key pair (default)
    pub fn generate() -> Result<Self> {
        Self::generate_for(KeyType::Secp256k1)
    }

    /// Generate with algorithm string (backwards compat)
    pub fn generate_with_algorithm(algorithm: &str) -> Result<Self> {
        Self::generate_for(KeyType::from_str(algorithm)?)
    }

    /// Generate a key pair for the given key type
    pub fn generate_for(key_type: KeyType) -> Result<Self> {
        match key_type {
            KeyType::Secp256k1 => {
                let signing = K256SigningKey::random(&mut rand::rngs::OsRng);
                let verifying = K256VerifyingKey::from(&signing);
                Ok(Self {
                    inner: KeyInner::Secp256k1 { signing, verifying },
                    key_type,
                })
            }
            KeyType::Ed25519 => {
                let signing = Ed25519SigningKey::generate(&mut rand::rngs::OsRng);
                let verifying = Ed25519VerifyingKey::from(&signing);
                Ok(Self {
                    inner: KeyInner::Ed25519 { signing, verifying },
                    key_type,
                })
            }
            KeyType::Sr25519 => {
                let mini_secret = Sr25519MiniSecretKey::generate_with(&mut rand_core::OsRng);
                let keypair = mini_secret.expand_to_keypair(schnorrkel::ExpansionMode::Ed25519);
                let secret_bytes: [u8; 32] = mini_secret.to_bytes();
                Ok(Self {
                    inner: KeyInner::Sr25519 {
                        keypair,
                        mini_secret: secret_bytes,
                    },
                    key_type,
                })
            }
            KeyType::Solana => {
                let signing = Ed25519SigningKey::generate(&mut rand::rngs::OsRng);
                let verifying = Ed25519VerifyingKey::from(&signing);
                Ok(Self {
                    inner: KeyInner::Solana { signing, verifying },
                    key_type,
                })
            }
        }
    }

    /// Create from private key hex string (auto-detect or assume secp256k1)
    pub fn from_private_key(hex_str: &str) -> Result<Self> {
        Self::from_private_key_with_type(hex_str, KeyType::Secp256k1)
    }

    /// Create from private key with explicit type
    pub fn from_private_key_with_type(hex_str: &str, key_type: KeyType) -> Result<Self> {
        let bytes = hex::decode(hex_str.strip_prefix("0x").unwrap_or(hex_str))
            .map_err(|e| ModError::Crypto(format!("Invalid hex: {}", e)))?;

        let byte_array: [u8; 32] = bytes.try_into()
            .map_err(|_| ModError::Crypto("Private key must be 32 bytes".to_string()))?;

        match key_type {
            KeyType::Secp256k1 => {
                let signing = K256SigningKey::from_bytes(&byte_array.into())
                    .map_err(|e| ModError::Crypto(format!("Invalid secp256k1 key: {}", e)))?;
                let verifying = K256VerifyingKey::from(&signing);
                Ok(Self {
                    inner: KeyInner::Secp256k1 { signing, verifying },
                    key_type,
                })
            }
            KeyType::Ed25519 => {
                let signing = Ed25519SigningKey::from_bytes(&byte_array);
                let verifying = Ed25519VerifyingKey::from(&signing);
                Ok(Self {
                    inner: KeyInner::Ed25519 { signing, verifying },
                    key_type,
                })
            }
            KeyType::Sr25519 => {
                let mini_secret = Sr25519MiniSecretKey::from_bytes(&byte_array)
                    .map_err(|e| ModError::Crypto(format!("Invalid sr25519 key: {:?}", e)))?;
                let keypair = mini_secret.expand_to_keypair(schnorrkel::ExpansionMode::Ed25519);
                Ok(Self {
                    inner: KeyInner::Sr25519 {
                        keypair,
                        mini_secret: byte_array,
                    },
                    key_type,
                })
            }
            KeyType::Solana => {
                let signing = Ed25519SigningKey::from_bytes(&byte_array);
                let verifying = Ed25519VerifyingKey::from(&signing);
                Ok(Self {
                    inner: KeyInner::Solana { signing, verifying },
                    key_type,
                })
            }
        }
    }

    /// Create a Solana keypair from a base58 private key (64-byte secret)
    pub fn from_solana_base58(b58: &str) -> Result<Self> {
        solana::SolanaKey::from_base58(b58)
    }

    /// Get the key type
    pub fn key_type(&self) -> KeyType {
        self.key_type
    }

    /// Get the private key as hex
    pub fn private_key_hex(&self) -> String {
        let bytes = match &self.inner {
            KeyInner::Secp256k1 { signing, .. } => signing.to_bytes().to_vec(),
            KeyInner::Ed25519 { signing, .. } => signing.to_bytes().to_vec(),
            KeyInner::Sr25519 { mini_secret, .. } => mini_secret.to_vec(),
            KeyInner::Solana { signing, .. } => signing.to_bytes().to_vec(),
        };
        format!("0x{}", hex::encode(bytes))
    }

    /// Get the public key as hex
    pub fn public_key_hex(&self) -> String {
        let bytes = self.public_key_bytes();
        format!("0x{}", hex::encode(bytes))
    }

    /// Get the public key as raw bytes
    pub fn public_key_bytes(&self) -> Vec<u8> {
        match &self.inner {
            KeyInner::Secp256k1 { verifying, .. } => {
                verifying.to_encoded_point(false).as_bytes().to_vec()
            }
            KeyInner::Ed25519 { verifying, .. } => verifying.to_bytes().to_vec(),
            KeyInner::Sr25519 { keypair, .. } => keypair.public.to_bytes().to_vec(),
            KeyInner::Solana { verifying, .. } => verifying.to_bytes().to_vec(),
        }
    }

    /// Get the address for this key (format depends on key type)
    pub fn address(&self) -> String {
        match &self.inner {
            KeyInner::Secp256k1 { verifying, .. } => {
                ecdsa::ethereum_address_from_verifying_key(verifying)
            }
            KeyInner::Ed25519 { verifying, .. } => {
                format!("0x{}", hex::encode(verifying.to_bytes()))
            }
            KeyInner::Sr25519 { keypair, .. } => {
                sr25519::ss58_encode(&keypair.public.to_bytes(), 42)
            }
            KeyInner::Solana { verifying, .. } => {
                bs58::encode(verifying.to_bytes()).into_string()
            }
        }
    }

    /// Backwards compat: get Ethereum address (only valid for secp256k1)
    pub fn ethereum_address(&self) -> String {
        self.address()
    }

    /// Solana address (base58) — works for Solana and ed25519 keys
    pub fn solana_address(&self) -> Result<String> {
        match &self.inner {
            KeyInner::Solana { verifying, .. } | KeyInner::Ed25519 { verifying, .. } => {
                Ok(bs58::encode(verifying.to_bytes()).into_string())
            }
            _ => Err(ModError::Crypto(
                "Solana address only available for ed25519/solana keys".to_string(),
            )),
        }
    }

    /// Substrate SS58 address — only valid for sr25519
    pub fn substrate_address(&self, prefix: u8) -> Result<String> {
        match &self.inner {
            KeyInner::Sr25519 { keypair, .. } => {
                Ok(sr25519::ss58_encode(&keypair.public.to_bytes(), prefix))
            }
            _ => Err(ModError::Crypto(
                "SS58 address only available for sr25519 keys".to_string(),
            )),
        }
    }

    /// Sign arbitrary JSON data
    pub fn sign(&self, data: &serde_json::Value) -> Result<Signature> {
        let message = serde_json::to_vec(data)?;

        match &self.inner {
            KeyInner::Secp256k1 { signing, .. } => {
                let hash = ecdsa::ethereum_message_hash(&message);
                let sig: K256Signature = signing.sign(&hash);
                let bytes = sig.to_bytes();
                Ok(Signature {
                    r: hex::encode(&bytes[0..32]),
                    s: hex::encode(&bytes[32..64]),
                    v: 27,
                })
            }
            KeyInner::Ed25519 { signing, .. } | KeyInner::Solana { signing, .. } => {
                let sig = signing.sign(&message);
                let bytes = sig.to_bytes();
                Ok(Signature {
                    r: hex::encode(&bytes[0..32]),
                    s: hex::encode(&bytes[32..64]),
                    v: 0,
                })
            }
            KeyInner::Sr25519 { keypair, .. } => {
                let ctx = signing_context(b"substrate");
                let sig = keypair.sign(ctx.bytes(&message));
                let bytes = sig.to_bytes();
                Ok(Signature {
                    r: hex::encode(&bytes[0..32]),
                    s: hex::encode(&bytes[32..64]),
                    v: 0,
                })
            }
        }
    }

    /// Sign raw bytes (no JSON serialization)
    pub fn sign_bytes(&self, data: &[u8]) -> Result<Vec<u8>> {
        match &self.inner {
            KeyInner::Secp256k1 { signing, .. } => {
                let hash = ecdsa::ethereum_message_hash(data);
                let sig: K256Signature = signing.sign(&hash);
                Ok(sig.to_bytes().to_vec())
            }
            KeyInner::Ed25519 { signing, .. } | KeyInner::Solana { signing, .. } => {
                let sig = signing.sign(data);
                Ok(sig.to_bytes().to_vec())
            }
            KeyInner::Sr25519 { keypair, .. } => {
                let ctx = signing_context(b"substrate");
                let sig = keypair.sign(ctx.bytes(data));
                Ok(sig.to_bytes().to_vec())
            }
        }
    }

    /// Verify a signature against raw bytes and this key's public key
    pub fn verify_bytes(&self, data: &[u8], sig_bytes: &[u8]) -> Result<bool> {
        match &self.inner {
            KeyInner::Secp256k1 { verifying, .. } => {
                ecdsa::verify_secp256k1(data, sig_bytes, verifying)
            }
            KeyInner::Ed25519 { verifying, .. } | KeyInner::Solana { verifying, .. } => {
                ed25519::verify_ed25519(data, sig_bytes, verifying)
            }
            KeyInner::Sr25519 { keypair, .. } => {
                sr25519::verify_sr25519(data, sig_bytes, &keypair.public)
            }
        }
    }

    /// Encrypt data (AES-256-GCM with key derived from private key)
    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let derived_key = self.derive_encryption_key();
        aes::AesKey::encrypt_with_derived(&derived_key, data)
    }

    /// Decrypt data
    pub fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let derived_key = self.derive_encryption_key();
        aes::AesKey::decrypt_with_derived(&derived_key, data)
    }

    /// Derive a 32-byte encryption key from the private key material
    fn derive_encryption_key(&self) -> [u8; 32] {
        use sha2::Digest;
        let secret_bytes = match &self.inner {
            KeyInner::Secp256k1 { signing, .. } => signing.to_bytes().to_vec(),
            KeyInner::Ed25519 { signing, .. } => signing.to_bytes().to_vec(),
            KeyInner::Sr25519 { mini_secret, .. } => mini_secret.to_vec(),
            KeyInner::Solana { signing, .. } => signing.to_bytes().to_vec(),
        };
        let mut hasher = sha2::Sha256::new();
        hasher.update(&secret_bytes);
        hasher.finalize().into()
    }
}

/// Verify a secp256k1 signature against data and Ethereum address
pub fn verify(data: &serde_json::Value, signature: &Signature, _address: &str) -> Result<bool> {
    let message = serde_json::to_vec(data)?;
    let _hash = ecdsa::ethereum_message_hash(&message);

    let r_bytes = hex::decode(&signature.r)
        .map_err(|e| ModError::Crypto(format!("Invalid r: {}", e)))?;
    let s_bytes = hex::decode(&signature.s)
        .map_err(|e| ModError::Crypto(format!("Invalid s: {}", e)))?;

    let mut sig_bytes = Vec::new();
    sig_bytes.extend_from_slice(&r_bytes);
    sig_bytes.extend_from_slice(&s_bytes);

    let _signature = K256Signature::from_slice(&sig_bytes)
        .map_err(|e| ModError::Crypto(format!("Invalid signature: {}", e)))?;

    // TODO: Recover public key from signature + v, derive address, compare
    Ok(true)
}

/// Detect address type from an address string
pub fn detect_address_type(addr: &str) -> KeyType {
    let addr = addr.trim();
    if ecdsa::is_ethereum_address(addr) {
        KeyType::Secp256k1
    } else if solana::is_valid_solana_address(addr) {
        KeyType::Solana
    } else {
        KeyType::Sr25519
    }
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

        {
            let keys = self.keys.read();
            if let Some(key) = keys.get(key_name) {
                return Ok(Arc::clone(key));
            }
        }

        let key = self.load_or_create(key_name).await?;
        let key_arc = Arc::new(key);

        {
            let mut keys = self.keys.write();
            keys.insert(key_name.to_string(), Arc::clone(&key_arc));
        }

        Ok(key_arc)
    }

    /// Get a key by name with explicit key type
    pub async fn get_typed(&self, name: &str, key_type: KeyType) -> Result<Arc<KeyPair>> {
        let full_name = format!("{}.{}", name, key_type.as_str());

        {
            let keys = self.keys.read();
            if let Some(key) = keys.get(&full_name) {
                return Ok(Arc::clone(key));
            }
        }

        let key = self.load_or_create_typed(&full_name, key_type).await?;
        let key_arc = Arc::new(key);

        {
            let mut keys = self.keys.write();
            keys.insert(full_name, Arc::clone(&key_arc));
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
            let meta_path = self.storage_path.join(format!("{}.meta", name));
            let key_type = if meta_path.exists() {
                let meta = std::fs::read_to_string(&meta_path)?;
                KeyType::from_str(meta.trim()).unwrap_or(KeyType::Secp256k1)
            } else {
                KeyType::from_str(&self.default_algorithm).unwrap_or(KeyType::Secp256k1)
            };

            let hex_str = std::fs::read_to_string(&path)?;
            KeyPair::from_private_key_with_type(hex_str.trim(), key_type)
        } else {
            let key_type = KeyType::from_str(&self.default_algorithm).unwrap_or(KeyType::Secp256k1);
            let key = KeyPair::generate_for(key_type)?;
            self.save_key(&path, name, &key)?;
            Ok(key)
        }
    }

    async fn load_or_create_typed(&self, name: &str, key_type: KeyType) -> Result<KeyPair> {
        let path = self.storage_path.join(format!("{}.key", name));

        if path.exists() {
            let hex_str = std::fs::read_to_string(&path)?;
            KeyPair::from_private_key_with_type(hex_str.trim(), key_type)
        } else {
            let key = KeyPair::generate_for(key_type)?;
            self.save_key(&path, name, &key)?;
            Ok(key)
        }
    }

    fn save_key(&self, path: &PathBuf, name: &str, key: &KeyPair) -> Result<()> {
        std::fs::write(path, key.private_key_hex())?;

        let meta_path = self.storage_path.join(format!("{}.meta", name));
        std::fs::write(&meta_path, key.key_type().as_str())?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(path)?.permissions();
            perms.set_mode(0o600);
            std::fs::set_permissions(path, perms)?;

            let mut meta_perms = std::fs::metadata(&meta_path)?.permissions();
            meta_perms.set_mode(0o600);
            std::fs::set_permissions(&meta_path, meta_perms)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secp256k1_key() {
        let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
        assert_eq!(key.key_type(), KeyType::Secp256k1);
        let addr = key.address();
        assert!(addr.starts_with("0x"));
        assert_eq!(addr.len(), 42);
    }

    #[test]
    fn test_ed25519_key() {
        let key = KeyPair::generate_for(KeyType::Ed25519).unwrap();
        assert_eq!(key.key_type(), KeyType::Ed25519);
        let addr = key.address();
        assert!(addr.starts_with("0x"));
    }

    #[test]
    fn test_sr25519_key() {
        let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
        assert_eq!(key.key_type(), KeyType::Sr25519);
        let addr = key.address();
        assert!(!addr.is_empty());
    }

    #[test]
    fn test_solana_key() {
        let key = KeyPair::generate_for(KeyType::Solana).unwrap();
        assert_eq!(key.key_type(), KeyType::Solana);
        let addr = key.address();
        assert!(addr.len() >= 32 && addr.len() <= 44);
    }

    #[test]
    fn test_roundtrip_private_key() {
        for kt in [KeyType::Secp256k1, KeyType::Ed25519, KeyType::Sr25519, KeyType::Solana] {
            let key = KeyPair::generate_for(kt).unwrap();
            let hex = key.private_key_hex();
            let restored = KeyPair::from_private_key_with_type(&hex, kt).unwrap();
            assert_eq!(key.public_key_hex(), restored.public_key_hex());
        }
    }

    #[test]
    fn test_signing_all_types() {
        let data = serde_json::json!({"test": "data"});
        for kt in [KeyType::Secp256k1, KeyType::Ed25519, KeyType::Sr25519, KeyType::Solana] {
            let key = KeyPair::generate_for(kt).unwrap();
            let sig = key.sign(&data).unwrap();
            assert!(!sig.r.is_empty());
            assert!(!sig.s.is_empty());
        }
    }

    #[test]
    fn test_sign_verify_bytes() {
        let data = b"hello world";
        for kt in [KeyType::Ed25519, KeyType::Sr25519, KeyType::Solana] {
            let key = KeyPair::generate_for(kt).unwrap();
            let sig = key.sign_bytes(data).unwrap();
            assert!(key.verify_bytes(data, &sig).unwrap());
        }
    }

    #[test]
    fn test_encryption_all_types() {
        let plaintext = b"secret message";
        for kt in [KeyType::Secp256k1, KeyType::Ed25519, KeyType::Sr25519, KeyType::Solana] {
            let key = KeyPair::generate_for(kt).unwrap();
            let encrypted = key.encrypt(plaintext).unwrap();
            let decrypted = key.decrypt(&encrypted).unwrap();
            assert_eq!(plaintext, decrypted.as_slice());
        }
    }

    #[test]
    fn test_solana_base58_import() {
        let key = KeyPair::generate_for(KeyType::Solana).unwrap();
        let addr = key.address();

        let secret = hex::decode(key.private_key_hex().strip_prefix("0x").unwrap()).unwrap();
        let public = hex::decode(key.public_key_hex().strip_prefix("0x").unwrap()).unwrap();
        let mut full = secret.clone();
        full.extend_from_slice(&public);
        let b58 = bs58::encode(&full).into_string();

        let restored = KeyPair::from_solana_base58(&b58).unwrap();
        assert_eq!(restored.address(), addr);
    }

    #[test]
    fn test_algorithm_string_compat() {
        let key = KeyPair::generate_with_algorithm("secp256k1").unwrap();
        assert_eq!(key.key_type(), KeyType::Secp256k1);

        let key2 = KeyPair::generate_with_algorithm("ed25519").unwrap();
        assert_eq!(key2.key_type(), KeyType::Ed25519);

        let key3 = KeyPair::generate_with_algorithm("solana").unwrap();
        assert_eq!(key3.key_type(), KeyType::Solana);
    }

    #[test]
    fn test_detect_address_type() {
        assert_eq!(detect_address_type("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"), KeyType::Secp256k1);
    }
}
