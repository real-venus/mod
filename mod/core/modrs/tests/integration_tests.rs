//! Comprehensive integration tests for ModRS
//!
//! Tests cover: config, error, utils, keys (all types), store (sqlite),
//! module system, server manager, and the top-level Mod API.

use modrs::prelude::*;
use modrs::config::Config;
use modrs::key::{KeyPair, KeyType, KeyManager, Signature};
use modrs::key::aes::AesKey;
use modrs::key::ecdsa;
use modrs::key::solana;
use modrs::store::{SqliteStore, IpfsStore, IpfsConfig, create_store};
use modrs::module::{ModuleRegistry, ModuleInfo};
use modrs::server::{ServerManager, ServerInfo};
use modrs::error::ModError;
use modrs::utils;

use serde_json::json;
use tempfile::TempDir;
use std::path::PathBuf;

// ============================================================================
// HELPER: create a Config pointing at a temp directory
// ============================================================================

fn temp_config() -> (TempDir, Config) {
    let dir = TempDir::new().unwrap();
    let base = dir.path().to_path_buf();

    let mut config = Config::default();
    config.paths.home = base.clone();
    config.paths.lib = base.clone();
    config.paths.mod_dir = base.join("mod");
    config.paths.orbit = base.join("orbit");
    config.paths.store = base.join("store");
    config.crypto.key_storage_path = base.join("keys");
    config.store.path = base.join("store");
    (dir, config)
}

// ============================================================================
// CONFIG TESTS
// ============================================================================

#[test]
fn test_config_default() {
    let config = Config::default();
    assert_eq!(config.name, "mod");
    assert_eq!(config.version, "0.1.0");
    assert_eq!(config.ports.range, (8000, 9000));
    assert_eq!(config.crypto.default_algorithm, "secp256k1");
    assert_eq!(config.store.backend, "sqlite");
    assert_eq!(config.server.default_host, "0.0.0.0");
    assert!(config.server.cors_enabled);
    assert!(!config.store.encrypt_by_default);
}

#[test]
fn test_config_get_port_range() {
    let config = Config::default();
    assert_eq!(config.get_port_range(), (8000, 9000));
}

#[test]
fn test_config_save_and_load_toml() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("test.toml");
    let config = Config::default();
    config.save(&path).unwrap();
    assert!(path.exists());

    let loaded = Config::from_path(&path).unwrap();
    assert_eq!(loaded.name, config.name);
    assert_eq!(loaded.version, config.version);
    assert_eq!(loaded.ports.range, config.ports.range);
}

#[test]
fn test_config_save_and_load_yaml() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("test.yaml");
    let config = Config::default();
    config.save(&path).unwrap();
    assert!(path.exists());

    let loaded = Config::from_path(&path).unwrap();
    assert_eq!(loaded.name, config.name);
}

#[test]
fn test_config_from_nonexistent_path() {
    let path = PathBuf::from("/tmp/does_not_exist_modrs_test.toml");
    let config = Config::from_path(&path).unwrap();
    // Should return default
    assert_eq!(config.name, "mod");
}

#[test]
fn test_config_shortcuts() {
    let config = Config::default();
    assert_eq!(config.shortcuts.get("m"), Some(&"mod".to_string()));
    assert_eq!(config.shortcuts.get("c"), Some(&"mod".to_string()));
}

// ============================================================================
// ERROR TESTS
// ============================================================================

#[test]
fn test_error_display() {
    let e = ModError::ModuleNotFound("foo".into());
    assert_eq!(e.to_string(), "Module not found: foo");

    let e = ModError::FunctionNotFound("bar".into());
    assert_eq!(e.to_string(), "Function not found: bar");

    let e = ModError::InvalidPath("baz".into());
    assert_eq!(e.to_string(), "Invalid module path: baz");

    let e = ModError::Storage("db error".into());
    assert_eq!(e.to_string(), "Storage error: db error");

    let e = ModError::Ipfs("timeout".into());
    assert_eq!(e.to_string(), "IPFS error: timeout");

    let e = ModError::KeyNotFound("default".into());
    assert_eq!(e.to_string(), "Key not found: default");

    let e = ModError::Crypto("bad key".into());
    assert_eq!(e.to_string(), "Cryptographic error: bad key");

    let e = ModError::InvalidSignature;
    assert_eq!(e.to_string(), "Invalid signature");

    let e = ModError::ServerAlreadyRunning("api".into());
    assert_eq!(e.to_string(), "Server already running: api");

    let e = ModError::ServerNotRunning("api".into());
    assert_eq!(e.to_string(), "Server not running: api");

    let e = ModError::Config("bad config".into());
    assert_eq!(e.to_string(), "Configuration error: bad config");

    let e = ModError::MissingEnvVar("API_KEY".into());
    assert_eq!(e.to_string(), "Missing environment variable: API_KEY");
}

#[test]
fn test_error_from_string() {
    let e: ModError = "something broke".into();
    assert!(matches!(e, ModError::Unknown(_)));
    assert_eq!(e.to_string(), "Unknown error: something broke");
}

#[test]
fn test_error_from_str() {
    let e: ModError = String::from("runtime error").into();
    assert!(matches!(e, ModError::Unknown(_)));
}

// ============================================================================
// UTILS TESTS
// ============================================================================

