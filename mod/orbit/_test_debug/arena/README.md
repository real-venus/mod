# Arena

A blazingly fast agent competition framework built in Rust with Python interop. Create games, define custom scoring functions, and run agent tournaments with results recorded locally or on IPFS.

## Features

- **Game Agnostic**: Define any turn-based game by implementing the `Game` trait
- **Flexible Agents**: Write agents in Rust or Python with a simple `forward()` function
- **Custom Scoring**: Create evaluators in Rust or Python to score agent performance
- **Local + IPFS Storage**: Store match results locally or on IPFS for decentralized records
- **Tournament System**: Run multiple matches and aggregate statistics
- **CLI + Python API**: Use via command line or Python mod integration

## Architecture

```
arena/
├── src/
│   ├── game.rs         # Game trait
│   ├── agent.rs        # Agent trait with forward()
│   ├── evaluator.rs    # Scoring system
│   ├── runner.rs       # Competition runner
│   ├── results.rs      # Local/IPFS storage
│   └── python.rs       # Python interop
├── games/
│   └── <game_name>/
│       ├── game.rs     # Game implementation
│       └── eval.rs     # Custom evaluator (optional)
└── agents/
    └── <agent_name>/
        └── agent.rs    # Agent implementation
        └── agent.py    # Python agent (alternative)
```

## Quick Start

### 1. Run a Match

```bash
# Rust CLI
cargo run --release -- match --game tic_tac_toe --agents random_bot,python_bot

# Python mod
import mod as m
arena = m.mod('arena')()
result = arena.match(game='tic_tac_toe', agents='random_bot,python_bot')
print(result['stdout'])
```

### 2. Run a Tournament

```bash
# Rust CLI
cargo run --release -- tournament --game tic_tac_toe --agents random_bot,python_bot --num-matches 100

# Python mod
arena = m.mod('arena')()
result = arena.tournament(game='tic_tac_toe', agents='random_bot,python_bot', num_matches=100)
print(result['stdout'])
```

### 3. View Results

```bash
# Rust CLI
cargo run --release -- results --limit 10

# Python mod
result = arena.results(limit=10)
print(result['stdout'])
```

## Creating Your Own Game

### Rust Game

Create `games/<game_name>/game.rs`:

```rust
use arena::{game::Game, impl_game_state, impl_move};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyMove {
    // Your move data
}
impl_move!(MyMove);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyState {
    // Your game state
}
impl_game_state!(MyState);

pub struct MyGame;

#[async_trait::async_trait]
impl Game for MyGame {
    type Move = MyMove;
    type State = MyState;

    fn name(&self) -> &str { "my_game" }
    fn description(&self) -> &str { "Description of your game" }
    fn init(&self) -> Self::State { /* ... */ }
    fn apply_move(&self, state: &Self::State, player: usize, mv: &Self::Move) -> arena::Result<Self::State> { /* ... */ }
    fn is_terminal(&self, state: &Self::State) -> bool { /* ... */ }
    fn valid_moves(&self, state: &Self::State, player: usize) -> Vec<Self::Move> { /* ... */ }
    fn current_player(&self, state: &Self::State) -> usize { /* ... */ }
    fn num_players(&self) -> usize { 2 }
}
```

### Custom Evaluator

Create `games/<game_name>/eval.rs`:

```rust
use arena::{evaluator::*, ArenaError};
use async_trait::async_trait;
use serde_json::Value;

pub struct MyEvaluator;

#[async_trait]
impl Evaluator for MyEvaluator {
    fn name(&self) -> &str { "my_eval" }
    fn description(&self) -> &str { "Custom scoring" }

    async fn evaluate(
        &self,
        _game_name: &str,
        agents: &[String],
        history: &Value,
        final_state: &Value,
    ) -> arena::Result<Vec<Score>> {
        // Your scoring logic here
        // Return a Score for each agent
        Ok(agents.iter().map(|agent| {
            Score::new(agent.clone(), 0.0)
                .with_metric("custom_metric", serde_json::json!(42))
        }).collect())
    }
}
```

## Creating Your Own Agent

### Rust Agent

Create `agents/<agent_name>/agent.rs`:

```rust
use arena::agent::*;
use async_trait::async_trait;
use serde_json::Value;

pub struct MyAgent {
    name: String,
}

impl MyAgent {
    pub fn new(name: String) -> Self {
        Self { name }
    }
}

#[async_trait]
impl Agent for MyAgent {
    fn name(&self) -> &str { &self.name }
    fn description(&self) -> &str { "My agent strategy" }

    async fn forward(&mut self, state: Value) -> Result<Value, AgentError> {
        // Parse state
        // Decide on move
        // Return move as JSON
        Ok(serde_json::json!({ /* your move */ }))
    }
}
```

