# Arena Examples

Real-world examples of games, agents, and evaluators you can build with Arena.

## Table of Contents

- [Simple Games](#simple-games)
  - [Coin Flip](#coin-flip)
  - [Dice Roll](#dice-roll)
  - [Rock Paper Scissors](#rock-paper-scissors)
- [Strategic Games](#strategic-games)
  - [Connect Four](#connect-four)
  - [Battleship](#battleship)
- [AI Training Games](#ai-training-games)
  - [Trading Simulator](#trading-simulator)
  - [Negotiation Game](#negotiation-game)
- [Advanced Agents](#advanced-agents)
  - [Minimax Agent](#minimax-agent)
  - [Monte Carlo Tree Search](#monte-carlo-tree-search)
  - [Neural Network Agent](#neural-network-agent)
- [Custom Evaluators](#custom-evaluators)
  - [ELO Rating System](#elo-rating-system)
  - [Multi-Objective Scoring](#multi-objective-scoring)

---

## Simple Games

### Coin Flip

A simple probability game where players guess coin flips.

**Game Logic** (`games/coin_flip/game.rs`):

```rust
use arena::{game::Game, impl_game_state, impl_move};
use serde::{Deserialize, Serialize};
use rand::Rng;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinMove {
    pub guess: String, // "heads" or "tails"
}
impl_move!(CoinMove);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinState {
    pub round: usize,
    pub max_rounds: usize,
    pub scores: Vec<usize>,
    pub last_result: Option<String>,
    pub current_player: usize,
}
impl_game_state!(CoinState);

pub struct CoinFlip {
    max_rounds: usize,
}

impl CoinFlip {
    pub fn new(max_rounds: usize) -> Self {
        Self { max_rounds }
    }
}

#[async_trait::async_trait]
impl Game for CoinFlip {
    type Move = CoinMove;
    type State = CoinState;

    fn name(&self) -> &str { "coin_flip" }
    fn description(&self) -> &str { "Multi-round coin flipping game" }
    fn num_players(&self) -> usize { 2 }

    fn init(&self) -> Self::State {
        CoinState {
            round: 0,
            max_rounds: self.max_rounds,
            scores: vec![0, 0],
            last_result: None,
            current_player: 0,
        }
    }

    fn apply_move(&self, state: &Self::State, player: usize, mv: &Self::Move) -> arena::Result<Self::State> {
        let result = if rand::thread_rng().gen_bool(0.5) { "heads" } else { "tails" };
        let mut new_state = state.clone();

        if mv.guess == result {
            new_state.scores[player] += 1;
        }

        new_state.round += 1;
        new_state.last_result = Some(result.to_string());
        new_state.current_player = 1 - player;

        Ok(new_state)
    }

    fn is_terminal(&self, state: &Self::State) -> bool {
        state.round >= state.max_rounds
    }

    fn valid_moves(&self, _state: &Self::State, _player: usize) -> Vec<Self::Move> {
        vec![
            CoinMove { guess: "heads".to_string() },
            CoinMove { guess: "tails".to_string() },
        ]
    }

    fn current_player(&self, state: &Self::State) -> usize {
        state.current_player
    }
}
```

---

### Rock Paper Scissors

Classic hand game with best-of-N rounds.

**Python Agent** (`agents/rps_bot/agent.py`):

```python
import json
import random

class Agent:
    def __init__(self):
        self.name = "rps_bot"
        self.opponent_history = []

    def forward(self, state_json: str) -> str:
        state = json.loads(state_json)

        # Adaptive strategy based on opponent patterns
        if len(self.opponent_history) > 3:
            # Find most common opponent move
            most_common = max(set(self.opponent_history), key=self.opponent_history.count)
            # Counter it
            counter = {"rock": "paper", "paper": "scissors", "scissors": "rock"}
            move = counter[most_common]
        else:
            # Random start
            move = random.choice(["rock", "paper", "scissors"])

        return json.dumps({"choice": move})

    def observe(self, player: int, state_json: str, move_json: str):
        """Track opponent moves."""
        if player != 0:  # If not us
            move = json.loads(move_json)
            self.opponent_history.append(move["choice"])
```

---

## Strategic Games

### Connect Four

Gravity-based 4-in-a-row game.

**Game Logic** (`games/connect_four/game.rs`):

```rust
use arena::{game::Game, impl_game_state, impl_move};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectFourMove {
    pub column: usize,
}
impl_move!(ConnectFourMove);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectFourState {
    pub board: Vec<Vec<Option<usize>>>, // 6 rows x 7 columns
    pub current_player: usize,
    pub winner: Option<usize>,
}
impl_game_state!(ConnectFourState);

pub struct ConnectFour;

impl ConnectFour {
    fn check_winner(&self, board: &[Vec<Option<usize>>]) -> Option<usize> {
        // Check horizontal, vertical, and diagonal wins
        // ... implementation details ...
        None
    }
}

#[async_trait::async_trait]
impl Game for ConnectFour {
    type Move = ConnectFourMove;
    type State = ConnectFourState;

    fn name(&self) -> &str { "connect_four" }
    fn description(&self) -> &str { "Connect 4 pieces in a row" }
    fn num_players(&self) -> usize { 2 }

    fn init(&self) -> Self::State {
        ConnectFourState {
            board: vec![vec![None; 7]; 6],
            current_player: 0,
            winner: None,
        }
    }

    fn apply_move(&self, state: &Self::State, player: usize, mv: &Self::Move) -> arena::Result<Self::State> {
        let mut new_board = state.board.clone();

        // Find lowest empty row in column
        for row in (0..6).rev() {
            if new_board[row][mv.column].is_none() {
                new_board[row][mv.column] = Some(player);
                break;
            }
        }

        let winner = self.check_winner(&new_board);

        Ok(ConnectFourState {
            board: new_board,
            current_player: 1 - player,
            winner,
        })
    }

    fn is_terminal(&self, state: &Self::State) -> bool {
        state.winner.is_some() || state.board[0].iter().all(|cell| cell.is_some())
    }

    fn valid_moves(&self, state: &Self::State, _player: usize) -> Vec<Self::Move> {
        (0..7)
            .filter(|&col| state.board[0][col].is_none())
            .map(|col| ConnectFourMove { column: col })
            .collect()
    }

    fn current_player(&self, state: &Self::State) -> usize {
        state.current_player
    }
}
```

---

## AI Training Games

### Trading Simulator

Agents trade stocks based on market data.

**Game Logic** (`games/trading/game.rs`):

```rust
use arena::{game::Game, impl_game_state, impl_move};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeMove {
    pub action: String, // "buy", "sell", "hold"
    pub amount: f64,
}
impl_move!(TradeMove);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingState {
    pub day: usize,
    pub max_days: usize,
    pub price: f64,
    pub price_history: Vec<f64>,
    pub portfolios: Vec<Portfolio>,
    pub current_player: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Portfolio {
    pub cash: f64,
    pub shares: f64,
}

impl_game_state!(TradingState);

pub struct TradingGame {
    max_days: usize,
    initial_cash: f64,
}

#[async_trait::async_trait]
impl Game for TradingGame {
    type Move = TradeMove;
    type State = TradingState;

    fn name(&self) -> &str { "trading" }
    fn description(&self) -> &str { "Stock trading competition" }
    fn num_players(&self) -> usize { 2 }

    fn init(&self) -> Self::State {
        TradingState {
            day: 0,
            max_days: self.max_days,
            price: 100.0,
            price_history: vec![100.0],
            portfolios: vec![
                Portfolio { cash: self.initial_cash, shares: 0.0 },
                Portfolio { cash: self.initial_cash, shares: 0.0 },
            ],
            current_player: 0,
        }
    }

    fn apply_move(&self, state: &Self::State, player: usize, mv: &Self::Move) -> arena::Result<Self::State> {
        let mut new_state = state.clone();
        let portfolio = &mut new_state.portfolios[player];

        match mv.action.as_str() {
            "buy" => {
                let cost = mv.amount * state.price;
                if portfolio.cash >= cost {
                    portfolio.cash -= cost;
                    portfolio.shares += mv.amount;
                }
            }
            "sell" => {
                if portfolio.shares >= mv.amount {
                    portfolio.cash += mv.amount * state.price;
                    portfolio.shares -= mv.amount;
                }
            }
            "hold" => {}
            _ => return Err(arena::ArenaError::Game("Invalid action".to_string())),
        }

        // Update market price (random walk)
        use rand::Rng;
        let change = rand::thread_rng().gen_range(-5.0..5.0);
        new_state.price = (new_state.price + change).max(1.0);
        new_state.price_history.push(new_state.price);

        new_state.day += 1;
        new_state.current_player = (player + 1) % self.num_players();

        Ok(new_state)
    }

    fn is_terminal(&self, state: &Self::State) -> bool {
        state.day >= state.max_days
    }

    fn valid_moves(&self, state: &Self::State, player: usize) -> Vec<Self::Move> {
        let portfolio = &state.portfolios[player];
        let max_buy = (portfolio.cash / state.price).floor();

        vec![
            TradeMove { action: "hold".to_string(), amount: 0.0 },
            TradeMove { action: "buy".to_string(), amount: max_buy },
            TradeMove { action: "sell".to_string(), amount: portfolio.shares },
        ]
    }

    fn current_player(&self, state: &Self::State) -> usize {
        state.current_player
    }
}
```

**Custom Evaluator** (`games/trading/eval.rs`):

```rust
use arena::{evaluator::*, ArenaError};
use async_trait::async_trait;
use serde_json::Value;

pub struct TradingEvaluator;

#[async_trait]
impl Evaluator for TradingEvaluator {
    fn name(&self) -> &str { "trading_pnl" }
    fn description(&self) -> &str { "Profit & Loss scoring for trading game" }

    async fn evaluate(
        &self,
        _game_name: &str,
        agents: &[String],
        _history: &Value,
        final_state: &Value,
    ) -> arena::Result<Vec<Score>> {
        let portfolios = final_state["portfolios"].as_array()
            .ok_or_else(|| ArenaError::Eval("No portfolios".to_string()))?;
        let final_price = final_state["price"].as_f64()
            .ok_or_else(|| ArenaError::Eval("No price".to_string()))?;

        let scores = agents.iter().enumerate().map(|(idx, agent)| {
            let portfolio = &portfolios[idx];
            let cash = portfolio["cash"].as_f64().unwrap_or(0.0);
            let shares = portfolio["shares"].as_f64().unwrap_or(0.0);
            let total_value = cash + (shares * final_price);

            Score::new(agent.clone(), total_value)
                .with_metric("cash", serde_json::json!(cash))
                .with_metric("shares", serde_json::json!(shares))
                .with_metric("final_price", serde_json::json!(final_price))
        }).collect();

        Ok(scores)
    }
}
```

---

## Advanced Agents

### Minimax Agent

Perfect play for deterministic games like Tic-Tac-Toe.

**Rust Agent** (`agents/minimax_bot/agent.rs`):

```rust
use arena::agent::*;
use async_trait::async_trait;
use serde_json::Value;

pub struct MinimaxAgent {
    name: String,
    max_depth: usize,
}

impl MinimaxAgent {
    pub fn new(name: String, max_depth: usize) -> Self {
        Self { name, max_depth }
    }

    fn minimax(&self, state: &Value, depth: usize, is_maximizing: bool) -> f64 {
        // Minimax algorithm implementation
        // ...
        0.0
    }

    fn evaluate_state(&self, state: &Value) -> f64 {
        // Heuristic evaluation of game state
        // ...
        0.0
    }
}

#[async_trait]
impl Agent for MinimaxAgent {
    fn name(&self) -> &str { &self.name }
    fn description(&self) -> &str { "Minimax agent with alpha-beta pruning" }

    async fn forward(&mut self, state: Value) -> Result<Value, AgentError> {
        // Get valid moves
        let board = state["board"].as_array()
            .ok_or_else(|| AgentError::InvalidMove("No board".to_string()))?;

        let mut best_move = None;
        let mut best_score = f64::NEG_INFINITY;

        // Try each valid move
        for row in 0..3 {
            for col in 0..3 {
                if board[row][col].is_null() {
                    // Simulate move
                    let mut new_state = state.clone();
                    // ... apply move ...

                    let score = self.minimax(&new_state, self.max_depth, false);

                    if score > best_score {
                        best_score = score;
                        best_move = Some((row, col));
                    }
                }
            }
        }

        let (row, col) = best_move
            .ok_or_else(|| AgentError::InvalidMove("No valid moves".to_string()))?;

        Ok(serde_json::json!({ "row": row, "col": col }))
    }
}
```

---

### Neural Network Agent

ML-powered agent using PyTorch.

**Python Agent** (`agents/nn_bot/agent.py`):

```python
import json
import torch
import torch.nn as nn

class GameNet(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)

class Agent:
    def __init__(self):
        self.name = "nn_bot"
        self.model = GameNet(input_size=9, hidden_size=64, output_size=9)
        # Load pretrained weights
        # self.model.load_state_dict(torch.load("model.pth"))
        self.model.eval()

    def forward(self, state_json: str) -> str:
        state = json.loads(state_json)
        board = state["board"]

        # Convert board to tensor
        board_flat = []
        for row in board:
            for cell in row:
                if cell is None:
                    board_flat.append(0)
                elif cell == 0:
                    board_flat.append(1)
                else:
                    board_flat.append(-1)

        x = torch.tensor(board_flat, dtype=torch.float32).unsqueeze(0)

        # Get move probabilities
        with torch.no_grad():
            logits = self.model(x)
            probs = torch.softmax(logits, dim=1).squeeze()

        # Mask invalid moves
        for row in range(3):
            for col in range(3):
                if board[row][col] is not None:
                    probs[row * 3 + col] = 0

        # Pick best valid move
        move_idx = torch.argmax(probs).item()
        row = move_idx // 3
        col = move_idx % 3

        return json.dumps({"row": row, "col": col})
```

---

## Custom Evaluators

### ELO Rating System

Track agent ratings across multiple games.

```rust
use arena::{evaluator::*, ArenaError};
use async_trait::async_trait;
use serde_json::Value;

pub struct ELOEvaluator {
    k_factor: f64,
}

impl ELOEvaluator {
    pub fn new(k_factor: f64) -> Self {
        Self { k_factor }
    }

    fn expected_score(&self, rating_a: f64, rating_b: f64) -> f64 {
        1.0 / (1.0 + 10_f64.powf((rating_b - rating_a) / 400.0))
    }

    fn update_rating(&self, old_rating: f64, actual: f64, expected: f64) -> f64 {
        old_rating + self.k_factor * (actual - expected)
    }
}

#[async_trait]
impl Evaluator for ELOEvaluator {
    fn name(&self) -> &str { "elo" }
    fn description(&self) -> &str { "ELO rating system" }

    async fn evaluate(
        &self,
        _game_name: &str,
        agents: &[String],
        _history: &Value,
        final_state: &Value,
    ) -> arena::Result<Vec<Score>> {
        let winner = final_state["winner"].as_u64().map(|w| w as usize);

        // Get current ratings (would normally load from storage)
        let rating_a = 1500.0;
        let rating_b = 1500.0;

        let expected_a = self.expected_score(rating_a, rating_b);
        let expected_b = 1.0 - expected_a;

        let (actual_a, actual_b) = match winner {
            Some(0) => (1.0, 0.0),
            Some(1) => (0.0, 1.0),
            _ => (0.5, 0.5), // Draw
        };

        let new_rating_a = self.update_rating(rating_a, actual_a, expected_a);
        let new_rating_b = self.update_rating(rating_b, actual_b, expected_b);

        Ok(vec![
            Score::new(agents[0].clone(), new_rating_a)
                .with_metric("old_rating", serde_json::json!(rating_a))
                .with_metric("expected", serde_json::json!(expected_a)),
            Score::new(agents[1].clone(), new_rating_b)
                .with_metric("old_rating", serde_json::json!(rating_b))
                .with_metric("expected", serde_json::json!(expected_b)),
        ])
    }
}
```

---

## Running Examples

```bash
# Simple game
./arena.sh match --game coin_flip --agents random_bot,python_bot

# Strategic game with smart agents
./arena.sh tournament --game connect_four --agents minimax_bot,nn_bot --num-matches 50

# Trading competition with custom scoring
./arena.sh tournament --game trading --agents trader1,trader2 --evaluator trading_pnl --num-matches 100

# View ELO ratings over time
./arena.sh results --limit 100 | grep "elo"
```

## Tips

1. **Start Simple**: Build simple games first, then add complexity
2. **Test Agents**: Run against random bot to verify basic functionality
3. **Custom Metrics**: Use evaluator metrics to track detailed performance
4. **Iterate Fast**: Use Python agents for rapid prototyping, Rust for performance
5. **Store Results**: IPFS storage enables decentralized leaderboards

## Need Help?

Check the main [README](README.md) or [QUICKSTART](QUICKSTART.md) guide!
