//! Store — unified storage layer
//!
//! Three backends under one roof:
//!   kv      — SQLite key-value store (local, fast, persistent)
//!   ipfs    — IPFS content-addressed store (distributed, immutable)
//!   localfs — Local filesystem store (files on disk, one per key)

pub mod sqlite;
pub mod ipfs;
pub mod localfs;

pub use sqlite::SqliteStore;
pub use ipfs::{IpfsStore, IpfsConfig};
pub use localfs::LocalFsStore;

use crate::config::Config;
use crate::error::Result;

/// Unified store — holds local KV, distributed IPFS, and filesystem
pub struct Store {
    pub kv: SqliteStore,
    pub ipfs: IpfsStore,
    pub fs: LocalFsStore,
}

impl Store {
    pub fn new(config: &Config) -> Result<Self> {
        let kv = SqliteStore::new(&config.store.path)?;
        let ipfs = IpfsStore::new(&config.store.ipfs);
        let fs = LocalFsStore::new(&config.store.path.join("fs"))?;
        Ok(Self { kv, ipfs, fs })
    }
}

// backwards compat aliases
pub type StorageBackend = SqliteStore;

pub fn create_store(config: &Config) -> Result<Store> {
    Store::new(config)
}
