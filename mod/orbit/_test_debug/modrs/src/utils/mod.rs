//! Utility functions — file ops, hashing, system info
//!
//! Mirrors Python mod.py utilities: ls, files, folders, text, put_text,
//! get_json, put_json, rm, glob, abspath, relpath, filter_path, env, etc.

use crate::config::AVOID_FOLDERS;
use crate::error::{ModError, Result};
use colored::Colorize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ── Output ──────────────────────────────────────────────────────────────

pub fn print_colored(text: &str, color: Option<&str>) {
    let output = match color {
        Some("red") => text.red(),
        Some("green") => text.green(),
        Some("yellow") => text.yellow(),
        Some("blue") => text.blue(),
        Some("magenta") => text.magenta(),
        Some("cyan") => text.cyan(),
        Some("white") | None => text.white(),
        _ => text.white(),
    };
    println!("{}", output);
}

// ── Hashing ─────────────────────────────────────────────────────────────

pub fn hash(data: &[u8], mode: &str) -> Result<String> {
    use sha2::{Digest, Sha256, Sha512};
    use sha3::Keccak256;

    match mode {
        "sha256" => {
            let mut hasher = Sha256::new();
            hasher.update(data);
            Ok(hex::encode(hasher.finalize()))
        }
        "sha512" => {
            let mut hasher = Sha512::new();
            hasher.update(data);
            Ok(hex::encode(hasher.finalize()))
        }
        "keccak" | "keccak256" => {
            let mut hasher = Keccak256::new();
            hasher.update(data);
            Ok(hex::encode(hasher.finalize()))
        }
        "blake3" => {
            let h = blake3::hash(data);
            Ok(h.to_hex().to_string())
        }
        _ => Err(ModError::Unknown(format!("Unknown hash mode: {}", mode))),
    }
}

// ── Path utilities ──────────────────────────────────────────────────────

/// Resolve to absolute path, expanding ~ and relative paths
pub fn abspath(path: &str) -> PathBuf {
    let expanded = shellexpand::tilde(path).to_string();
    std::fs::canonicalize(&expanded).unwrap_or_else(|_| {
        if expanded.starts_with('/') {
            PathBuf::from(&expanded)
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(&expanded)
        }
    })
}

/// Convert absolute path to ~-relative path
pub fn relpath(path: &Path, home: &Path) -> String {
    let home_str = home.to_string_lossy();
    let path_str = path.to_string_lossy();
    if path_str.starts_with(home_str.as_ref()) {
        format!("~{}", &path_str[home_str.len()..])
    } else {
        path_str.to_string()
    }
}

/// Resolve path to storage dir if it doesn't start with /, ~, or .
/// (Python get_path pattern)
pub fn get_path(path: Option<&str>, storage_dir: &Path) -> PathBuf {
    match path {
        None => storage_dir.to_path_buf(),
        Some(p) => {
            if p.starts_with('/') {
                PathBuf::from(p)
            } else if p.starts_with("~/") {
                abspath(p)
            } else if p.starts_with('.') {
                abspath(p)
            } else {
                storage_dir.join(p)
            }
        }
    }
}

// ── Filter ──────────────────────────────────────────────────────────────

/// Check if a path should be included (Python filter_path)
pub fn filter_path(
    path: &Path,
    include_hidden: bool,
    search: Option<&str>,
    avoid_folders: &[String],
) -> bool {
    let path_str = path.to_string_lossy();

    if !include_hidden && path_str.contains("/.") {
        return false;
    }

    let avoid = if avoid_folders.is_empty() {
        AVOID_FOLDERS.iter().map(|s| s.to_string()).collect::<Vec<_>>()
    } else {
        avoid_folders.to_vec()
    };

    for af in &avoid {
        if path_str.contains(&format!("/{}", af)) {
            return false;
        }
    }

    if let Some(s) = search {
        if !path_str.contains(s) {
            return false;
        }
    }

    true
}

// ── Directory listing ───────────────────────────────────────────────────

/// List directory entries as absolute sorted paths (Python ls)
pub fn ls(path: &Path, search: Option<&str>) -> Vec<PathBuf> {
    let path = if !path.is_absolute() {
        abspath(&path.to_string_lossy())
    } else {
        path.to_path_buf()
    };

    match std::fs::read_dir(&path) {
        Ok(entries) => {
            let mut files: Vec<PathBuf> = entries
                .filter_map(|e| e.ok())
                .map(|e| std::fs::canonicalize(e.path()).unwrap_or_else(|_| e.path()))
                .collect();
            files.sort();

            if let Some(s) = search {
                files.retain(|f| f.to_string_lossy().contains(s));
            }

            files
        }
        Err(_) => Vec::new(),
    }
}

