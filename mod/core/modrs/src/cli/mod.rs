//! CLI — unified command router
//!
//! Mirrors mod/core/cli pattern: single entry point that parses
//! a command path and dispatches to the right handler.
//!
//! Command groups:
//!   module  — mods, info, code, fns, call, new, rm, dp
//!   key     — keys, address, sign, verify
//!   store   — put, get, ipfs-add, ipfs-cat, ipfs-pin, ...
//!   server  — serve, servers, kill, kill-all
//!   git     — push, clone, repos
//!   utils   — hash, sysinfo, test
//!
//! Flexible module interaction:
//!   mrs <module/fn> [args...] [key=value ...]
//!   mrs <module> [fn] [args...] [key=value ...]

pub mod module;
pub mod key;
pub mod store;
pub mod server;
pub mod git;
pub mod utils;

use clap::{Parser, Subcommand};
use crate::prelude::*;

#[derive(Parser)]
#[command(name = "mrs")]
#[command(about = "mod — modular runtime", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,

    /// Free-form args for module interaction: mrs module/fn arg1 key=value
    #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
    pub args: Vec<String>,
}

#[derive(Subcommand)]
pub enum Commands {
    // ── module ──────────────────────────────────────────────────────────
    /// List all modules
    Mods {
        #[arg(short, long)]
        search: Option<String>,
    },
    /// Get module information
    Info { module: String },
    /// View module source code (mod.rs)
    Code { module: String },
    /// Get module directory path
    Dp { module: String },
    /// List module functions
    Fns { module: String },
    /// Call a module function (format: module/function)
    Call {
        path: String,
        #[arg(short, long, default_value = "{}")]
        params: String,
    },
    /// Create a new module
    New {
        name: String,
        #[arg(short, long)]
        description: Option<String>,
    },
    /// Remove a module
    Rm {
        name: String,
        #[arg(short, long)]
        force: bool,
    },

    // ── key ─────────────────────────────────────────────────────────────
    /// List all keys
    Keys,
    /// Get key address
    Address {
        #[arg(short, long)]
        key: Option<String>,
    },
    /// Sign data with a key
    Sign {
        data: String,
        #[arg(short, long)]
        key: Option<String>,
    },
    /// Verify a signature
    Verify {
        data: String,
        signature: String,
        address: String,
    },

    // ── store (kv) ──────────────────────────────────────────────────────
    /// Store a value
    Put {
        key: String,
        value: String,
        #[arg(short, long)]
        encrypt: bool,
    },
    /// Retrieve a value
    Get {
        key: String,
        #[arg(short, long)]
        decrypt: bool,
    },

    // ── store (ipfs) ────────────────────────────────────────────────────
    /// Add content to IPFS
    IpfsAdd { data: String },
    /// Get content from IPFS by CID
    IpfsCat { cid: String },
    /// Pin content on IPFS
    IpfsPin { cid: String },
    /// Unpin content on IPFS
    IpfsUnpin { cid: String },
    /// List pinned IPFS content
    IpfsPins,
    /// Get IPFS object stats
    IpfsStat { cid: String },
    /// Check if IPFS daemon is online
    IpfsStatus,

    // ── server ──────────────────────────────────────────────────────────
    /// Start a module server (background by default, --fg for foreground)
    Serve {
        module: String,
        #[arg(short, long, default_value = "8000")]
        port: u16,
        /// Run in foreground (blocks until Ctrl+C)
        #[arg(long)]
        fg: bool,
    },
    /// List running servers
    Servers,
    /// Stop a server
    Kill { module: String },
    /// Stop all running servers
    KillAll,

    // ── internal (used by background spawner) ───────────────────────────
    /// [internal] Run server in foreground — spawned by `serve` in bg mode
    #[command(name = "_serve-fg", hide = true)]
    ServeFg {
        module: String,
        #[arg(short, long, default_value = "8000")]
        port: u16,
    },