#[test]
fn test_hash_sha256() {
    let h = utils::hash(b"hello", "sha256").unwrap();
    assert_eq!(h.len(), 64); // 32 bytes = 64 hex chars
    // Known SHA256 of "hello"
    assert_eq!(h, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
}

#[test]
fn test_hash_sha512() {
    let h = utils::hash(b"hello", "sha512").unwrap();
    assert_eq!(h.len(), 128); // 64 bytes = 128 hex chars
}

#[test]
fn test_hash_keccak256() {
    let h = utils::hash(b"hello", "keccak").unwrap();
    assert_eq!(h.len(), 64);
    let h2 = utils::hash(b"hello", "keccak256").unwrap();
    assert_eq!(h, h2);
}

#[test]
fn test_hash_blake3() {
    let h = utils::hash(b"hello", "blake3").unwrap();
    assert_eq!(h.len(), 64);
}

#[test]
fn test_hash_unknown_mode() {
    let result = utils::hash(b"hello", "md5");
    assert!(result.is_err());
}

#[test]
fn test_hash_empty_data() {
    let h = utils::hash(b"", "sha256").unwrap();
    assert_eq!(h.len(), 64);
    // Known SHA256 of ""
    assert_eq!(h, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
}

#[test]
fn test_hash_deterministic() {
    let h1 = utils::hash(b"test data", "sha256").unwrap();
    let h2 = utils::hash(b"test data", "sha256").unwrap();
    assert_eq!(h1, h2);
}

#[test]
fn test_find_free_port() {
    let port = utils::find_free_port((49152, 65535)).unwrap();
    assert!(port >= 49152);
}

#[test]
fn test_is_port_used() {
    // Bind a port, check it's used
    let listener = std::net::TcpListener::bind("0.0.0.0:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    assert!(utils::is_port_used(port));
    drop(listener);
}

#[test]
fn test_system_info() {
    let info = utils::system_info();
    assert!(info.get("os").is_some());
    assert!(info.get("arch").is_some());
    assert!(info.get("cpu_count").is_some());
    assert!(info.get("total_memory").is_some());
    assert!(info.get("used_memory").is_some());
    assert!(info.get("available_memory").is_some());
    assert!(info["cpu_count"].as_u64().unwrap() > 0);
    assert!(info["total_memory"].as_u64().unwrap() > 0);
}

// ============================================================================
// KEY TYPE TESTS
// ============================================================================

#[test]
fn test_key_type_from_str() {
    assert_eq!(KeyType::from_str("secp256k1").unwrap(), KeyType::Secp256k1);
    assert_eq!(KeyType::from_str("ecdsa").unwrap(), KeyType::Secp256k1);
    assert_eq!(KeyType::from_str("eth").unwrap(), KeyType::Secp256k1);
    assert_eq!(KeyType::from_str("ed25519").unwrap(), KeyType::Ed25519);
    assert_eq!(KeyType::from_str("sr25519").unwrap(), KeyType::Sr25519);
    assert_eq!(KeyType::from_str("sub").unwrap(), KeyType::Sr25519);
    assert_eq!(KeyType::from_str("substrate").unwrap(), KeyType::Sr25519);
    assert_eq!(KeyType::from_str("dot").unwrap(), KeyType::Sr25519);
    assert_eq!(KeyType::from_str("solana").unwrap(), KeyType::Solana);
    assert_eq!(KeyType::from_str("sol").unwrap(), KeyType::Solana);
    assert!(KeyType::from_str("unknown").is_err());
}

#[test]
fn test_key_type_as_str() {
    assert_eq!(KeyType::Secp256k1.as_str(), "secp256k1");
    assert_eq!(KeyType::Ed25519.as_str(), "ed25519");
    assert_eq!(KeyType::Sr25519.as_str(), "sr25519");
    assert_eq!(KeyType::Solana.as_str(), "solana");
}

#[test]
fn test_key_type_display() {
    assert_eq!(format!("{}", KeyType::Secp256k1), "secp256k1");
    assert_eq!(format!("{}", KeyType::Ed25519), "ed25519");
    assert_eq!(format!("{}", KeyType::Sr25519), "sr25519");
    assert_eq!(format!("{}", KeyType::Solana), "solana");
}

#[test]
fn test_key_type_case_insensitive() {
    assert_eq!(KeyType::from_str("SECP256K1").unwrap(), KeyType::Secp256k1);
    assert_eq!(KeyType::from_str("Ed25519").unwrap(), KeyType::Ed25519);
    assert_eq!(KeyType::from_str("SOLANA").unwrap(), KeyType::Solana);
}

// ============================================================================
// SECP256K1 KEY TESTS
// ============================================================================

#[test]
fn test_secp256k1_generate() {
    let key = KeyPair::generate().unwrap();
    assert_eq!(key.key_type(), KeyType::Secp256k1);
}

#[test]
fn test_secp256k1_address_format() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    let addr = key.address();
    assert!(addr.starts_with("0x"));
    assert_eq!(addr.len(), 42);
    assert!(addr[2..].chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_secp256k1_ethereum_address_alias() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    assert_eq!(key.address(), key.ethereum_address());
}

#[test]
fn test_secp256k1_private_key_hex() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    let hex = key.private_key_hex();
    assert!(hex.starts_with("0x"));
    assert_eq!(hex.len(), 66); // 0x + 64 hex chars = 32 bytes
}

#[test]
fn test_secp256k1_public_key_hex() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    let hex = key.public_key_hex();
    assert!(hex.starts_with("0x"));
    // Uncompressed secp256k1 public key: 65 bytes (04 prefix + 64 bytes)
    assert_eq!(hex.len(), 132); // 0x + 130 hex chars
}

#[test]
fn test_secp256k1_sign_json() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    let data = json!({"message": "hello"});
    let sig = key.sign(&data).unwrap();
    assert!(!sig.r.is_empty());
    assert!(!sig.s.is_empty());
    assert_eq!(sig.v, 27);
    assert_eq!(sig.r.len(), 64); // 32 bytes
    assert_eq!(sig.s.len(), 64); // 32 bytes
}

