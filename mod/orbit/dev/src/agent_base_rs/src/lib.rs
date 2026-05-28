//! agent_base — Rust counterpart of agent_base.py / agent_base.js.
//!
//! Implements the same canonical contract shape (manifest, abi, code_hash,
//! state, events, call dispatch). A concrete Rust agent provides:
//!   1) A `Contract` impl declaring NAME/BINARY/etc + an `abi()` and `call()`
//!   2) A `main()` that delegates to `agent_base::run_cli::<MyContract>()`
//!
//! Same CLI protocol as the JS base — the Python dispatcher in dev's FastAPI
//! shells out to `./contract manifest|abi|call <method> <jsonArgs>`.

use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};
use std::env;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AbiEntry {
    pub name: String,
    pub kind: String,            // "view" | "tx"
    pub owner_only: bool,
    #[serde(default)]
    pub inputs: Vec<AbiInput>,
    pub doc: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AbiInput {
    pub name: String,
    #[serde(rename = "type")]
    pub ty: String,
}

#[derive(Debug, Serialize)]
pub struct Manifest {
    pub name: &'static str,
    pub lang: &'static str,
    pub icon: &'static str,
    pub color: &'static str,
    pub binary: &'static str,
    pub default_model: &'static str,
    pub env_key: &'static str,
    pub description: &'static str,
    pub code_hash: String,
    pub abi: Vec<AbiEntry>,
}

pub trait Contract {
    const NAME: &'static str;
    const ICON: &'static str = "";
    const COLOR: &'static str = "#888888";
    const BINARY: &'static str = "";
    const DEFAULT_MODEL: &'static str = "";
    const ENV_KEY: &'static str = "";
    const DESCRIPTION: &'static str = "agent (override DESCRIPTION)";

    fn abi() -> Vec<AbiEntry>;
    fn call(method: &str, args: serde_json::Value) -> serde_json::Value;
}

pub fn code_hash() -> String {
    // sha3-256 over the running binary's own bytes — same idea as
    // hashing the Python class source.
    let path = env::current_exe().unwrap_or_default();
    let bytes = fs::read(&path).unwrap_or_default();
    let mut h = Sha3_256::new();
    h.update(&bytes);
    format!("0x{}", hex::encode(h.finalize()))
}

pub fn manifest<C: Contract>() -> Manifest {
    Manifest {
        name: C::NAME,
        lang: "rust",
        icon: C::ICON,
        color: C::COLOR,
        binary: C::BINARY,
        default_model: C::DEFAULT_MODEL,
        env_key: C::ENV_KEY,
        description: C::DESCRIPTION,
        code_hash: code_hash(),
        abi: C::abi(),
    }
}

pub fn state_path<C: Contract>() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(home).join(".mod").join(C::NAME);
    let _ = fs::create_dir_all(&dir);
    dir.join("state.json")
}

pub fn events_path<C: Contract>() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(home).join(".mod").join(C::NAME);
    let _ = fs::create_dir_all(&dir);
    dir.join("events.jsonl")
}

pub fn load_state<C: Contract>() -> serde_json::Value {
    let p = state_path::<C>();
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({ "created_at": now_ts(), "jobs_submitted": 0, "events": 0 }))
}

pub fn save_state<C: Contract>(state: &serde_json::Value) {
    let _ = fs::write(state_path::<C>(), serde_json::to_string_pretty(state).unwrap_or_default());
}

pub fn emit<C: Contract>(event: &str, fields: serde_json::Value) {
    let evt = serde_json::json!({ "event": event, "ts": now_ts(), "fields": fields });
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(events_path::<C>()) {
        let _ = writeln!(f, "{}", evt);
    }
}

fn now_ts() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

/// CLI dispatcher — same protocol as the JS base.
///   $0 manifest
///   $0 abi
///   $0 call <method> <jsonArgs>
pub fn run_cli<C: Contract>() {
    let argv: Vec<String> = env::args().collect();
    let cmd = argv.get(1).cloned().unwrap_or_default();
    match cmd.as_str() {
        "manifest" => println!("{}", serde_json::to_string(&manifest::<C>()).unwrap()),
        "abi" => println!("{}", serde_json::to_string(&C::abi()).unwrap()),
        "call" => {
            let method = argv.get(2).cloned().unwrap_or_default();
            let args = argv.get(3)
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(serde_json::json!({}));
            let result = C::call(&method, args);
            println!("{}", serde_json::to_string(&result).unwrap());
        }
        _ => {
            eprintln!("usage: {} {{manifest|abi|call <method> <jsonArgs>}}", argv.get(0).cloned().unwrap_or_default());
            std::process::exit(2);
        }
    }
}
