# Arena Quick Start

Get up and running with the Arena agent competition framework in 5 minutes!

## Installation

```bash
# Ensure Rust is installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the arena
cd ~/mod/mod/orbit/arena
cargo build --release
```

## Run Your First Match

```bash
# Run a single Tic-Tac-Toe match
cargo run --release -- match \
  --game tic_tac_toe \
  --agents random_bot,python_bot
```

Output:
```
Starting match...

Match complete!
Game: tic_tac_toe
Match ID: a7f3e8b1-...
Duration: 42ms

Winner: python_bot

Scores:
  random_bot: 0.000
  python_bot: 1.000
```

## Run a Tournament

```bash
# Run 100 matches
cargo run --release -- tournament \
  --game tic_tac_toe \
  --agents random_bot,python_bot \
  --num-matches 100
```

Output:
```
Starting tournament...
Running match 1/100
Running match 2/100
...

Tournament complete!
Total matches: 100

Agent Performance:
  python_bot: 0.850 avg score, 85 wins, 100 matches
  random_bot: 0.150 avg score, 15 wins, 100 matches
```

## Create Your First Agent

### Python Agent

```bash
mkdir -p agents/my_bot
```

Create `agents/my_bot/agent.py`:

```python
import json
import random

class Agent:
    def __init__(self):
        self.name = "my_bot"

    def forward(self, state_json: str) -> str:
        """Make a move given the current state."""
        state = json.loads(state_json)
        board = state["board"]

        # Find empty cells
        moves = []
        for row in range(3):
            for col in range(3):
                if board[row][col] is None:
                    moves.append({"row": row, "col": col})

        # Pick random move
        return json.dumps(random.choice(moves))
```

### Test Your Agent

Update `src/main.rs` to include your agent in the `load_components` function:

```rust
"my_bot" => {
    let path = PathBuf::from("agents/my_bot/agent.py");
    Box::new(python::PythonAgent::new(name.to_string(), path)?)
}
```

Run it:

```bash
cargo run --release -- match \
  --game tic_tac_toe \
  --agents my_bot,python_bot
```

## Create Your First Game

### 1. Define Game State and Moves

Create `games/coin_flip/game.rs`:

```rust
use arena::{game::Game, impl_game_state, impl_move};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinFlipMove {
    pub choice: String, // "heads" or "tails"
}
impl_move!(CoinFlipMove);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinFlipState {
    pub result: Option<String>,
    pub winner: Option<usize>,
}
impl_game_state!(CoinFlipState);

pub struct CoinFlip;
```

### 2. Implement Game Trait

```rust
#[async_trait::async_trait]
impl Game for CoinFlip {
    type Move = CoinFlipMove;
    type State = CoinFlipState;

    fn name(&self) -> &str {
        "coin_flip"
    }

    fn description(&self) -> &str {
        "Simple coin flip game"
    }

    fn init(&self) -> Self::State {
        CoinFlipState {
            result: None,
            winner: None,
        }
    }

    fn apply_move(&self, state: &Self::State, player: usize, mv: &Self::Move) -> arena::Result<Self::State> {
        use rand::Rng;
        let result = if rand::thread_rng().gen_bool(0.5) {
            "heads"
        } else {
            "tails"
        };

        let winner = if mv.choice == result {
            Some(player)
        } else {
            Some(1 - player)
        };

        Ok(CoinFlipState {
            result: Some(result.to_string()),
            winner,
        })
    }

    fn is_terminal(&self, state: &Self::State) -> bool {
        state.winner.is_some()
    }

    fn valid_moves(&self, _state: &Self::State, _player: usize) -> Vec<Self::Move> {
        vec![
            CoinFlipMove { choice: "heads".to_string() },
            CoinFlipMove { choice: "tails".to_string() },
        ]
    }

    fn current_player(&self, _state: &Self::State) -> usize {
        0
    }

    fn num_players(&self) -> usize {
        2
    }
}
```

### 3. Register Your Game

Add to `src/games.rs`:

```rust
pub mod coin_flip {
    include!("../games/coin_flip/game.rs");
}
```

Update `src/main.rs`:

```rust
let game: Box<dyn std::any::Any> = match game_name {
    "tic_tac_toe" => Box::new(games::tic_tac_toe::TicTacToe::new()),
    "coin_flip" => Box::new(games::coin_flip::CoinFlip),
    _ => return Err(anyhow::anyhow!("Unknown game: {}", game_name)),
};
```

### 4. Play Your Game!

```bash
cargo run --release -- match \
  --game coin_flip \
  --agents random_bot,python_bot
```

## Create Custom Scoring

Create `games/tic_tac_toe/eval.py`:

```python
import json

class Evaluator:
    def __init__(self):
        self.name = "my_eval"

    def evaluate(self, game_name: str, agents_json: str, history_json: str, final_state_json: str) -> str:
        agents = json.loads(agents_json)
        final_state = json.loads(final_state_json)

        winner = final_state.get("winner")

        scores = []
        for idx, agent in enumerate(agents):
            score = {
                "agent": agent,
                "value": 1.0 if winner == idx else 0.0,
                "metrics": {}
            }
            scores.append(score)

        return json.dumps(scores)
```

## View Results

```bash
# List recent matches
cargo run --release -- results --limit 10

# View specific match
cargo run --release -- results --id <match-id>
```

## Use Python Mod API

```python
import mod as m

arena = m.mod('arena')()

# Run match
result = arena.match(
    game='tic_tac_toe',
    agents='random_bot,python_bot'
)
print(result['stdout'])

# Run tournament
result = arena.tournament(
    game='tic_tac_toe',
    agents='random_bot,python_bot',
    num_matches=100
)
print(result['stdout'])
```

## Next Steps

- Read the [full README](README.md) for advanced features
- Explore the Tic-Tac-Toe implementation in `games/tic_tac_toe/`
- Check out the example agents in `agents/`
- Try IPFS storage with `--storage ipfs`
- Create your own custom evaluators

## Troubleshooting

**Error: Python module not found**
- Ensure your Python agent directory structure is correct
- Check that `agent.py` exists in `agents/<name>/agent.py`

**Error: Game not found**
- Ensure you registered the game in `src/games.rs` and `src/main.rs`

**Slow performance**
- Use `--release` flag: `cargo run --release`
- First build is slow, subsequent runs are fast

## Getting Help

- Check the README for full documentation
- Look at example implementations in `games/` and `agents/`
- File issues on GitHub