#[test]
fn test_secp256k1_sign_bytes() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    let sig = key.sign_bytes(b"test data").unwrap();
    assert_eq!(sig.len(), 64); // 32+32 bytes for r+s
}

#[test]
fn test_secp256k1_roundtrip() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    let hex = key.private_key_hex();
    let restored = KeyPair::from_private_key(&hex).unwrap();
    assert_eq!(key.address(), restored.address());
    assert_eq!(key.public_key_hex(), restored.public_key_hex());
}

#[test]
fn test_secp256k1_different_keys_different_addresses() {
    let k1 = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    let k2 = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    assert_ne!(k1.address(), k2.address());
}

// ============================================================================
// ED25519 KEY TESTS
// ============================================================================

#[test]
fn test_ed25519_generate() {
    let key = KeyPair::generate_for(KeyType::Ed25519).unwrap();
    assert_eq!(key.key_type(), KeyType::Ed25519);
}

#[test]
fn test_ed25519_address_format() {
    let key = KeyPair::generate_for(KeyType::Ed25519).unwrap();
    let addr = key.address();
    assert!(addr.starts_with("0x"));
    assert_eq!(addr.len(), 66); // 0x + 64 hex = 32 bytes
}

#[test]
fn test_ed25519_sign_and_verify_bytes() {
    let key = KeyPair::generate_for(KeyType::Ed25519).unwrap();
    let msg = b"hello ed25519";
    let sig = key.sign_bytes(msg).unwrap();
    assert_eq!(sig.len(), 64);
    assert!(key.verify_bytes(msg, &sig).unwrap());
}

#[test]
fn test_ed25519_sign_json() {
    let key = KeyPair::generate_for(KeyType::Ed25519).unwrap();
    let data = json!({"test": 42});
    let sig = key.sign(&data).unwrap();
    assert!(!sig.r.is_empty());
    assert!(!sig.s.is_empty());
    assert_eq!(sig.v, 0);
}

#[test]
fn test_ed25519_verify_wrong_data() {
    let key = KeyPair::generate_for(KeyType::Ed25519).unwrap();
    let sig = key.sign_bytes(b"correct data").unwrap();
    assert!(!key.verify_bytes(b"wrong data", &sig).unwrap());
}

#[test]
fn test_ed25519_roundtrip() {
    let key = KeyPair::generate_for(KeyType::Ed25519).unwrap();
    let hex = key.private_key_hex();
    let restored = KeyPair::from_private_key_with_type(&hex, KeyType::Ed25519).unwrap();
    assert_eq!(key.address(), restored.address());
    assert_eq!(key.public_key_hex(), restored.public_key_hex());
}

// ============================================================================
// SR25519 KEY TESTS
// ============================================================================

#[test]
fn test_sr25519_generate() {
    let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
    assert_eq!(key.key_type(), KeyType::Sr25519);
}

#[test]
fn test_sr25519_address_ss58() {
    let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
    let addr = key.address();
    // Generic SS58 (prefix 42) starts with '5'
    assert!(addr.starts_with('5'));
    assert!(addr.len() >= 46 && addr.len() <= 48);
}

#[test]
fn test_sr25519_substrate_address() {
    let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
    let addr = key.substrate_address(42).unwrap();
    assert!(addr.starts_with('5'));
}

#[test]
fn test_sr25519_substrate_address_polkadot() {
    let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
    let addr0 = key.substrate_address(0).unwrap();
    let addr42 = key.substrate_address(42).unwrap();
    // Different prefixes should yield different addresses
    assert_ne!(addr0, addr42);
}

#[test]
fn test_sr25519_substrate_address_wrong_type() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    assert!(key.substrate_address(42).is_err());
}

#[test]
fn test_sr25519_sign_and_verify_bytes() {
    let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
    let msg = b"hello substrate";
    let sig = key.sign_bytes(msg).unwrap();
    assert!(key.verify_bytes(msg, &sig).unwrap());
}

#[test]
fn test_sr25519_sign_json() {
    let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
    let data = json!({"chain": "polkadot"});
    let sig = key.sign(&data).unwrap();
    assert!(!sig.r.is_empty());
    assert!(!sig.s.is_empty());
    assert_eq!(sig.v, 0);
}

#[test]
fn test_sr25519_roundtrip() {
    let key = KeyPair::generate_for(KeyType::Sr25519).unwrap();
    let hex = key.private_key_hex();
    let restored = KeyPair::from_private_key_with_type(&hex, KeyType::Sr25519).unwrap();
    assert_eq!(key.public_key_hex(), restored.public_key_hex());
}