### Python Agent

Create `agents/<agent_name>/agent.py`:

```python
import json

class Agent:
    def __init__(self):
        self.name = "my_agent"

    def forward(self, state_json: str) -> str:
        """
        Core decision function.

        Args:
            state_json: JSON string of current game state

        Returns:
            JSON string of move to make
        """
        state = json.loads(state_json)

        # Your decision logic here

        move = {"example": "move"}
        return json.dumps(move)

    # Optional hooks
    def on_match_start(self, game_name: str, num_players: int):
        pass

    def on_match_end(self, result_json: str):
        pass

    def observe(self, player: int, state_json: str, move_json: str):
        """Called when observing another player's move."""
        pass
```

## Storage

### Local Storage

Results are stored as JSON files in `./results/` by default:

```bash
./results/
├── <match-id-1>.json
├── <match-id-2>.json
└── ...
```

### IPFS Storage

Run local IPFS node and use `--storage ipfs`:

```bash
ipfs daemon
cargo run --release -- match --game tic_tac_toe --agents bot1,bot2 --storage ipfs
```

Results are pinned to IPFS and also cached locally.

## CLI Commands

```bash
# List available games
cargo run --release -- list-games

# List available agents
cargo run --release -- list-agents

# List available evaluators
cargo run --release -- list-evaluators

# Run a match
cargo run --release -- match \
  --game <game> \
  --agents <agent1>,<agent2> \
  --evaluator <evaluator> \
  --storage <local|ipfs>

# Run a tournament
cargo run --release -- tournament \
  --game <game> \
  --agents <agent1>,<agent2> \
  --num-matches <n> \
  --evaluator <evaluator>

# View results
cargo run --release -- results --limit 10
cargo run --release -- results --id <match-id>
```

## Python Mod API

```python
import mod as m

arena = m.mod('arena')()

# Run match
result = arena.match(
    game='tic_tac_toe',
    agents='random_bot,python_bot',
    evaluator='win_loss'
)

# Run tournament
result = arena.tournament(
    game='tic_tac_toe',
    agents='random_bot,python_bot',
    num_matches=100,
    evaluator='tic_tac_toe_custom'
)

# List games
result = arena.list_games()

# List agents
result = arena.list_agents()

# View results
result = arena.results(limit=10)
```

## Example: Tic-Tac-Toe

The framework includes a complete Tic-Tac-Toe implementation with:
- Game logic in `games/tic_tac_toe/game.rs`
- Custom evaluator with speed bonus in `games/tic_tac_toe/eval.rs`
- Random agent in `agents/random_bot/agent.rs`
- Smart Python agent in `agents/python_bot/agent.py`

Run it:

```bash
cargo run --release -- tournament \
  --game tic_tac_toe \
  --agents random_bot,python_bot \
  --num-matches 100 \
  --evaluator tic_tac_toe_custom
```

## Development

```bash
# Build
cargo build --release

# Test
cargo test

# Format
cargo fmt

# Lint
cargo clippy
```

## Web App 🌐

The Arena now includes a **decentralized web application** with MetaMask authentication and blockchain-based rewards!

### Features

- **MetaMask Login**: Secure wallet-based authentication using Ethereum keys
- **Global Leaderboard**: Real-time agent rankings on-chain
- **Liquidity Pool**: Businesses deposit ETH to reward top agents
- **Auto Rewards**: Distributed every N blocks based on leaderboard
- **Claim Interface**: Agent owners claim accumulated rewards

### Quick Start

```bash
# Deploy contracts to Base Sepolia
cd contracts
npm install
export PRIVATE_KEY=your_key
npm run deploy

# Start web app
cd ../app
npm install
npm run dev
# Open http://localhost:3000
```

**See detailed guides:**
- [QUICKSTART.md](./QUICKSTART.md) - Get running in 5 minutes
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [WEB_APP_SUMMARY.md](./WEB_APP_SUMMARY.md) - Architecture overview

### How It Works

1. **Compete**: Agents battle in tournaments (Rust framework)
2. **Score**: Authorities update agent scores on-chain
3. **Reward**: Top agents automatically receive ETH from liquidity pool
4. **Claim**: Agent owners withdraw rewards via web interface

Distribution: Top 10 agents every 100 blocks (1st: 30%, 2nd: 20%, etc.)

## Roadmap

- [x] Web UI for visualizing matches
- [x] Leaderboard system
- [ ] More example games (Chess, Go, Poker, Trading)
- [ ] Agent training framework integration
- [ ] Parallel tournament execution
- [ ] Game state compression
- [ ] Replay system
- [ ] Multi-token rewards (ERC20)
- [ ] Tournament verification proofs
- [ ] Governance for reward parameters

## License

MIT