/// Recursively list files (Python files)
pub fn files(
    path: &Path,
    search: Option<&str>,
    depth: usize,
    include_hidden: bool,
    avoid_folders: &[String],
) -> Vec<PathBuf> {
    if depth == 0 {
        return Vec::new();
    }

    let mut result = Vec::new();
    for entry in ls(path, None) {
        if entry.is_dir() {
            result.extend(files(&entry, search, depth - 1, include_hidden, avoid_folders));
        } else if entry.is_file() {
            result.push(entry);
        }
    }

    result.retain(|p| filter_path(p, include_hidden, search, avoid_folders));
    result.sort();
    result
}

/// Recursively list folders (Python folders)
pub fn folders(
    path: &Path,
    depth: usize,
    search: Option<&str>,
    include_hidden: bool,
    avoid_folders: &[String],
) -> Vec<PathBuf> {
    if depth == 0 {
        return Vec::new();
    }

    let mut result = Vec::new();
    for entry in ls(path, None) {
        if !filter_path(&entry, include_hidden, None, avoid_folders) {
            continue;
        }
        if entry.is_dir() {
            result.push(entry.clone());
            if depth > 1 {
                result.extend(folders(&entry, depth - 1, search, include_hidden, avoid_folders));
            }
        }
    }

    result.retain(|p| filter_path(p, include_hidden, search, avoid_folders));
    result.sort();
    result.dedup();
    result
}

/// Recursive file glob (Python glob)
pub fn glob_files(
    path: &Path,
    depth: usize,
    files_only: bool,
    include_hidden: bool,
    avoid_folders: &[String],
) -> Vec<PathBuf> {
    if depth == 0 {
        return Vec::new();
    }

    let mut result = Vec::new();
    for entry in ls(path, None) {
        if entry.is_dir() {
            result.extend(glob_files(&entry, depth - 1, files_only, include_hidden, avoid_folders));
        } else {
            result.push(entry);
        }
    }

    if files_only {
        result.retain(|p| p.is_file());
    }
    if !include_hidden {
        result.retain(|p| !p.to_string_lossy().contains("/."));
    }
    result.retain(|p| filter_path(p, include_hidden, None, avoid_folders));
    result
}

// ── File I/O ────────────────────────────────────────────────────────────

/// Read file to string (Python text / get_text)
pub fn text(path: &Path) -> Result<String> {
    std::fs::read_to_string(path).map_err(Into::into)
}

/// Write string to file, creating parent dirs (Python put_text)
pub fn put_text(path: &Path, content: &str) -> Result<serde_json::Value> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, content)?;
    Ok(serde_json::json!({
        "success": true,
        "path": path.to_string_lossy(),
        "size": content.len() * 8
    }))
}

/// Read JSON from file (Python get_json)
pub fn get_json(path: &Path) -> Result<Option<serde_json::Value>> {
    let path = if !path.to_string_lossy().ends_with(".json") {
        path.with_extension("json")
    } else {
        path.to_path_buf()
    };

    if !path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&path)?;
    let value: serde_json::Value = serde_json::from_str(&content)?;
    Ok(Some(value))
}

/// Write JSON to file (Python put_json)
pub fn put_json(path: &Path, data: &serde_json::Value) -> Result<PathBuf> {
    let path = if !path.to_string_lossy().ends_with(".json") {
        path.with_extension("json")
    } else {
        path.to_path_buf()
    };

    let content = serde_json::to_string_pretty(data)?;
    put_text(&path, &content)?;
    Ok(path)
}

/// Read YAML from file
pub fn get_yaml(path: &Path) -> Result<Option<serde_json::Value>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(path)?;
    let value: serde_json::Value = serde_yaml::from_str(&content)
        .map_err(|e| ModError::Config(format!("Failed to parse YAML: {}", e)))?;
    Ok(Some(value))
}

/// Safe remove file or directory (Python rm)
pub fn rm(path: &Path) -> Result<serde_json::Value> {
    let path = abspath(&path.to_string_lossy());

    // Safety: don't remove home or root
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    let avoid = [home.clone(), PathBuf::from("/")];
    if avoid.contains(&path) {
        return Err(ModError::Unknown(format!("Cannot remove {}", path.display())));
    }

    if !path.exists() {
        return Ok(serde_json::json!({
            "success": false,
            "message": format!("{} does not exist", path.display())
        }));
    }

    if path.is_dir() {
        std::fs::remove_dir_all(&path)?;
    } else {
        std::fs::remove_file(&path)?;
    }

    Ok(serde_json::json!({
        "success": true,
        "message": format!("{} removed", path.display())
    }))
}