// ============================================================================
// SOLANA KEY TESTS
// ============================================================================

#[test]
fn test_solana_generate() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    assert_eq!(key.key_type(), KeyType::Solana);
}

#[test]
fn test_solana_address_base58() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    let addr = key.address();
    // Solana addresses are 32-44 base58 chars
    assert!(addr.len() >= 32 && addr.len() <= 44);
    // Must be valid base58
    assert!(bs58::decode(&addr).into_vec().is_ok());
}

#[test]
fn test_solana_address_method() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    let addr1 = key.address();
    let addr2 = key.solana_address().unwrap();
    assert_eq!(addr1, addr2);
}

#[test]
fn test_solana_address_wrong_type() {
    let key = KeyPair::generate_for(KeyType::Secp256k1).unwrap();
    assert!(key.solana_address().is_err());
}

#[test]
fn test_solana_sign_and_verify_bytes() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    let msg = b"hello solana";
    let sig = key.sign_bytes(msg).unwrap();
    assert_eq!(sig.len(), 64);
    assert!(key.verify_bytes(msg, &sig).unwrap());
}

#[test]
fn test_solana_sign_json() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    let data = json!({"tx": "transfer"});
    let sig = key.sign(&data).unwrap();
    assert!(!sig.r.is_empty());
    assert!(!sig.s.is_empty());
    assert_eq!(sig.v, 0);
}

#[test]
fn test_solana_base58_import_roundtrip() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    let addr = key.address();

    // Build the 64-byte keypair (secret + public)
    let secret = hex::decode(key.private_key_hex().strip_prefix("0x").unwrap()).unwrap();
    let public = hex::decode(key.public_key_hex().strip_prefix("0x").unwrap()).unwrap();
    let mut full = secret;
    full.extend_from_slice(&public);
    let b58 = bs58::encode(&full).into_string();

    let restored = KeyPair::from_solana_base58(&b58).unwrap();
    assert_eq!(restored.address(), addr);
    assert_eq!(restored.key_type(), KeyType::Solana);
}

#[test]
fn test_solana_roundtrip() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    let hex = key.private_key_hex();
    let restored = KeyPair::from_private_key_with_type(&hex, KeyType::Solana).unwrap();
    assert_eq!(key.address(), restored.address());
}

#[test]
fn test_is_valid_solana_address() {
    let key = KeyPair::generate_for(KeyType::Solana).unwrap();
    assert!(solana::is_valid_solana_address(&key.address()));
    assert!(!solana::is_valid_solana_address("not_valid"));
    assert!(!solana::is_valid_solana_address("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"));
}

// ============================================================================
// CROSS-TYPE KEY TESTS
// ============================================================================

#[test]
fn test_all_types_generate_and_sign() {
    let data = json!({"universal": "test"});
    for kt in [KeyType::Secp256k1, KeyType::Ed25519, KeyType::Sr25519, KeyType::Solana] {
        let key = KeyPair::generate_for(kt).unwrap();
        assert_eq!(key.key_type(), kt);
        let sig = key.sign(&data).unwrap();
        assert!(!sig.r.is_empty());
        assert!(!sig.s.is_empty());
    }
}

#[test]
fn test_all_types_private_key_roundtrip() {
    for kt in [KeyType::Secp256k1, KeyType::Ed25519, KeyType::Sr25519, KeyType::Solana] {
        let key = KeyPair::generate_for(kt).unwrap();
        let hex = key.private_key_hex();
        assert!(hex.starts_with("0x"));
        let restored = KeyPair::from_private_key_with_type(&hex, kt).unwrap();
        assert_eq!(key.public_key_hex(), restored.public_key_hex());
    }
}

#[test]
fn test_all_types_encryption() {
    let plaintext = b"encrypt me across all key types";
    for kt in [KeyType::Secp256k1, KeyType::Ed25519, KeyType::Sr25519, KeyType::Solana] {
        let key = KeyPair::generate_for(kt).unwrap();
        let encrypted = key.encrypt(plaintext).unwrap();
        assert_ne!(&encrypted, plaintext);
        let decrypted = key.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }
}

#[test]
fn test_generate_with_algorithm_string() {
    let k1 = KeyPair::generate_with_algorithm("secp256k1").unwrap();
    assert_eq!(k1.key_type(), KeyType::Secp256k1);

    let k2 = KeyPair::generate_with_algorithm("ed25519").unwrap();
    assert_eq!(k2.key_type(), KeyType::Ed25519);

    let k3 = KeyPair::generate_with_algorithm("sr25519").unwrap();
    assert_eq!(k3.key_type(), KeyType::Sr25519);

    let k4 = KeyPair::generate_with_algorithm("solana").unwrap();
    assert_eq!(k4.key_type(), KeyType::Solana);

    assert!(KeyPair::generate_with_algorithm("rsa").is_err());
}

#[test]
fn test_detect_address_type() {
    use modrs::key::detect_address_type;
    assert_eq!(detect_address_type("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"), KeyType::Secp256k1);

    let sol_key = KeyPair::generate_for(KeyType::Solana).unwrap();
    assert_eq!(detect_address_type(&sol_key.address()), KeyType::Solana);
}

#[test]
fn test_from_private_key_invalid_hex() {
    assert!(KeyPair::from_private_key("not_hex").is_err());
    assert!(KeyPair::from_private_key("0xZZZZ").is_err());
}

