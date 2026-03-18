//! CLI — unified command router
//!
//! Mirrors mod/core/cli pattern: single entry point that parses
//! a command path and dispatches to the right handler.
//!
//! Command groups:
//!   module  — mods, info, code, fns, call, new, rm, dp
//!   key     — keys, address, sign, verify
//!   store   — put, get, ipfs-add, ipfs-cat, ipfs-pin, ...
//!   server  — serve, servers, kill
//!   git     — push, clone, repos
//!   utils   — hash, sysinfo, test

pub mod module;
pub mod key;
pub mod store;
pub mod server;
pub mod git;
pub mod utils;

use clap::{Parser, Subcommand};
use crate::prelude::*;

#[derive(Parser)]
#[command(name = "m")]
#[command(about = "mod — modular runtime", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
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
    /// Start a module server
    Serve {
        module: String,
        #[arg(short, long, default_value = "8000")]
        port: u16,
    },
    /// List running servers
    Servers,
    /// Stop a server
    Kill { module: String },

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
    let m = Mod::new().await?;

    match cli.command {
        // module
        Commands::Mods { search }            => module::mods(&m, search).await,
        Commands::Info { module: name }      => module::info(&m, &name).await,
        Commands::Code { module: name }      => module::code(&m, &name).await,
        Commands::Dp { module: name }        => module::dp(&m, &name).await,
        Commands::Fns { module: name }       => module::fns(&m, &name).await,
        Commands::Call { path, params }      => module::call(&m, &path, &params).await,
        Commands::New { name, description }  => module::new(&m, &name, description.as_deref()),
        Commands::Rm { name, force }         => module::rm(&m, &name, force),

        // key
        Commands::Keys                          => key::keys(&m).await,
        Commands::Address { key: k }            => key::address(&m, k.as_deref()).await,
        Commands::Sign { data, key: k }         => key::sign(&m, &data, k.as_deref()).await,
        Commands::Verify { data, signature, address } => key::verify(&m, &data, &signature, &address).await,

        // store (kv)
        Commands::Put { key: k, value, encrypt } => store::put(&m, &k, &value, encrypt),
        Commands::Get { key: k, decrypt }        => store::get(&m, &k, decrypt),

        // store (ipfs)
        Commands::IpfsAdd { data }    => store::ipfs_add(&m, &data).await,
        Commands::IpfsCat { cid }     => store::ipfs_cat(&m, &cid).await,
        Commands::IpfsPin { cid }     => store::ipfs_pin(&m, &cid).await,
        Commands::IpfsUnpin { cid }   => store::ipfs_unpin(&m, &cid).await,
        Commands::IpfsPins            => store::ipfs_pins(&m).await,
        Commands::IpfsStat { cid }    => store::ipfs_stat(&m, &cid).await,
        Commands::IpfsStatus          => store::ipfs_status(&m).await,

        // server
        Commands::Serve { module: name, port } => server::serve(&m, &name, port).await,
        Commands::Servers                      => server::servers(&m).await,
        Commands::Kill { module: name }        => server::kill(&m, &name).await,

        // git
        Commands::Push { message }       => git::push(&m, &message).await,
        Commands::Clone { url, dest }    => git::clone(&m, &url, dest).await,
        Commands::Repos                  => git::repos(&m).await,

        // utils
        Commands::Hash { data, mode }    => utils::hash(&m, &data, &mode),
        Commands::Test { module: name }  => utils::test(name.as_deref()),
        Commands::SysInfo                => utils::sysinfo(),

        // ai
        #[cfg(feature = "ai")]
        Commands::Ask { prompt }         => utils::ask(&m, &prompt).await,
    }
}
