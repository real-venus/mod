use arena::{evaluator::*, ArenaError};
use async_trait::async_trait;
use serde_json::Value;

/// Custom evaluator for Tic-Tac-Toe with move efficiency bonus
pub struct TicTacToeEvaluator;

#[async_trait]
impl Evaluator for TicTacToeEvaluator {
    fn name(&self) -> &str {
        "tic_tac_toe_custom"
    }

    fn description(&self) -> &str {
        "Tic-Tac-Toe evaluator: 1.0 for win, 0.5 for draw, 0.0 for loss. Bonus for faster wins."
    }

    async fn evaluate(
        &self,
        _game_name: &str,
        agents: &[String],
        history: &Value,
        final_state: &Value,
    ) -> arena::Result<Vec<Score>> {
        let winner = final_state
            .get("winner")
            .and_then(|w| w.as_u64())
            .map(|w| w as usize);

        let num_moves = history
            .as_array()
            .ok_or_else(|| ArenaError::Eval("History is not an array".to_string()))?
            .len();

        let scores = agents
            .iter()
            .enumerate()
            .map(|(idx, agent)| {
                let base_score = if Some(idx) == winner {
                    1.0
                } else if winner.is_none() {
                    0.5 // Draw
                } else {
                    0.0
                };

                // Bonus for faster wins (max 0.2 bonus)
                let speed_bonus = if Some(idx) == winner {
                    0.2 * (1.0 - (num_moves as f64 / 9.0))
                } else {
                    0.0
                };

                let total = base_score + speed_bonus;

                Score::new(agent.clone(), total)
                    .with_metric("base_score".to_string(), serde_json::json!(base_score))
                    .with_metric("speed_bonus".to_string(), serde_json::json!(speed_bonus))
                    .with_metric("num_moves".to_string(), serde_json::json!(num_moves))
            })
            .collect();

        Ok(scores)
    }
}