#[test]
fn test_from_private_key_wrong_length() {
    assert!(KeyPair::from_private_key("0xabcd").is_err()); // too short
}

// ============================================================================
// AES ENCRYPTION TESTS
// ============================================================================

#[test]
fn test_aes_encrypt_decrypt_derived() {
    let key = [42u8; 32];
    let plaintext = b"secret message";
    let encrypted = AesKey::encrypt_with_derived(&key, plaintext).unwrap();
    assert_ne!(&encrypted, plaintext);
    let decrypted = AesKey::decrypt_with_derived(&key, &encrypted).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_aes_encrypt_decrypt_key() {
    let key = b"my raw key bytes for encryption!";
    let plaintext = b"test data";
    let encrypted = AesKey::encrypt_with_key(key, plaintext).unwrap();
    let decrypted = AesKey::decrypt_with_key(key, &encrypted).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_aes_encrypt_decrypt_password() {
    let password = "strong_password_123";
    let plaintext = b"sensitive info";
    let encrypted = AesKey::encrypt_with_password(password, plaintext).unwrap();
    let decrypted = AesKey::decrypt_with_password(password, &encrypted).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_aes_wrong_password_fails() {
    let plaintext = b"secret";
    let encrypted = AesKey::encrypt_with_password("correct", plaintext).unwrap();
    assert!(AesKey::decrypt_with_password("wrong", &encrypted).is_err());
}

#[test]
fn test_aes_different_nonces() {
    let key = [1u8; 32];
    let plaintext = b"test";
    let e1 = AesKey::encrypt_with_derived(&key, plaintext).unwrap();
    let e2 = AesKey::encrypt_with_derived(&key, plaintext).unwrap();
    // Same plaintext + key should produce different ciphertext (random nonce)
    assert_ne!(e1, e2);
}

#[test]
fn test_aes_decrypt_too_short() {
    let key = [0u8; 32];
    assert!(AesKey::decrypt_with_derived(&key, &[0u8; 5]).is_err());
}

#[test]
fn test_aes_empty_data() {
    let key = [99u8; 32];
    let encrypted = AesKey::encrypt_with_derived(&key, b"").unwrap();
    let decrypted = AesKey::decrypt_with_derived(&key, &encrypted).unwrap();
    assert_eq!(decrypted, b"");
}

#[test]
fn test_aes_large_data() {
    let key = [7u8; 32];
    let plaintext = vec![0xABu8; 1_000_000]; // 1MB
    let encrypted = AesKey::encrypt_with_derived(&key, &plaintext).unwrap();
    let decrypted = AesKey::decrypt_with_derived(&key, &encrypted).unwrap();
    assert_eq!(decrypted, plaintext);
}

// ============================================================================
// ECDSA HELPER TESTS
// ============================================================================

#[test]
fn test_is_ethereum_address() {
    assert!(ecdsa::is_ethereum_address("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"));
    assert!(ecdsa::is_ethereum_address("0x0000000000000000000000000000000000000000"));
    assert!(!ecdsa::is_ethereum_address("not_an_address"));
    assert!(!ecdsa::is_ethereum_address("0x742d35")); // too short
    assert!(!ecdsa::is_ethereum_address("742d35Cc6634C0532925a3b844Bc9e7595f2bD18")); // no 0x
    assert!(!ecdsa::is_ethereum_address("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")); // invalid hex
}

#[test]
fn test_ethereum_message_hash() {
    let h = ecdsa::ethereum_message_hash(b"hello");
    assert_eq!(h.len(), 32);
    // Deterministic
    let h2 = ecdsa::ethereum_message_hash(b"hello");
    assert_eq!(h, h2);
    // Different message = different hash
    let h3 = ecdsa::ethereum_message_hash(b"world");
    assert_ne!(h, h3);
}

// ============================================================================
// SQLITE STORE TESTS
// ============================================================================

#[test]
fn test_sqlite_put_get() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    store.put("key1", &json!("value1")).unwrap();
    let val: Option<serde_json::Value> = store.get("key1").unwrap();
    assert_eq!(val, Some(json!("value1")));
}

#[test]
fn test_sqlite_put_get_complex() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    let data = json!({"name": "test", "count": 42, "nested": {"a": [1,2,3]}});
    store.put("complex", &data).unwrap();
    let val: Option<serde_json::Value> = store.get("complex").unwrap();
    assert_eq!(val, Some(data));
}

#[test]
fn test_sqlite_get_missing() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    let val: Option<serde_json::Value> = store.get("nonexistent").unwrap();
    assert!(val.is_none());
}

#[test]
fn test_sqlite_put_overwrite() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    store.put("key", &json!("v1")).unwrap();
    store.put("key", &json!("v2")).unwrap();
    let val: Option<serde_json::Value> = store.get("key").unwrap();
    assert_eq!(val, Some(json!("v2")));
}

#[test]
fn test_sqlite_delete() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    store.put("key", &json!("value")).unwrap();
    assert!(store.exists("key").unwrap());
    store.delete("key").unwrap();
    assert!(!store.exists("key").unwrap());
}

#[test]
fn test_sqlite_exists() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    assert!(!store.exists("key").unwrap());
    store.put("key", &json!(true)).unwrap();
    assert!(store.exists("key").unwrap());
}