// ── Content map ─────────────────────────────────────────────────────────

/// Get content of a directory as relative_path → file_content (Python content)
pub fn content(
    dir: &Path,
    depth: usize,
    avoid_folders: &[String],
) -> HashMap<String, String> {
    let dir = abspath(&dir.to_string_lossy());
    let all_files = files(&dir, None, depth, false, avoid_folders);
    let dir_str = dir.to_string_lossy().to_string();

    let mut map = HashMap::new();
    for f in all_files {
        let f_str = f.to_string_lossy().to_string();
        let relative = if f_str.starts_with(&format!("{}/", dir_str)) {
            f_str[dir_str.len() + 1..].to_string()
        } else {
            f_str
        };

        match std::fs::read_to_string(&f) {
            Ok(content) => { map.insert(relative, content); }
            Err(e) => { map.insert(relative, format!("Error: {}", e)); }
        }
    }

    // Sort by key
    let mut sorted: Vec<(String, String)> = map.into_iter().collect();
    sorted.sort_by(|a, b| a.0.cmp(&b.0));
    sorted.into_iter().collect()
}

// ── Environment ─────────────────────────────────────────────────────────

/// Get environment variables (Python env)
pub fn env(key: Option<&str>) -> serde_json::Value {
    match key {
        Some(k) => {
            match std::env::var(k) {
                Ok(v) => serde_json::Value::String(v),
                Err(_) => serde_json::Value::Null,
            }
        }
        None => {
            let map: serde_json::Map<String, serde_json::Value> = std::env::vars()
                .map(|(k, v)| (k, serde_json::Value::String(v)))
                .collect();
            serde_json::Value::Object(map)
        }
    }
}

// ── Time ────────────────────────────────────────────────────────────────

/// Get current time in various formats (Python time)
pub fn time(mode: &str) -> serde_json::Value {
    use chrono::Utc;

    let now = Utc::now();
    match mode {
        "float" => serde_json::json!(now.timestamp() as f64 + now.timestamp_subsec_millis() as f64 / 1000.0),
        "int" => serde_json::json!(now.timestamp_millis()),
        "iso" => serde_json::json!(now.format("%Y-%m-%dT%H:%M:%SZ").to_string()),
        "date" => serde_json::json!(now.format("%a %b %e %H:%M:%S %Y").to_string()),
        _ => serde_json::json!(now.timestamp() as f64),
    }
}

// ── Port utilities ──────────────────────────────────────────────────────

pub fn find_free_port(range: (u16, u16)) -> Result<u16> {
    use std::net::TcpListener;
    for port in range.0..=range.1 {
        if TcpListener::bind(("0.0.0.0", port)).is_ok() {
            return Ok(port);
        }
    }
    Err(ModError::Server("No free ports available".to_string()))
}

pub fn is_port_used(port: u16) -> bool {
    use std::net::TcpListener;
    TcpListener::bind(("0.0.0.0", port)).is_err()
}

// ── System info ─────────────────────────────────────────────────────────

pub fn system_info() -> serde_json::Value {
    use sysinfo::System;

    let mut sys = System::new_all();
    sys.refresh_all();

    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "cpu_count": sys.cpus().len(),
        "total_memory": sys.total_memory(),
        "used_memory": sys.used_memory(),
        "available_memory": sys.available_memory(),
    })
}

// ── Git repo discovery ──────────────────────────────────────────────────

/// Find git repos in a directory (Python repo2path)
pub fn repo2path(base: &Path, search: Option<&str>) -> HashMap<String, PathBuf> {
    let mut repos = HashMap::new();
    if let Ok(entries) = std::fs::read_dir(base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join(".git").exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if search.is_none() || name.contains(search.unwrap()) {
                        repos.insert(name.to_string(), path);
                    }
                }
            }
        }
    }
    let mut sorted: Vec<(String, PathBuf)> = repos.into_iter().collect();
    sorted.sort_by(|a, b| a.0.cmp(&b.0));
    sorted.into_iter().collect()
}

/// Check if a string is an IPFS CID (Python iscid)
pub fn is_cid(text: &str) -> bool {
    text.starts_with("Qm") && text.len() == 46
}

/// Find README files in a directory
pub fn readmes(dir: &Path, depth: usize, avoid_folders: &[String]) -> Vec<PathBuf> {
    files(dir, None, depth, false, avoid_folders)
        .into_iter()
        .filter(|f| {
            f.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.to_lowercase().contains("readme"))
                .unwrap_or(false)
        })
        .collect()
}
