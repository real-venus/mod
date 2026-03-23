use crate::{
    agent::{Agent, MatchSummary},
    evaluator::Evaluator,
    game::Game,
    results::{MatchResult, Storage},
};
use serde_json::{json, Value};
use std::time::Instant;

/// Runs matches between agents
pub struct Runner {
    storage: Box<dyn Storage>,
}

impl Runner {
    pub fn new(storage: Box<dyn Storage>) -> Self {
        Self { storage }
    }

    /// Run a single match
    pub async fn run_match<G>(
        &self,
        game: &G,
        agents: &mut [Box<dyn Agent>],
        evaluator: &dyn Evaluator,
    ) -> crate::Result<MatchResult>
    where
        G: Game,
    {
        let start = Instant::now();
        let agent_names: Vec<String> = agents.iter().map(|a| a.name().to_string()).collect();

        // Notify agents match is starting
        for agent in agents.iter_mut() {
            agent
                .on_match_start(game.name(), game.num_players())
                .await?;
        }

        // Initialize game state
        let mut state = game.init();
        let mut history = Vec::new();

        // Game loop
        loop {
            let player = game.current_player(&state);
            let state_json = serde_json::to_value(&state)?;

            // Get move from current agent
            let mv_json = agents[player].forward(state_json.clone()).await?;

            // Deserialize move
            let mv: G::Move = serde_json::from_value(mv_json.clone())?;

            // Record move
            history.push(json!({
                "player": player,
                "state": state_json,
                "move": mv_json,
            }));

            // Notify other agents of the move
            for (idx, agent) in agents.iter_mut().enumerate() {
                if idx != player {
                    agent.observe(player, state_json.clone(), mv_json.clone()).await?;
                }
            }

            // Apply move
            state = game.apply_move(&state, player, &mv)?;

            // Check for game over
            if game.is_terminal(&state) {
                break;
            }
        }

        let duration = start.elapsed().as_millis() as u64;
        let final_state_json = serde_json::to_value(&state)?;
        let history_json = serde_json::to_value(&history)?;

        // Evaluate the match
        let scores = evaluator
            .evaluate(game.name(), &agent_names, &history_json, &final_state_json)
            .await?;

        // Determine winner (highest score)
        let winner = scores
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.value.partial_cmp(&b.value).unwrap())
            .map(|(idx, _)| idx);

        // Notify agents match ended
        let summary = MatchSummary {
            game: game.name().to_string(),
            players: agent_names.clone(),
            winner,
            scores: scores.iter().map(|s| s.value).collect(),
            moves: history.len(),
        };

        for agent in agents.iter_mut() {
            agent.on_match_end(&summary).await?;
        }

        // Create result
        let result = MatchResult::new(
            game.name().to_string(),
            agent_names,
            evaluator.name().to_string(),
            scores,
            winner,
            history_json,
            final_state_json,
            duration,
        );

        // Save result
        self.storage.save(&result).await?;

        Ok(result)
    }

    /// Run multiple matches and aggregate results
    pub async fn run_tournament<G>(
        &self,
        game: &G,
        agents: &mut [Box<dyn Agent>],
        evaluator: &dyn Evaluator,
        num_matches: usize,
    ) -> crate::Result<TournamentResult>
    where
        G: Game,
    {
        let mut results = Vec::new();

        for i in 0..num_matches {
            println!("Running match {}/{}", i + 1, num_matches);
            let result = self.run_match(game, agents, evaluator).await?;
            results.push(result);
        }

        Ok(TournamentResult::new(results))
    }

    /// Get storage backend
    pub fn storage(&self) -> &dyn Storage {
        self.storage.as_ref()
    }
}

/// Aggregated tournament results
#[derive(Debug)]
pub struct TournamentResult {
    pub matches: Vec<MatchResult>,
    pub agent_stats: std::collections::HashMap<String, AgentStats>,
}

impl TournamentResult {
    pub fn new(matches: Vec<MatchResult>) -> Self {
        let mut agent_stats: std::collections::HashMap<String, AgentStats> = std::collections::HashMap::new();

        for result in &matches {
            for (idx, agent) in result.agents.iter().enumerate() {
                let stats = agent_stats.entry(agent.clone()).or_insert_with(AgentStats::new);
                stats.matches += 1;
                stats.total_score += result.scores[idx].value;

                if result.winner == Some(idx) {
                    stats.wins += 1;
                }
            }
        }

        Self {
            matches,
            agent_stats,
        }
    }

    pub fn print_summary(&self) {
        println!("\n=== Tournament Results ===");
        println!("Total matches: {}", self.matches.len());
        println!("\nAgent Performance:");

        let mut agents: Vec<_> = self.agent_stats.iter().collect();
        agents.sort_by(|a, b| b.1.avg_score().partial_cmp(&a.1.avg_score()).unwrap());

        for (agent, stats) in agents {
            println!(
                "  {}: {:.3} avg score, {} wins, {} matches",
                agent,
                stats.avg_score(),
                stats.wins,
                stats.matches
            );
        }
    }
}

#[derive(Debug, Clone)]
pub struct AgentStats {
    pub matches: usize,
    pub wins: usize,
    pub total_score: f64,
}

impl AgentStats {
    pub fn new() -> Self {
        Self {
            matches: 0,
            wins: 0,
            total_score: 0.0,
        }
    }

    pub fn avg_score(&self) -> f64 {
        if self.matches > 0 {
            self.total_score / self.matches as f64
        } else {
            0.0
        }
    }

    pub fn win_rate(&self) -> f64 {
        if self.matches > 0 {
            self.wins as f64 / self.matches as f64
        } else {
            0.0
        }
    }
}

impl Default for AgentStats {
    fn default() -> Self {
        Self::new()
    }
}
