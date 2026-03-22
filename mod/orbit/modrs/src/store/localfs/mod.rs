//! Local filesystem key-value store — files on disk, one per key
//!
//! Keys map to file paths under a root directory.
//! Slashes in keys become directory separators, so `foo/bar` → `<root>/foo/bar`.
//!
//! Operations:
//!   get(key)         → Option<bytes>   read file contents
//!   put(key, data)                     write file contents
//!   delete(key)                        remove file
//!   exists(key)      → bool            check if file exists
//!   keys()           → [String]        list all keys (recursive)
//!   ls(prefix)       → [String]        list keys under a prefix

use crate::error::{ModError, Result};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};

pub struct LocalFsStore {
    root: PathBuf,
}

impl LocalFsStore {
    pub fn new(root: &Path) -> Result<Self> {
        std::fs::create_dir_all(root)?;
        Ok(Self { root: root.to_path_buf() })
    }

    fn key_path(&self, key: &str) -> PathBuf {
        self.root.join(key)
    }

    fn fs_err(msg: impl Into<String>) -> ModError {
        ModError::Storage(msg.into())
    }

    // ========================================================================
    // TYPED (JSON)
    // ========================================================================

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

    // ========================================================================
    // RAW BYTES
    // ========================================================================

    pub fn get_bytes(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let path = self.key_path(key);
        if !path.exists() {
            return Ok(None);
        }
        if !path.starts_with(&self.root) {
            return Err(Self::fs_err("key escapes store root"));
        }
        Ok(Some(std::fs::read(&path)?))
    }

    pub fn put_bytes(&self, key: &str, value: &[u8]) -> Result<()> {
        let path = self.key_path(key);
        if !path.starts_with(&self.root) {
            return Err(Self::fs_err("key escapes store root"));
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, value)?;
        Ok(())
    }

    pub fn get_str(&self, key: &str) -> Result<Option<String>> {
        match self.get_bytes(key)? {
            Some(b) => Ok(Some(String::from_utf8(b)
                .map_err(|e| Self::fs_err(format!("not valid UTF-8: {}", e)))?)),
            None => Ok(None),
        }
    }

    pub fn put_str(&self, key: &str, value: &str) -> Result<()> {
        self.put_bytes(key, value.as_bytes())
    }

    // ========================================================================
    // FILE OPS
    // ========================================================================

    pub fn delete(&self, key: &str) -> Result<()> {
        let path = self.key_path(key);
        if !path.starts_with(&self.root) {
            return Err(Self::fs_err("key escapes store root"));
        }
        if path.exists() {
            if path.is_dir() {
                std::fs::remove_dir_all(&path)?;
            } else {
                std::fs::remove_file(&path)?;
            }
        }
        Ok(())
    }

    pub fn exists(&self, key: &str) -> Result<bool> {
        let path = self.key_path(key);
        Ok(path.starts_with(&self.root) && path.exists())
    }

    /// List all keys recursively under the root
    pub fn keys(&self) -> Result<Vec<String>> {
        self.ls("")
    }

    /// List keys under a prefix (subdirectory)
    pub fn ls(&self, prefix: &str) -> Result<Vec<String>> {
        let dir = if prefix.is_empty() {
            self.root.clone()
        } else {
            self.root.join(prefix)
        };
        if !dir.exists() {
            return Ok(vec![]);
        }
        let mut keys = Vec::new();
        self.walk(&dir, &mut keys)?;
        keys.sort();
        Ok(keys)
    }

    fn walk(&self, dir: &Path, keys: &mut Vec<String>) -> Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                self.walk(&path, keys)?;
            } else {
                if let Ok(rel) = path.strip_prefix(&self.root) {
                    keys.push(rel.to_string_lossy().to_string());
                }
            }
        }
        Ok(())
    }

    /// Count all files recursively
    pub fn count(&self) -> Result<usize> {
        Ok(self.keys()?.len())
    }

    /// Remove all files in the store
    pub fn clear(&self) -> Result<()> {
        if self.root.exists() {
            for entry in std::fs::read_dir(&self.root)? {
                let path = entry?.path();
                if path.is_dir() {
                    std::fs::remove_dir_all(&path)?;
                } else {
                    std::fs::remove_file(&path)?;
                }
            }
        }
        Ok(())
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
}
