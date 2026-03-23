pub mod agent;
pub mod evaluator;
pub mod game;
// pub mod python;  // TODO: Enable with --features python
pub mod results;
pub mod runner;

pub use agent::{Agent, AgentError};
pub use evaluator::{Evaluator, Score};
pub use game::{Game, GameState, Move};
pub use results::{MatchResult, Storage};
pub use runner::Runner;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ArenaError {
    #[error("Agent error: {0}")]
    Agent(#[from] AgentError),

    #[error("Game error: {0}")]
    Game(String),

    #[error("Evaluation error: {0}")]
    Eval(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Python error: {0}")]
    Python(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, ArenaError>;
