//! Storage layer for persistent key-value data

use crate::config::Config;
use crate::error::{ModError, Result};
use async_trait::async_trait;
use serde::{de::DeserializeOwned, Serialize};
use std::path::PathBuf;

/// Storage trait
#[async_trait]
pub trait Storage: Send + Sync {
    async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>>;
    async fn put<T: Serialize>(&self, key: &str, value: &T) -> Result<()>;
    async fn delete(&self, key: &str) -> Result<()>;
    async fn get_bytes(&self, key: &str) -> Result<Option<Vec<u8>>>;
    async fn put_bytes(&self, key: &str, value: &[u8]) -> Result<()>;
    async fn exists(&self, key: &str) -> Result<bool>;
    async fn keys(&self) -> Result<Vec<String>>;
}

/// SQLite storage backend
pub struct SqliteStorage {
    conn: rusqlite::Connection,
}

impl SqliteStorage {
    pub fn new(path: &PathBuf) -> Result<Self> {
        std::fs::create_dir_all(path.parent().unwrap())?;

        let conn = rusqlite::Connection::open(path.join("mod.db"))
            .map_err(|e| ModError::Storage(format!("Failed to open database: {}", e)))?;

        // Create table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS storage (
                key TEXT PRIMARY KEY,
                value BLOB NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )
        .map_err(|e| ModError::Storage(format!("Failed to create table: {}", e)))?;

        Ok(Self { conn })
    }

    fn get_timestamp() -> i64 {
        chrono::Utc::now().timestamp()
    }
}

#[async_trait]
impl Storage for SqliteStorage {
    async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let bytes = self.get_bytes(key).await?;
        match bytes {
            Some(b) => Ok(Some(serde_json::from_slice(&b)?)),
            None => Ok(None),
        }
    }

    async fn put<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        let bytes = serde_json::to_vec(value)?;
        self.put_bytes(key, &bytes).await
    }

    async fn get_bytes(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM storage WHERE key = ?")
            .map_err(|e| ModError::Storage(e.to_string()))?;

        let result = stmt
            .query_row([key], |row| row.get::<_, Vec<u8>>(0))
            .optional()
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(result)
    }

    async fn put_bytes(&self, key: &str, value: &[u8]) -> Result<()> {
        let timestamp = Self::get_timestamp();

        self.conn
            .execute(
                "INSERT OR REPLACE INTO storage (key, value, created_at, updated_at)
                 VALUES (?, ?, COALESCE((SELECT created_at FROM storage WHERE key = ?), ?), ?)",
                rusqlite::params![key, value, key, timestamp, timestamp],
            )
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM storage WHERE key = ?", [key])
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(())
    }

    async fn exists(&self, key: &str) -> Result<bool> {
        let mut stmt = self
            .conn
            .prepare("SELECT 1 FROM storage WHERE key = ?")
            .map_err(|e| ModError::Storage(e.to_string()))?;

        let exists = stmt
            .exists([key])
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(exists)
    }

    async fn keys(&self) -> Result<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT key FROM storage ORDER BY key")
            .map_err(|e| ModError::Storage(e.to_string()))?;

        let keys = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| ModError::Storage(e.to_string()))?
            .collect::<std::result::Result<Vec<String>, _>>()
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(keys)
    }
}

pub type StorageBackend = Box<dyn Storage>;

pub async fn create_storage(config: &Config) -> Result<StorageBackend> {
    match config.storage.backend.as_str() {
        "sqlite" => Ok(Box::new(SqliteStorage::new(&config.storage.path)?)),
        #[cfg(feature = "rocksdb-storage")]
        "rocksdb" => {
            // RocksDB implementation would go here
            unimplemented!("RocksDB storage not yet implemented")
        }
        _ => Err(ModError::Config(format!(
            "Unknown storage backend: {}",
            config.storage.backend
        ))),
    }
}
