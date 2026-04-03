use near_sdk::{near, env, AccountId, BorshStorageKey, PanicOnDefault, store::LookupMap};
use ed25519_dalek::{Signature as Ed25519Sig, VerifyingKey, Verifier};
use k256::ecdsa::{RecoveryId, Signature as EcdsaSig, VerifyingKey as EcdsaKey};
use sha3::{Keccak256, Digest};

// ── Address type ─────────────────────────────────────────────────────────────

/// Which chain the "from" address belongs to.
/// Determines which signature scheme to use.
#[near(serializers = [json, borsh])]
#[derive(Clone, PartialEq)]
pub enum AddrType {
    /// NEAR account ID (e.g. "alice.near") — ed25519, pubkey stored separately
    Near,
    /// Solana address (base58 pubkey, e.g. "9xQeWvG...") — ed25519, address IS pubkey
    Solana,
    /// Ethereum address (hex, e.g. "0xabc123...") — secp256k1, recover from sig
    Ethereum,
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[derive(BorshStorageKey)]
#[near]
enum SK {
    Balances,
    BalancesInner { key: String },
    /// ed25519 pubkeys for NEAR accounts (Solana doesn't need this — pubkey IS the address)
    NearPubkeys,
    Nonces,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Token {
    /// composite key: "{addr_type}:{address}" → (token_type → balance)
    balances: LookupMap<String, LookupMap<String, u128>>,

    /// NEAR account → ed25519 pubkey bytes (32 bytes)
    /// Solana: not needed (pubkey is the address itself, decoded from base58)
    /// Ethereum: not needed (recovered from signature)
    near_pubkeys: LookupMap<AccountId, Vec<u8>>,

    /// "{addr_type}:{address}" → nonce
    nonces: LookupMap<String, u64>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn account_key(addr_type: &AddrType, address: &str) -> String {
    match addr_type {
        AddrType::Near     => format!("near:{}", address),
        AddrType::Solana   => format!("sol:{}", address),
        AddrType::Ethereum => format!("eth:{}", address.to_lowercase()),
    }
}

/// Ethereum personal_sign prefix: "\x19Ethereum Signed Message:\n{len}{msg}"
fn eth_prefixed_hash(msg: &[u8]) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", msg.len());
    let mut hasher = Keccak256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(msg);
    hasher.finalize().into()
}

/// Derive Ethereum address from uncompressed public key bytes (65 bytes, 0x04 prefix)
fn eth_address_from_pubkey(pubkey_bytes: &[u8]) -> String {
    // Skip the 0x04 prefix byte, hash the remaining 64 bytes
    let mut hasher = Keccak256::new();
    hasher.update(&pubkey_bytes[1..]);
    let hash: [u8; 32] = hasher.finalize().into();
    // Take last 20 bytes → Ethereum address
    format!("0x{}", hex::encode(&hash[12..]))
}

// ── Contract impl ─────────────────────────────────────────────────────────────

#[near]
impl Token {
    #[init]
    pub fn new() -> Self {
        Self {
            balances: LookupMap::new(SK::Balances),
            near_pubkeys: LookupMap::new(SK::NearPubkeys),
            nonces: LookupMap::new(SK::Nonces),
        }
    }

    // ── Key registration (NEAR only) ─────────────────────────────────────────

    /// NEAR accounts must register their ed25519 pubkey (hex-encoded, 32 bytes).
    /// Solana: no registration needed — the address itself IS the pubkey (base58).
    /// Ethereum: no registration needed — address is recovered from each signature.
    pub fn register_near_key(&mut self, pubkey_hex: String) {
        let caller = env::predecessor_account_id();
        let bytes = hex::decode(&pubkey_hex)
            .unwrap_or_else(|_| env::panic_str("invalid hex"));
        assert_eq!(bytes.len(), 32, "pubkey must be 32 bytes");
        self.near_pubkeys.insert(caller, bytes);
    }

