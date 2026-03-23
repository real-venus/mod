use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Score for a single agent in a match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Score {
    pub agent: String,
    pub value: f64,
    pub metrics: std::collections::HashMap<String, Value>,
}

impl Score {
    pub fn new(agent: String, value: f64) -> Self {
        Self {
            agent,
            value,
            metrics: std::collections::HashMap::new(),
        }
    }

    pub fn with_metric(mut self, key: String, value: Value) -> Self {
        self.metrics.insert(key, value);
        self
    }
}

/// Core trait for evaluating game performance
#[async_trait]
pub trait Evaluator: Send + Sync {
    /// Name of the evaluation function
    fn name(&self) -> &str;

    /// Description of what this evaluator measures
    fn description(&self) -> &str;

    /// Evaluate the game and return scores for each agent
    ///
    /// # Arguments
    /// * `game_name` - Name of the game being evaluated
    /// * `agents` - List of agent names (in player order)
    /// * `history` - Complete game history as JSON (state transitions, moves)
    /// * `final_state` - Final game state as JSON
    async fn evaluate(
        &self,
        game_name: &str,
        agents: &[String],
        history: &Value,
        final_state: &Value,
    ) -> crate::Result<Vec<Score>>;
}

/// Simple win/loss evaluator (1.0 for winner, 0.0 for losers)
pub struct WinLossEvaluator;

#[async_trait]
impl Evaluator for WinLossEvaluator {
    fn name(&self) -> &str {
        "win_loss"
    }

    fn description(&self) -> &str {
        "Simple win/loss scoring: 1.0 for winner, 0.0 for losers"
    }

    async fn evaluate(
        &self,
        _game_name: &str,
        agents: &[String],
        _history: &Value,
        final_state: &Value,
    ) -> crate::Result<Vec<Score>> {
        // Extract winner from final state
        let winner = final_state
            .get("winner")
            .and_then(|w| w.as_u64())
            .map(|w| w as usize);

        let scores = agents
            .iter()
            .enumerate()
            .map(|(idx, agent)| {
                let value = if Some(idx) == winner { 1.0 } else { 0.0 };
                Score::new(agent.clone(), value)
            })
            .collect();

        Ok(scores)
    }
}

/// Evaluator registry for dynamic loading
pub struct EvaluatorRegistry {
    evaluators: std::collections::HashMap<String, Box<dyn Evaluator>>,
}

impl EvaluatorRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            evaluators: std::collections::HashMap::new(),
        };

        // Register default evaluators
        registry.register("win_loss".to_string(), Box::new(WinLossEvaluator));

        registry
    }

    pub fn register(&mut self, name: String, evaluator: Box<dyn Evaluator>) {
        self.evaluators.insert(name, evaluator);
    }

    pub fn get(&self, name: &str) -> Option<&Box<dyn Evaluator>> {
        self.evaluators.get(name)
    }

    pub fn list(&self) -> Vec<String> {
        self.evaluators.keys().cloned().collect()
    }
}

impl Default for EvaluatorRegistry {
    fn default() -> Self {
        Self::new()
    }
}
