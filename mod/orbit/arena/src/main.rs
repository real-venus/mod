mod agents;
mod games;

use anyhow::Result;
use arena::*;
use clap::{Parser, Subcommand};
use colored::*;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "arena")]
#[command(about = "Agent competition arena - create games, train agents, compete!", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run a single match
    Match {
        /// Game to play
        #[arg(short, long)]
        game: String,

        /// Agents to compete (comma-separated)
        #[arg(short, long)]
        agents: String,

        /// Evaluator to use (default: win_loss)
        #[arg(short, long, default_value = "win_loss")]
        evaluator: String,

        /// Storage backend (local or ipfs)
        #[arg(short, long, default_value = "local")]
        storage: String,

        /// Storage path
        #[arg(long, default_value = "./results")]
        storage_path: String,
    },

    /// Run a tournament (multiple matches)
    Tournament {
        /// Game to play
        #[arg(short, long)]
        game: String,

        /// Agents to compete (comma-separated)
        #[arg(short, long)]
        agents: String,

        /// Number of matches
        #[arg(short, long, default_value = "10")]
        num_matches: usize,

        /// Evaluator to use (default: win_loss)
        #[arg(short, long, default_value = "win_loss")]
        evaluator: String,

        /// Storage backend (local or ipfs)
        #[arg(short, long, default_value = "local")]
        storage: String,

        /// Storage path
        #[arg(long, default_value = "./results")]
        storage_path: String,
    },

    /// List available games
    ListGames,

    /// List available agents
    ListAgents,

    /// List available evaluators
    ListEvaluators,

    /// View match results
    Results {
        /// Result ID to view (default: list recent)
        #[arg(short, long)]
        id: Option<String>,

        /// Number of results to list
        #[arg(short, long, default_value = "10")]
        limit: usize,

        /// Storage path
        #[arg(long, default_value = "./results")]
        storage_path: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Match {
            game,
            agents: agents_str,
            evaluator: eval_name,
            storage: storage_type,
            storage_path,
        } => {
            run_match(&game, &agents_str, &eval_name, &storage_type, &storage_path).await?;
        }

        Commands::Tournament {
            game,
            agents: agents_str,
            num_matches,
            evaluator: eval_name,
            storage: storage_type,
            storage_path,
        } => {
            run_tournament(
                &game,
                &agents_str,
                num_matches,
                &eval_name,
                &storage_type,
                &storage_path,
            )
            .await?;
        }

        Commands::ListGames => {
            println!("{}", "Available games:".bold().green());
            println!("  - tic_tac_toe: Classic Tic-Tac-Toe");
        }

        Commands::ListAgents => {
            println!("{}", "Available agents:".bold().green());
            println!("  - random_bot: Random move picker");
            // println!("  - python_bot: Smart Python agent (requires --features python)");
        }

        Commands::ListEvaluators => {
            println!("{}", "Available evaluators:".bold().green());
            println!("  - win_loss: Simple win/loss (1.0/0.0)");
            println!("  - tic_tac_toe_custom: Win/loss with speed bonus");
        }

        Commands::Results {
            id,
            limit,
            storage_path,
        } => {
            view_results(id.as_deref(), limit, &storage_path).await?;
        }
    }

    Ok(())
}

async fn run_match(
    game_name: &str,
    agents_str: &str,
    eval_name: &str,
    storage_type: &str,
    storage_path: &str,
) -> Result<()> {
    println!("{}", "Starting match...".bold().cyan());

    // Create storage
    let storage = create_storage(storage_type, storage_path)?;
    let runner = Runner::new(storage);

    // Run match based on game type
    let result = match game_name {
        "tic_tac_toe" => {
            let game = games::tic_tac_toe::TicTacToe::new();
            let mut agents = load_agents(agents_str)?;
            let evaluator = load_evaluator(eval_name)?;
            runner.run_match(&game, &mut agents, &*evaluator).await?
        }
        _ => return Err(anyhow::anyhow!("Unknown game: {}", game_name)),
    };

    // Display results
    println!("\n{}", "Match complete!".bold().green());
    println!("Game: {}", result.game);
    println!("Match ID: {}", result.id);
    println!("Duration: {}ms", result.duration_ms);

    if let Some(winner) = result.winner {
        println!("\n{} {}", "Winner:".bold(), result.agents[winner].green());
    } else {
        println!("\n{}", "Draw!".yellow());
    }

    println!("\n{}:", "Scores".bold());
    for score in &result.scores {
        println!("  {}: {:.3}", score.agent, score.value);
    }

    Ok(())
}

