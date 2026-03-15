//! Utility functions

use crate::error::{ModError, Result};
use colored::Colorize;

/// Print colored text
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

/// Hash data with different algorithms
pub fn hash(data: &[u8], mode: &str) -> Result<String> {
    use sha2::{Digest, Sha256, Sha512};
    use sha3::Keccak256;

    match mode {
        "sha256" => {
            let mut hasher = Sha256::new();
            hasher.update(data);
            let result = hasher.finalize();
            Ok(hex::encode(result))
        }
        "sha512" => {
            let mut hasher = Sha512::new();
            hasher.update(data);
            let result = hasher.finalize();
            Ok(hex::encode(result))
        }
        "keccak" | "keccak256" => {
            let mut hasher = Keccak256::new();
            hasher.update(data);
            let result = hasher.finalize();
            Ok(hex::encode(result))
        }
        "blake3" => {
            let hash = blake3::hash(data);
            Ok(hash.to_hex().to_string())
        }
        _ => Err(ModError::Unknown(format!("Unknown hash mode: {}", mode))),
    }
}

/// Find available port in range
pub fn find_free_port(range: (u16, u16)) -> Result<u16> {
    use std::net::TcpListener;

    for port in range.0..=range.1 {
        if TcpListener::bind(("0.0.0.0", port)).is_ok() {
            return Ok(port);
        }
    }

    Err(ModError::Server("No free ports available".to_string()))
}

/// Check if port is used
pub fn is_port_used(port: u16) -> bool {
    use std::net::TcpListener;
    TcpListener::bind(("0.0.0.0", port)).is_err()
}

/// Get system information
pub fn system_info() -> serde_json::Value {
    use sysinfo::{System, SystemExt};

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
