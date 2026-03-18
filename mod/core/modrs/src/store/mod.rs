//! Store — unified storage layer
//!
//! Two backends under one roof:
//!   kv   — SQLite key-value store (local, fast, persistent)
//!   ipfs — IPFS content-addressed store (distributed, immutable)

pub mod sqlite;
pub mod ipfs;

pub use sqlite::SqliteStore;
pub use ipfs::{IpfsStore, IpfsConfig};

use crate::config::Config;
use crate::error::Result;

/// Unified store — holds both local KV and distributed IPFS
pub struct Store {
    pub kv: SqliteStore,
    pub ipfs: IpfsStore,
}

impl Store {
    pub fn new(config: &Config) -> Result<Self> {
        let kv = SqliteStore::new(&config.store.path)?;
        let ipfs = IpfsStore::new(&config.store.ipfs);
        Ok(Self { kv, ipfs })
    }
}

// backwards compat aliases
pub type StorageBackend = SqliteStore;

pub fn create_store(config: &Config) -> Result<Store> {
    Store::new(config)
}