    // ── git ─────────────────────────────────────────────────────────────
    /// Git commit and push
    Push { message: String },
    /// Clone a repository
    Clone {
        url: String,
        dest: Option<String>,
    },
    /// List repositories
    Repos,

    // ── utils ───────────────────────────────────────────────────────────
    /// Hash data
    Hash {
        data: String,
        #[arg(short, long, default_value = "sha256")]
        mode: String,
    },
    /// Run tests
    Test {
        #[arg(short, long)]
        module: Option<String>,
    },
    /// Get system information
    SysInfo,

    // ── ai ──────────────────────────────────────────────────────────────
    #[cfg(feature = "ai")]
    /// Ask AI a question
    Ask { prompt: String },
}

/// Run the CLI — parse args and dispatch to the right handler
pub async fn run() -> Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    // If a subcommand was matched, dispatch it
    if let Some(command) = cli.command {
        let m = Mod::new().await?;
        return dispatch(command, &m).await;
    }

    // No subcommand — check for free-form module interaction
    // mrs module/fn arg1 arg2 key=value
    if !cli.args.is_empty() {
        let m = Mod::new().await?;
        return handle_module_call(&m, &cli.args).await;
    }

    // No args at all — show help
    use clap::CommandFactory;
    Cli::command().print_help().ok();
    println!();
    Ok(())
}

async fn dispatch(command: Commands, m: &Mod) -> Result<()> {
    match command {
        // module
        Commands::Mods { search }            => module::mods(m, search).await,
        Commands::Info { module: name }      => module::info(m, &name).await,
        Commands::Code { module: name }      => module::code(m, &name).await,
        Commands::Dp { module: name }        => module::dp(m, &name).await,
        Commands::Fns { module: name }       => module::fns(m, &name).await,
        Commands::Call { path, params }      => module::call(m, &path, &params).await,
        Commands::New { name, description }  => module::new(m, &name, description.as_deref()),
        Commands::Rm { name, force }         => module::rm(m, &name, force),

        // key
        Commands::Keys                          => key::keys(m).await,
        Commands::Address { key: k }            => key::address(m, k.as_deref()).await,
        Commands::Sign { data, key: k }         => key::sign(m, &data, k.as_deref()).await,
        Commands::Verify { data, signature, address } => key::verify(m, &data, &signature, &address).await,

        // store (kv)
        Commands::Put { key: k, value, encrypt } => store::put(m, &k, &value, encrypt),
        Commands::Get { key: k, decrypt }        => store::get(m, &k, decrypt),

        // store (ipfs)
        Commands::IpfsAdd { data }    => store::ipfs_add(m, &data).await,
        Commands::IpfsCat { cid }     => store::ipfs_cat(m, &cid).await,
        Commands::IpfsPin { cid }     => store::ipfs_pin(m, &cid).await,
        Commands::IpfsUnpin { cid }   => store::ipfs_unpin(m, &cid).await,
        Commands::IpfsPins            => store::ipfs_pins(m).await,
        Commands::IpfsStat { cid }    => store::ipfs_stat(m, &cid).await,
        Commands::IpfsStatus          => store::ipfs_status(m).await,

        // server
        Commands::Serve { module: name, port, fg } => server::serve(m, &name, port, fg).await,
        Commands::Servers                          => server::servers(m).await,
        Commands::Kill { module: name }            => server::kill(m, &name).await,
        Commands::KillAll                          => server::kill_all(m).await,
        Commands::ServeFg { module: name, port }   => server::serve_foreground(m, &name, port).await,

        // git
        Commands::Push { message }       => git::push(m, &message).await,
        Commands::Clone { url, dest }    => git::clone(m, &url, dest).await,
        Commands::Repos                  => git::repos(m).await,

        // utils
        Commands::Hash { data, mode }    => utils::hash(m, &data, &mode),
        Commands::Test { module: name }  => utils::test(name.as_deref()),
        Commands::SysInfo                => utils::sysinfo(),

        // ai
        #[cfg(feature = "ai")]
        Commands::Ask { prompt }         => utils::ask(m, &prompt).await,
    }
}

