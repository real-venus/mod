use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("Invalid move: {0}")]
    InvalidMove(String),

    #[error("Agent failed: {0}")]
    Failed(String),

    #[error("Timeout")]
    Timeout,
}

/// Core trait for agents that play games
#[async_trait]
pub trait Agent: Send + Sync {
    /// Name of the agent
    fn name(&self) -> &str;

    /// Description of the agent's strategy
    fn description(&self) -> &str;

    /// The forward function - core decision making
    /// Takes game state as JSON and returns a move as JSON
    async fn forward(&mut self, state: Value) -> Result<Value, AgentError>;

    /// Optional: Called at the start of a match
    async fn on_match_start(&mut self, _game_name: &str, _num_players: usize) -> Result<(), AgentError> {
        Ok(())
    }

    /// Optional: Called at the end of a match
    async fn on_match_end(&mut self, _result: &MatchSummary) -> Result<(), AgentError> {
        Ok(())
    }

    /// Optional: Called when agent observes another player's move
    async fn observe(&mut self, _player: usize, _state: Value, _mv: Value) -> Result<(), AgentError> {
        Ok(())
    }
}

/// Summary of a match for agent learning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchSummary {
    pub game: String,
    pub players: Vec<String>,
    pub winner: Option<usize>,
    pub scores: Vec<f64>,
    pub moves: usize,
}

/// Agent registry for dynamic loading
pub struct AgentRegistry {
    agents: std::collections::HashMap<String, Box<dyn Agent>>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            agents: std::collections::HashMap::new(),
        }
    }

    pub fn register(&mut self, name: String, agent: Box<dyn Agent>) {
        self.agents.insert(name, agent);
    }

    pub fn get(&self, name: &str) -> Option<&Box<dyn Agent>> {
        self.agents.get(name)
    }

    pub fn get_mut(&mut self, name: &str) -> Option<&mut Box<dyn Agent>> {
        self.agents.get_mut(name)
    }

    pub fn list(&self) -> Vec<String> {
        self.agents.keys().cloned().collect()
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}