    // ── Mint ─────────────────────────────────────────────────────────────────

    pub fn mint(
        &mut self,
        addr_type: AddrType,
        address: String,
        token_type: String,
        amount: u128,
    ) {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "only owner"
        );
        let k = account_key(&addr_type, &address);
        let cur = self.get_bal(&k, &token_type);
        self.set_bal(&k, &token_type, cur + amount);
    }

    // ── Signature-gated transfer ──────────────────────────────────────────────

    /// Universal transfer. The signed message format is always:
    ///   `"transfer:{from_type}:{from}:{to_type}:{to}:{token_type}:{amount}:{nonce}"`
    ///
    /// For Ethereum, the message is additionally wrapped with the personal_sign prefix
    /// before hashing (MetaMask does this automatically when you call eth_sign).
    ///
    /// `signature_hex`:
    ///   - NEAR/Solana: 64-byte ed25519 sig, hex-encoded
    ///   - Ethereum: 65-byte (r||s||v) ECDSA sig, hex-encoded; v should be 27 or 28
    pub fn transfer_signed(
        &mut self,
        from_type: AddrType,
        from: String,
        to_type: AddrType,
        to: String,
        token_type: String,
        amount: u128,
        nonce: u64,
        signature_hex: String,
    ) {
        let from_key = account_key(&from_type, &from);
        let to_key   = account_key(&to_type,   &to);

        // 1. Check nonce
        let cur_nonce = self.nonces.get(&from_key).copied().unwrap_or(0);
        assert_eq!(nonce, cur_nonce, "invalid nonce, expected {}", cur_nonce);

        // 2. Build canonical message
        let msg = format!(
            "transfer:{}:{}:{}:{}:{}:{}:{}",
            match from_type { AddrType::Near => "near", AddrType::Solana => "sol", AddrType::Ethereum => "eth" },
            from,
            match to_type   { AddrType::Near => "near", AddrType::Solana => "sol", AddrType::Ethereum => "eth" },
            to,
            token_type, amount, nonce
        );

        // 3. Verify signature according to address type
        let sig_bytes = hex::decode(&signature_hex)
            .unwrap_or_else(|_| env::panic_str("invalid hex signature"));

        match &from_type {
            AddrType::Near => {
                self.verify_near_sig(&from, msg.as_bytes(), &sig_bytes);
            }
            AddrType::Solana => {
                // Solana address IS the base58-encoded ed25519 public key
                self.verify_solana_sig(&from, msg.as_bytes(), &sig_bytes);
            }
            AddrType::Ethereum => {
                // Ethereum: recover address from sig and compare
                self.verify_eth_sig(&from, msg.as_bytes(), &sig_bytes);
            }
        }

        // 4. Increment nonce
        self.nonces.insert(from_key.clone(), cur_nonce + 1);

        // 5. Transfer
        let from_bal = self.get_bal(&from_key, &token_type);
        assert!(from_bal >= amount, "insufficient balance");
        self.set_bal(&from_key, &token_type, from_bal - amount);

        let to_bal = self.get_bal(&to_key, &token_type);
        self.set_bal(&to_key, &token_type, to_bal + amount);
    }

    // ── Verification helpers ─────────────────────────────────────────────────

    fn verify_near_sig(&self, near_account: &str, msg: &[u8], sig: &[u8]) {
        let account_id: AccountId = near_account.parse()
            .unwrap_or_else(|_| env::panic_str("invalid NEAR account"));
        let pubkey_bytes = self.near_pubkeys.get(&account_id)
            .unwrap_or_else(|| env::panic_str("NEAR account has no registered pubkey"));

        let key_arr: [u8; 32] = pubkey_bytes.clone().try_into()
            .unwrap_or_else(|_| env::panic_str("bad pubkey length"));
        let sig_arr: [u8; 64] = sig.try_into()
            .unwrap_or_else(|_| env::panic_str("sig must be 64 bytes"));

        let vk = VerifyingKey::from_bytes(&key_arr)
            .unwrap_or_else(|_| env::panic_str("invalid ed25519 pubkey"));
        let signature = Ed25519Sig::from_bytes(&sig_arr);

        vk.verify(msg, &signature)
            .unwrap_or_else(|_| env::panic_str("NEAR signature verification failed"));
    }

