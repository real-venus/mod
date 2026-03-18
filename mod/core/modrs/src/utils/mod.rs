//! Utility functions

use crate::error::{ModError, Result};
use colored::Colorize;

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