// ── Flexible module interaction ─────────────────────────────────────────

/// Handle free-form CLI: mrs module/fn arg1 arg2 key=value
///
/// Syntax:
///   mrs module/fn               -> call fn with {}
///   mrs module/fn arg1 arg2     -> call fn with {"args": ["arg1", "arg2"]}
///   mrs module/fn key=value     -> call fn with {"key": "value"}
///   mrs module/fn arg1 k=v      -> call fn with {"args": ["arg1"], "k": "v"}
///   mrs module fn [args...]     -> same as module/fn
///   mrs module                  -> call module/info
async fn handle_module_call(m: &Mod, args: &[String]) -> Result<()> {
    let first = &args[0];
    let rest = &args[1..];

    let (mod_name, fn_name, call_args) = if first.contains('/') {
        // mrs module/fn [args...]
        let parts: Vec<&str> = first.splitn(2, '/').collect();
        (parts[0].to_string(), parts[1].to_string(), rest)
    } else if !rest.is_empty() && !rest[0].contains('=') && !rest[0].starts_with('-') {
        // mrs module fn [args...]
        // Check if second arg could be a function name (no = sign, no - prefix)
        let maybe_fn = &rest[0];
        // Verify the module exists and has this function
        if let Ok(module) = m.module(first).await {
            if let Ok(fns) = module.functions().await {
                if fns.contains(&maybe_fn.to_string()) {
                    (first.to_string(), maybe_fn.to_string(), &rest[1..])
                } else {
                    // Not a known function, treat as module/info with args
                    (first.to_string(), "info".to_string(), rest)
                }
            } else {
                (first.to_string(), maybe_fn.to_string(), &rest[1..])
            }
        } else {
            (first.to_string(), maybe_fn.to_string(), &rest[1..])
        }
    } else {
        // mrs module -> default to info
        (first.to_string(), "info".to_string(), rest)
    };

    let params = parse_cli_args(call_args);
    let path = format!("{}/{}", mod_name, fn_name);

    let result = m.call(&path, params).await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}

/// Parse CLI arguments into JSON params
///
/// Positional args go into "args" array, key=value pairs become object fields.
/// Values are auto-typed: numbers, bools, null, JSON objects/arrays, or strings.
fn parse_cli_args(args: &[String]) -> serde_json::Value {
    if args.is_empty() {
        return serde_json::json!({});
    }

    let mut map = serde_json::Map::new();
    let mut positional = Vec::new();

    for arg in args {
        if let Some(eq_pos) = arg.find('=') {
            let key = &arg[..eq_pos];
            let val = &arg[eq_pos + 1..];
            map.insert(key.to_string(), parse_value(val));
        } else {
            positional.push(parse_value(arg));
        }
    }

    if !positional.is_empty() {
        if positional.len() == 1 && map.is_empty() {
            // Single positional arg with no kwargs → pass as-is if it's an object
            if let serde_json::Value::Object(_) = &positional[0] {
                return positional.remove(0);
            }
        }
        map.insert("args".to_string(), serde_json::Value::Array(positional));
    }

    serde_json::Value::Object(map)
}

/// Auto-type a string value: int, float, bool, null, JSON object/array, or string
fn parse_value(s: &str) -> serde_json::Value {
    // Try null
    if s == "null" || s == "None" || s == "none" {
        return serde_json::Value::Null;
    }
    // Try bool
    if s == "true" || s == "True" {
        return serde_json::Value::Bool(true);
    }
    if s == "false" || s == "False" {
        return serde_json::Value::Bool(false);
    }
    // Try integer
    if let Ok(n) = s.parse::<i64>() {
        return serde_json::json!(n);
    }
    // Try float
    if let Ok(n) = s.parse::<f64>() {
        return serde_json::json!(n);
    }
    // Try JSON object/array
    if (s.starts_with('{') && s.ends_with('}')) || (s.starts_with('[') && s.ends_with(']')) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(s) {
            return v;
        }
    }
    // String
    serde_json::Value::String(s.to_string())
}