#[test]
fn test_sqlite_keys() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    store.put("b", &json!(2)).unwrap();
    store.put("a", &json!(1)).unwrap();
    store.put("c", &json!(3)).unwrap();

    let keys = store.keys().unwrap();
    assert_eq!(keys, vec!["a", "b", "c"]); // sorted
}

#[test]
fn test_sqlite_count() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    assert_eq!(store.count().unwrap(), 0);
    store.put("a", &json!(1)).unwrap();
    assert_eq!(store.count().unwrap(), 1);
    store.put("b", &json!(2)).unwrap();
    assert_eq!(store.count().unwrap(), 2);
    store.delete("a").unwrap();
    assert_eq!(store.count().unwrap(), 1);
}

#[test]
fn test_sqlite_clear() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    store.put("a", &json!(1)).unwrap();
    store.put("b", &json!(2)).unwrap();
    assert_eq!(store.count().unwrap(), 2);
    store.clear().unwrap();
    assert_eq!(store.count().unwrap(), 0);
}

#[test]
fn test_sqlite_put_get_bytes() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    let data = vec![0u8, 1, 2, 3, 255];
    store.put_bytes("binary", &data).unwrap();
    let result = store.get_bytes("binary").unwrap();
    assert_eq!(result, Some(data));
}

#[test]
fn test_sqlite_get_bytes_missing() {
    let dir = TempDir::new().unwrap();
    let store = SqliteStore::new(&dir.path().to_path_buf()).unwrap();

    let result = store.get_bytes("missing").unwrap();
    assert!(result.is_none());
}

// ============================================================================
// IPFS STORE TESTS (unit - no daemon required)
// ============================================================================

#[test]
fn test_ipfs_config_default() {
    let config = IpfsConfig::default();
    assert_eq!(config.endpoint, "http://127.0.0.1:5001");
    assert_eq!(config.gateway, "http://127.0.0.1:8080");
    assert!(config.pin_by_default);
}

#[test]
fn test_ipfs_store_url() {
    let store = IpfsStore::new(&IpfsConfig::default());
    let url = store.url("QmTest123");
    assert_eq!(url, "http://127.0.0.1:8080/ipfs/QmTest123");
}

#[test]
fn test_ipfs_store_endpoint() {
    let config = IpfsConfig {
        endpoint: "http://custom:5001".to_string(),
        gateway: "http://custom:8080".to_string(),
        pin_by_default: false,
    };
    let store = IpfsStore::new(&config);
    assert_eq!(store.endpoint(), "http://custom:5001");
}

// ============================================================================
// STORE CREATION TESTS
// ============================================================================

#[test]
fn test_create_store() {
    let (_dir, config) = temp_config();
    let store = create_store(&config).unwrap();
    // Should be able to use the store
    store.kv.put("test", &json!("works")).unwrap();
    let val: Option<serde_json::Value> = store.kv.get("test").unwrap();
    assert_eq!(val, Some(json!("works")));
}

// ============================================================================
// MODULE SYSTEM TESTS
// ============================================================================

#[tokio::test]
async fn test_module_registry_create_and_list() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    // Create a module
    let path = registry.create("test_mod", Some("A test module")).unwrap();
    assert!(path.exists());
    assert!(path.join("mod.rs").exists());

    // List should include it
    let mods = registry.list().await.unwrap();
    assert!(mods.contains(&"test_mod".to_string()));
}

#[tokio::test]
async fn test_module_registry_create_duplicate() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("dup_mod", None).unwrap();
    assert!(registry.create("dup_mod", None).is_err());
}

#[tokio::test]
async fn test_module_registry_exists() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    assert!(!registry.exists("mymod").await);
    registry.create("mymod", None).unwrap();
    assert!(registry.exists("mymod").await);
}

#[tokio::test]
async fn test_module_registry_load() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("loadable", Some("A loadable module")).unwrap();
    let module = registry.load("loadable").await.unwrap();
    let info = module.info().await.unwrap();
    assert_eq!(info.name, "loadable");
    assert!(info.description.is_some());
}

#[tokio::test]
async fn test_module_registry_load_not_found() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    assert!(registry.load("nonexistent").await.is_err());
}

#[tokio::test]
async fn test_module_functions() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("func_mod", None).unwrap();
    let module = registry.load("func_mod").await.unwrap();
    let fns = module.functions().await.unwrap();
    // Default scaffold has: info, forward
    assert!(fns.contains(&"info".to_string()));
    assert!(fns.contains(&"forward".to_string()));
}

#[tokio::test]
async fn test_module_code() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("code_mod", Some("Test code retrieval")).unwrap();
    let module = registry.load("code_mod").await.unwrap();
    let code = module.code().await.unwrap();
    assert!(code.contains("pub struct CodeMod"));
    assert!(code.contains("Test code retrieval"));
}

#[tokio::test]
async fn test_module_call() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("call_mod", None).unwrap();
    let module = registry.load("call_mod").await.unwrap();

    let result = module.call("info", json!({})).await.unwrap();
    assert_eq!(result["module"], "call_mod");
    assert_eq!(result["function"], "info");
    assert_eq!(result["status"], "ok");
}

#[tokio::test]
async fn test_module_call_unknown_function() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("err_mod", None).unwrap();
    let module = registry.load("err_mod").await.unwrap();

    assert!(module.call("nonexistent_fn", json!({})).await.is_err());
}

