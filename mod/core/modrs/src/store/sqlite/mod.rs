//! SQLite-backed key-value store — local, fast, persistent

use crate::error::{ModError, Result};
use parking_lot::Mutex;
use rusqlite::OptionalExtension;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::PathBuf;

pub struct SqliteStore {
    conn: Mutex<rusqlite::Connection>,
}

impl SqliteStore {
    pub fn new(path: &PathBuf) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::create_dir_all(path)?;

        let conn = rusqlite::Connection::open(path.join("mod.db"))
            .map_err(|e| ModError::Storage(format!("Failed to open database: {}", e)))?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS store (
                key TEXT PRIMARY KEY,
                value BLOB NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )
        .map_err(|e| ModError::Storage(format!("Failed to create table: {}", e)))?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    fn timestamp() -> i64 {
        chrono::Utc::now().timestamp()
    }

    pub fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        match self.get_bytes(key)? {
            Some(b) => Ok(Some(serde_json::from_slice(&b)?)),
            None => Ok(None),
        }
    }

    pub fn put<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        let bytes = serde_json::to_vec(value)?;
        self.put_bytes(key, &bytes)
    }

    pub fn get_bytes(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let conn = self.conn.lock();
        let mut stmt = conn
            .prepare("SELECT value FROM store WHERE key = ?")
            .map_err(|e| ModError::Storage(e.to_string()))?;

        let result = stmt
            .query_row([key], |row| row.get::<_, Vec<u8>>(0))
            .optional()
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(result)
    }

    pub fn put_bytes(&self, key: &str, value: &[u8]) -> Result<()> {
        let conn = self.conn.lock();
        let ts = Self::timestamp();

        conn.execute(
            "INSERT OR REPLACE INTO store (key, value, created_at, updated_at)
             VALUES (?, ?, COALESCE((SELECT created_at FROM store WHERE key = ?), ?), ?)",
            rusqlite::params![key, value, key, ts, ts],
        )
        .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(())
    }

    pub fn delete(&self, key: &str) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM store WHERE key = ?", [key])
            .map_err(|e| ModError::Storage(e.to_string()))?;
        Ok(())
    }

    pub fn exists(&self, key: &str) -> Result<bool> {
        let conn = self.conn.lock();
        let mut stmt = conn
            .prepare("SELECT 1 FROM store WHERE key = ?")
            .map_err(|e| ModError::Storage(e.to_string()))?;

        let exists = stmt
            .exists([key])
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(exists)
    }

    pub fn keys(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock();
        let mut stmt = conn
            .prepare("SELECT key FROM store ORDER BY key")
            .map_err(|e| ModError::Storage(e.to_string()))?;

        let keys = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| ModError::Storage(e.to_string()))?
            .collect::<std::result::Result<Vec<String>, _>>()
            .map_err(|e| ModError::Storage(e.to_string()))?;

        Ok(keys)
    }

    pub fn count(&self) -> Result<usize> {
        let conn = self.conn.lock();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM store", [], |row| row.get(0))
            .map_err(|e| ModError::Storage(e.to_string()))?;
        Ok(count as usize)
    }

    pub fn clear(&self) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM store", [])
            .map_err(|e| ModError::Storage(e.to_string()))?;
        Ok(())
    }
}

// rusqlite::Connection is Send but not Sync — Mutex makes it safe
unsafe impl Send for SqliteStore {}
unsafe impl Sync for SqliteStore {}
