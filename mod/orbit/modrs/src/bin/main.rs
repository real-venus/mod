//! ModRS CLI binary

use clap::{Parser, Subcommand};
use modrs::prelude::*;
use serde_json::json;

#[derive(Parser)]
#[command(name = "m")]
#[command(about = "ModRS - Rust implementation of Mod framework", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List all modules
    Mods {
        #[arg(short, long)]
        search: Option<String>,
    },

    /// Get module information
    Info {
        module: String,
    },

    /// View module code
    Code {
        module: String,
    },

    /// Get module directory path
    Dp {
        module: String,
    },

    /// List module functions
    Fns {
        module: String,
    },

    /// Call a module function
    Call {
        /// Format: module/function
        path: String,

        /// JSON parameters
        #[arg(short, long, default_value = "{}")]
        params: String,
    },

    /// Start a module server
    Serve {
        module: String,

        #[arg(short, long, default_value = "8000")]
        port: u16,
    },

    /// List running servers
    Servers,

    /// Stop a server
    Kill {
        module: String,
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

    /// Get key address
    Address {
        #[arg(short, long)]
        key: Option<String>,
    },

    /// List all keys
    Keys,

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

    /// Git commit and push
    Push {
        message: String,
    },

    /// Clone a repository
    Clone {
        url: String,
        dest: Option<String>,
    },

    /// List repositories
    Repos,

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

    #[cfg(feature = "ai")]
    /// Ask AI a question
    Ask {
        prompt: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();
    let m = Mod::new().await?;

    match cli.command {
        Commands::Mods { search } => {
            let mut mods = m.mods().await?;
            if let Some(search_term) = search {
                mods.retain(|name| name.contains(&search_term));
            }
            for mod_name in mods {
                println!("{}", mod_name);
            }
        }

        Commands::Info { module } => {
            let info = m.info(&module).await?;
            println!("{}", serde_json::to_string_pretty(&info)?);
        }

        Commands::Code { module } => {
            let code = m.code(&module).await?;
            println!("{}", code);
        }

        Commands::Dp { module } => {
            let path = m.dirpath(&module).await?;
            println!("{}", path.display());
        }

        Commands::Fns { module } => {
            let module_obj = m.module(&module).await?;
            let fns = module_obj.functions().await?;
            for func in fns {
                println!("{}", func);
            }
        }

        Commands::Call { path, params } => {
            let params: serde_json::Value = serde_json::from_str(&params)?;
            let result = m.call(&path, params).await?;
            println!("{}", serde_json::to_string_pretty(&result)?);
        }

        Commands::Serve { module, port } => {
            println!("Starting {} server on port {}...", module, port);
            m.serve(&module, port).await?;
            println!("Server is running. Press Ctrl+C to stop.");
            tokio::signal::ctrl_c().await?;
        }

        Commands::Servers => {
            let servers = m.servers().await;
            for server in servers {
                println!("{}: {} ({})", server.name, server.url, server.port);
            }
        }

        Commands::Kill { module } => {
            m.kill(&module).await?;
            println!("Server '{}' stopped", module);
        }

        Commands::Sign { data, key } => {
            let data_value: serde_json::Value = serde_json::from_str(&data)?;
            let sig = m.sign(&data_value, key.as_deref()).await?;
            println!("{}", serde_json::to_string_pretty(&sig)?);
        }

        Commands::Verify { data, signature, address } => {
            let data_value: serde_json::Value = serde_json::from_str(&data)?;
            let sig: modrs::crypto::Signature = serde_json::from_str(&signature)?;
            let valid = m.verify(&data_value, &sig, &address).await?;
            println!("Valid: {}", valid);
        }

        Commands::Address { key } => {
            let address = m.address(key.as_deref()).await?;
            println!("{}", address);
        }

        Commands::Keys => {
            let keys = m.keys().await?;
            for key in keys {
                println!("{}", key);
            }
        }

        Commands::Put { key, value, encrypt } => {
            let value: serde_json::Value = serde_json::from_str(&value)?;
            m.put(&key, &value, encrypt).await?;
            println!("Stored '{}'", key);
        }

        Commands::Get { key, decrypt } => {
            let value: Option<serde_json::Value> = m.get(&key, decrypt).await?;
            match value {
                Some(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                None => println!("Key '{}' not found", key),
            }
        }

        Commands::Push { message } => {
            m.push(&message).await?;
            println!("Changes committed and pushed");
        }

        Commands::Clone { url, dest } => {
            let dest = dest.unwrap_or_else(|| {
                url.split('/').last().unwrap_or("repo").to_string()
            });
            m.clone(&url, dest.as_str()).await?;
            println!("Repository cloned to {}", dest);
        }

        Commands::Repos => {
            let repos = m.repos().await?;
            for repo in repos {
                println!("{}", repo);
            }
        }

        Commands::Hash { data, mode } => {
            let hash = m.hash(data.as_bytes(), &mode)?;
            println!("{}", hash);
        }

        Commands::Test { module } => {
            if let Some(mod_name) = module {
                println!("Running tests for {}...", mod_name);
                // Test implementation would go here
            } else {
                println!("Running all tests...");
                // All tests implementation would go here
            }
        }

        Commands::SysInfo => {
            let info = modrs::utils::system_info();
            println!("{}", serde_json::to_string_pretty(&info)?);
        }

        #[cfg(feature = "ai")]
        Commands::Ask { prompt } => {
            println!("Asking AI...");
            let response = m.ask(&prompt).await?;
            println!("\n{}\n", response);
        }
    }

    Ok(())
}