async fn run_tournament(
    game_name: &str,
    agents_str: &str,
    num_matches: usize,
    eval_name: &str,
    storage_type: &str,
    storage_path: &str,
) -> Result<()> {
    println!("{}", "Starting tournament...".bold().cyan());

    // Create storage
    let storage = create_storage(storage_type, storage_path)?;
    let runner = Runner::new(storage);

    // Run tournament based on game type
    let results = match game_name {
        "tic_tac_toe" => {
            let game = games::tic_tac_toe::TicTacToe::new();
            let mut agents = load_agents(agents_str)?;
            let evaluator = load_evaluator(eval_name)?;
            runner.run_tournament(&game, &mut agents, &*evaluator, num_matches).await?
        }
        _ => return Err(anyhow::anyhow!("Unknown game: {}", game_name)),
    };

    // Display results
    println!("\n{}", "Tournament complete!".bold().green());
    results.print_summary();

    Ok(())
}

async fn view_results(id: Option<&str>, limit: usize, storage_path: &str) -> Result<()> {
    let storage = create_storage("local", storage_path)?;

    if let Some(id) = id {
        // View specific result
        let result = storage.load(id).await?;
        println!("{}", "Match Result".bold().cyan());
        println!("ID: {}", result.id);
        println!("Game: {}", result.game);
        println!("Agents: {}", result.agents.join(", "));
        println!("Timestamp: {}", result.timestamp);
        println!("\n{}:", "Scores".bold());
        for score in &result.scores {
            println!("  {}: {:.3}", score.agent, score.value);
        }
    } else {
        // List recent results
        let results = storage.list(limit).await?;
        println!("{}", "Recent matches:".bold().cyan());
        for result in results {
            let winner_str = result
                .winner
                .map(|w| result.agents[w].clone())
                .unwrap_or_else(|| "Draw".to_string());
            println!(
                "{} | {} | {} | Winner: {}",
                result.id[..8].dimmed(),
                result.game,
                result.timestamp.format("%Y-%m-%d %H:%M"),
                winner_str.green()
            );
        }
    }

    Ok(())
}

fn create_storage(storage_type: &str, storage_path: &str) -> Result<Box<dyn Storage>> {
    let path = PathBuf::from(storage_path);

    match storage_type {
        "local" => Ok(Box::new(results::LocalStorage::new(path)?)),
        #[cfg(feature = "ipfs")]
        "ipfs" => Ok(Box::new(results::IpfsStorage::new(
            path,
            "http://localhost:5001",
        )?)),
        #[cfg(not(feature = "ipfs"))]
        "ipfs" => Err(anyhow::anyhow!("IPFS storage requires --features ipfs")),
        _ => Err(anyhow::anyhow!("Unknown storage type: {}", storage_type)),
    }
}

fn load_agents(agents_str: &str) -> Result<Vec<Box<dyn Agent>>> {
    let agent_names: Vec<&str> = agents_str.split(',').map(|s| s.trim()).collect();
    let mut agents: Vec<Box<dyn Agent>> = Vec::new();

    for name in agent_names {
        let agent: Box<dyn Agent> = match name {
            "random_bot" => Box::new(agents::random::RandomBot::default()),
            // TODO: Enable python_bot with --features python
            // "python_bot" => {
            //     let path = PathBuf::from("agents/python_bot/agent.py");
            //     Box::new(python::PythonAgent::new(name.to_string(), path)?)
            // }
            _ => return Err(anyhow::anyhow!("Unknown agent: {} (python agents require --features python)", name)),
        };
        agents.push(agent);
    }

    Ok(agents)
}

fn load_evaluator(eval_name: &str) -> Result<Box<dyn Evaluator>> {
    let evaluator: Box<dyn Evaluator> = match eval_name {
        "win_loss" => Box::new(evaluator::WinLossEvaluator),
        "tic_tac_toe_custom" => Box::new(games::tic_tac_toe::TicTacToeEvaluator),
        _ => return Err(anyhow::anyhow!("Unknown evaluator: {}", eval_name)),
    };

    Ok(evaluator)
}
