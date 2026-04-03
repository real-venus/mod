use arena::agent::*;
use async_trait::async_trait;
use rand::seq::SliceRandom;
use serde_json::Value;

/// Simple random agent that picks random valid moves
pub struct RandomBot {
    name: String,
}

impl RandomBot {
    pub fn new(name: String) -> Self {
        Self { name }
    }
}

impl Default for RandomBot {
    fn default() -> Self {
        Self::new("random_bot".to_string())
    }
}

#[async_trait]
impl Agent for RandomBot {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        "Random agent that picks random valid moves"
    }

    async fn forward(&mut self, state: Value) -> Result<Value, AgentError> {
        // Parse state to find valid moves
        let board = state
            .get("board")
            .and_then(|b| b.as_array())
            .ok_or_else(|| AgentError::InvalidMove("No board in state".to_string()))?;

        // Find empty cells
        let mut valid_moves = Vec::new();
        for (row_idx, row) in board.iter().enumerate() {
            if let Some(row_arr) = row.as_array() {
                for (col_idx, cell) in row_arr.iter().enumerate() {
                    if cell.is_null() {
                        valid_moves.push((row_idx, col_idx));
                    }
                }
            }
        }

        if valid_moves.is_empty() {
            return Err(AgentError::InvalidMove("No valid moves".to_string()));
        }

        // Pick random move
        let mut rng = rand::thread_rng();
        let (row, col) = valid_moves
            .choose(&mut rng)
            .ok_or_else(|| AgentError::Failed("Failed to choose move".to_string()))?;

        Ok(serde_json::json!({
            "row": row,
            "col": col,
        }))
    }
}