#[tokio::test]
async fn test_module_remove() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("rm_mod", None).unwrap();
    assert!(registry.exists("rm_mod").await);
    registry.remove("rm_mod").unwrap();
    assert!(!registry.exists("rm_mod").await);
}

#[tokio::test]
async fn test_module_dirpath() {
    let (_dir, config) = temp_config();
    let registry = ModuleRegistry::new(&config).await.unwrap();

    registry.create("path_mod", None).unwrap();
    let path = registry.dirpath("path_mod").await.unwrap();
    assert!(path.exists());
    assert!(path.join("mod.rs").exists());
}

// ============================================================================
// SERVER MANAGER TESTS
// ============================================================================

#[test]
fn test_server_manager_new() {
    let manager = ServerManager::new();
    assert!(!manager.is_running("test"));
    assert!(manager.list().is_empty());
}

#[tokio::test]
async fn test_server_manager_stop_not_running() {
    let mut manager = ServerManager::new();
    assert!(manager.stop("nonexistent").await.is_err());
}

// ============================================================================
// KEY MANAGER TESTS
// ============================================================================

#[tokio::test]
async fn test_key_manager_get_default() {
    let (_dir, config) = temp_config();
    let km = KeyManager::new(&config).unwrap();

    let key = km.get(None).await.unwrap();
    assert_eq!(key.key_type(), KeyType::Secp256k1); // default algorithm
    let addr = key.address();
    assert!(addr.starts_with("0x"));
}

#[tokio::test]
async fn test_key_manager_get_named() {
    let (_dir, config) = temp_config();
    let km = KeyManager::new(&config).unwrap();

    let key = km.get(Some("mykey")).await.unwrap();
    // Getting the same name again should return same key
    let key2 = km.get(Some("mykey")).await.unwrap();
    assert_eq!(key.address(), key2.address());
}

#[tokio::test]
async fn test_key_manager_different_names() {
    let (_dir, config) = temp_config();
    let km = KeyManager::new(&config).unwrap();

    let k1 = km.get(Some("alice")).await.unwrap();
    let k2 = km.get(Some("bob")).await.unwrap();
    assert_ne!(k1.address(), k2.address());
}

#[tokio::test]
async fn test_key_manager_get_typed() {
    let (_dir, config) = temp_config();
    let km = KeyManager::new(&config).unwrap();

    let key = km.get_typed("mykey", KeyType::Ed25519).await.unwrap();
    assert_eq!(key.key_type(), KeyType::Ed25519);
}

#[tokio::test]
async fn test_key_manager_list() {
    let (_dir, config) = temp_config();
    let km = KeyManager::new(&config).unwrap();

    km.get(Some("key_a")).await.unwrap();
    km.get(Some("key_b")).await.unwrap();

    let keys = km.list().await.unwrap();
    assert!(keys.contains(&"key_a".to_string()));
    assert!(keys.contains(&"key_b".to_string()));
}

#[tokio::test]
async fn test_key_manager_persistence() {
    let dir = TempDir::new().unwrap();
    let base = dir.path().to_path_buf();

    let mut config = Config::default();
    config.crypto.key_storage_path = base.join("keys");

    // Create a key
    let km1 = KeyManager::new(&config).unwrap();
    let key1 = km1.get(Some("persist")).await.unwrap();
    let addr1 = key1.address();

    // New manager, same path — should load the same key
    let km2 = KeyManager::new(&config).unwrap();
    let key2 = km2.get(Some("persist")).await.unwrap();
    assert_eq!(key2.address(), addr1);
}

// ============================================================================
// TOP-LEVEL MOD API TESTS
// ============================================================================

#[tokio::test]
async fn test_mod_with_config() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    // Check time
    let t = m.time();
    assert!(t > 0);
}

#[tokio::test]
async fn test_mod_hash() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    let h = m.hash(b"test", "sha256").unwrap();
    assert_eq!(h.len(), 64);
}

#[tokio::test]
async fn test_mod_create_and_call() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    m.create_mod("testmod", Some("Test module")).unwrap();
    assert!(m.mod_exists("testmod").await);

    let result = m.call("testmod/info", json!({})).await.unwrap();
    assert_eq!(result["module"], "testmod");
    assert_eq!(result["status"], "ok");
}

#[tokio::test]
async fn test_mod_call_invalid_path() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    assert!(m.call("invalid", json!({})).await.is_err());
    assert!(m.call("a/b/c", json!({})).await.is_err());
}

#[tokio::test]
async fn test_mod_mods_list() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    m.create_mod("list_a", None).unwrap();
    m.create_mod("list_b", None).unwrap();

    let mods = m.mods().await.unwrap();
    assert!(mods.contains(&"list_a".to_string()));
    assert!(mods.contains(&"list_b".to_string()));
}

#[tokio::test]
async fn test_mod_info() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    m.create_mod("info_mod", Some("Info test")).unwrap();
    let info = m.info("info_mod").await.unwrap();
    assert_eq!(info.name, "info_mod");
    assert!(info.description.is_some());
}

#[tokio::test]
async fn test_mod_code() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    m.create_mod("code_mod2", None).unwrap();
    let code = m.code("code_mod2").await.unwrap();
    assert!(code.contains("pub struct CodeMod2"));
}