    fn verify_solana_sig(&self, solana_address: &str, msg: &[u8], sig: &[u8]) {
        // Solana address = base58(pubkey) — decode it to get the raw 32-byte pubkey
        let pubkey_bytes = bs58::decode(solana_address)
            .into_vec()
            .unwrap_or_else(|_| env::panic_str("invalid base58 Solana address"));

        let key_arr: [u8; 32] = pubkey_bytes.try_into()
            .unwrap_or_else(|_| env::panic_str("Solana pubkey must be 32 bytes"));
        let sig_arr: [u8; 64] = sig.try_into()
            .unwrap_or_else(|_| env::panic_str("sig must be 64 bytes"));

        let vk = VerifyingKey::from_bytes(&key_arr)
            .unwrap_or_else(|_| env::panic_str("invalid Solana pubkey"));
        let signature = Ed25519Sig::from_bytes(&sig_arr);

        vk.verify(msg, &signature)
            .unwrap_or_else(|_| env::panic_str("Solana signature verification failed"));
    }

    fn verify_eth_sig(&self, expected_eth_address: &str, msg: &[u8], sig: &[u8]) {
        assert_eq!(sig.len(), 65, "Ethereum sig must be 65 bytes (r||s||v)");

        // Split into r||s (64 bytes) and v (1 byte)
        let rs = &sig[..64];
        let v = sig[64];

        // Ethereum v is 27 or 28; convert to recovery id 0 or 1
        let v_normalized = if v >= 27 { v - 27 } else { v };
        let recid = RecoveryId::try_from(v_normalized)
            .unwrap_or_else(|_| env::panic_str("invalid recovery id"));

        // Hash message with Ethereum personal_sign prefix
        let hash = eth_prefixed_hash(msg);

        // Parse the ECDSA signature
        let ecdsa_sig = EcdsaSig::try_from(rs)
            .unwrap_or_else(|_| env::panic_str("invalid ECDSA signature bytes"));

        // Recover the public key
        let recovered_key = EcdsaKey::recover_from_prehash(&hash, &ecdsa_sig, recid)
            .unwrap_or_else(|_| env::panic_str("failed to recover Ethereum pubkey"));

        // Derive the Ethereum address from the recovered key
        let pubkey_uncompressed = recovered_key
            .to_encoded_point(false); // false = uncompressed (65 bytes)
        let recovered_address = eth_address_from_pubkey(pubkey_uncompressed.as_bytes());

        assert_eq!(
            recovered_address,
            expected_eth_address.to_lowercase(),
            "Ethereum signature mismatch: recovered {}, expected {}",
            recovered_address,
            expected_eth_address.to_lowercase()
        );
    }

    // ── Storage internals ────────────────────────────────────────────────────

    fn get_bal(&self, account_key: &str, token_type: &str) -> u128 {
        self.balances.get(account_key)
            .and_then(|m| m.get(token_type).copied())
            .unwrap_or(0)
    }

    fn set_bal(&mut self, account_key: &str, token_type: &str, amount: u128) {
        self.balances
            .entry(account_key.to_string())
            .or_insert_with(|| LookupMap::new(SK::BalancesInner { key: account_key.to_string() }))
            .insert(token_type.to_string(), amount);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    pub fn balance_of(&self, addr_type: AddrType, address: String, token_type: String) -> u128 {
        self.get_bal(&account_key(&addr_type, &address), &token_type)
    }

    pub fn nonce_of(&self, addr_type: AddrType, address: String) -> u64 {
        self.nonces.get(&account_key(&addr_type, &address)).copied().unwrap_or(0)
    }
}