#[tokio::test]
async fn test_mod_dirpath() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    m.create_mod("dp_mod", None).unwrap();
    let path = m.dirpath("dp_mod").await.unwrap();
    assert!(path.exists());
}

#[tokio::test]
async fn test_mod_remove_mod() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    m.create_mod("rm_mod2", None).unwrap();
    assert!(m.mod_exists("rm_mod2").await);
    m.remove_mod("rm_mod2").unwrap();
    assert!(!m.mod_exists("rm_mod2").await);
}

#[tokio::test]
async fn test_mod_key_operations() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    // Get default key
    let key = m.key(None).await.unwrap();
    assert!(key.address().starts_with("0x"));

    // Get address
    let addr = m.address(None).await.unwrap();
    assert_eq!(addr, key.address());

    // Sign and verify
    let data = json!({"test": true});
    let sig = m.sign(&data, None).await.unwrap();
    let verified = m.verify(&data, &sig, &addr).await.unwrap();
    assert!(verified);
}

#[tokio::test]
async fn test_mod_encrypt_decrypt() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    let plaintext = b"top secret";
    let encrypted = m.encrypt(plaintext, None).await.unwrap();
    let decrypted = m.decrypt(&encrypted, None).await.unwrap();
    assert_eq!(decrypted, plaintext);
}

#[tokio::test]
async fn test_mod_keys_list() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    m.key(Some("test_key")).await.unwrap();
    let keys = m.keys().await.unwrap();
    assert!(keys.contains(&"test_key".to_string()));
}

#[tokio::test]
async fn test_mod_store_operations() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    // Put
    m.put("key1", &json!("value1"), false).unwrap();

    // Get
    let val = m.get("key1", false).unwrap();
    assert_eq!(val, Some(json!("value1")));

    // Delete
    m.delete("key1").unwrap();
    let val = m.get("key1", false).unwrap();
    assert!(val.is_none());
}

#[tokio::test]
async fn test_mod_store_access() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    // Access underlying store
    let store = m.store();
    store.kv.put("direct", &json!("access")).unwrap();
    let val: Option<serde_json::Value> = store.kv.get("direct").unwrap();
    assert_eq!(val, Some(json!("access")));
}

#[tokio::test]
async fn test_mod_ipfs_url() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    let url = m.ipfs_url("QmTestCid");
    assert!(url.contains("QmTestCid"));
}

#[tokio::test]
async fn test_mod_server_operations() {
    let (_dir, config) = temp_config();
    let m = Mod::with_config(config).await.unwrap();

    assert!(!m.server_exists("test").await);
    assert!(m.servers().await.is_empty());
}

#[tokio::test]
async fn test_mod_config_access() {
    let (_dir, config) = temp_config();
    let expected_name = config.name.clone();
    let m = Mod::with_config(config).await.unwrap();
    assert_eq!(m.config().name, expected_name);
}

// ============================================================================
// GIT TESTS (no actual repo needed for list_repos on empty dir)
// ============================================================================

#[tokio::test]
async fn test_git_list_repos_empty() {
    let dir = TempDir::new().unwrap();
    let repos = modrs::git::list_repos(dir.path()).await.unwrap();
    assert!(repos.is_empty());
}

#[tokio::test]
async fn test_git_list_repos_finds_repos() {
    let dir = TempDir::new().unwrap();
    // Create a fake repo directory
    let repo_dir = dir.path().join("fake_repo");
    std::fs::create_dir_all(repo_dir.join(".git")).unwrap();

    let repos = modrs::git::list_repos(dir.path()).await.unwrap();
    assert_eq!(repos, vec!["fake_repo"]);
}

// ============================================================================
// SIGNATURE SERIALIZATION TESTS
// ============================================================================

#[test]
fn test_signature_serialization() {
    let sig = Signature {
        r: "abcd".to_string(),
        s: "1234".to_string(),
        v: 27,
    };
    let json = serde_json::to_string(&sig).unwrap();
    let restored: Signature = serde_json::from_str(&json).unwrap();
    assert_eq!(restored.r, sig.r);
    assert_eq!(restored.s, sig.s);
    assert_eq!(restored.v, sig.v);
}

// ============================================================================
// MODULE INFO SERIALIZATION
// ============================================================================

#[test]
fn test_module_info_serialization() {
    let info = ModuleInfo {
        name: "test".to_string(),
        version: "1.0.0".to_string(),
        description: Some("A test module".to_string()),
        path: PathBuf::from("/tmp/test"),
        functions: vec!["hello".to_string(), "world".to_string()],
    };
    let json = serde_json::to_value(&info).unwrap();
    assert_eq!(json["name"], "test");
    assert_eq!(json["version"], "1.0.0");
    assert_eq!(json["functions"].as_array().unwrap().len(), 2);
}

// ============================================================================
// SERVER INFO SERIALIZATION
// ============================================================================

#[test]
fn test_server_info_serialization() {
    let info = ServerInfo {
        name: "api".to_string(),
        port: 8080,
        pid: None,
        url: "http://0.0.0.0:8080".to_string(),
    };
    let json = serde_json::to_value(&info).unwrap();
    assert_eq!(json["name"], "api");
    assert_eq!(json["port"], 8080);
    assert_eq!(json["url"], "http://0.0.0.0:8080");
}
