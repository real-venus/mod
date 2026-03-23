# Arena Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARENA FRAMEWORK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │     CLI      │      │  Python Mod  │      │   REST API   │  │
│  │  (clap)      │      │  Integration │      │  (future)    │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                     │           │
│         └─────────────────────┴─────────────────────┘           │
│                              │                                   │
│                    ┌─────────▼──────────┐                       │
│                    │      RUNNER        │                       │
│                    │  - run_match()     │                       │
│                    │  - run_tournament()│                       │
│                    └─────────┬──────────┘                       │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│    ┌────▼─────┐        ┌────▼─────┐        ┌────▼─────┐       │
│    │   GAME   │        │  AGENT   │        │EVALUATOR │       │
│    │  Trait   │        │  Trait   │        │  Trait   │       │
│    └────┬─────┘        └────┬─────┘        └────┬─────┘       │
│         │                   │                   │              │
│    ┌────┴─────┐        ┌────┴─────┐        ┌────┴─────┐       │
│    │   Rust   │        │   Rust   │        │   Rust   │       │
│    │  Games   │        │  Agents  │        │  Evals   │       │
│    └──────────┘        └──────────┘        └──────────┘       │
│         │                   │                   │              │
│    ┌────┴─────┐        ┌────┴─────┐        ┌────┴─────┐       │
│    │  Python  │        │  Python  │        │  Python  │       │
│    │  Games   │        │  Agents  │        │  Evals   │       │
│    │ (future) │        │ (via PyO3)│       │ (via PyO3)│       │
│    └──────────┘        └──────────┘        └──────────┘       │
│                                                                  │
│                    ┌──────────────────┐                         │
│                    │   RESULTS        │                         │
│                    │   Storage        │                         │
│                    ├──────────────────┤                         │
│                    │  LocalStorage    │                         │
│                    │  IpfsStorage     │                         │
│                    └──────────────────┘                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Core Traits

### Game Trait

Defines the rules and mechanics of a game.

```rust
trait Game {
    type Move: Move;
    type State: GameState;

    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn init(&self) -> Self::State;
    fn apply_move(&self, state: &Self::State, player: usize, mv: &Self::Move) -> Result<Self::State>;
    fn is_terminal(&self, state: &Self::State) -> bool;
    fn valid_moves(&self, state: &Self::State, player: usize) -> Vec<Self::Move>;
    fn current_player(&self, state: &Self::State) -> usize;
    fn num_players(&self) -> usize;
}
```

### Agent Trait

Defines an agent that can play games.

```rust
#[async_trait]
trait Agent {
    fn name(&self) -> &str;
    fn description(&self) -> &str;

    // Core decision function
    async fn forward(&mut self, state: Value) -> Result<Value, AgentError>;

    // Optional hooks
    async fn on_match_start(&mut self, game_name: &str, num_players: usize);
    async fn on_match_end(&mut self, result: &MatchSummary);
    async fn observe(&mut self, player: usize, state: Value, mv: Value);
}
```

### Evaluator Trait

Defines how agents are scored.

```rust
#[async_trait]
trait Evaluator {
    fn name(&self) -> &str;
    fn description(&self) -> &str;

    async fn evaluate(
        &self,
        game_name: &str,
        agents: &[String],
        history: &Value,
        final_state: &Value,
    ) -> Result<Vec<Score>>;
}
```

## Data Flow

### Single Match Flow

```
1. User invokes CLI or Python mod
      ↓
2. Runner.run_match() called
      ↓
3. Game.init() creates initial state
      ↓
4. Loop until Game.is_terminal():
   a. Game.current_player() identifies active player
   b. Agent.forward(state) returns move
   c. Game.apply_move() creates new state
   d. Other agents observe via Agent.observe()
      ↓
5. Evaluator.evaluate() scores final state
      ↓
6. MatchResult saved to Storage
      ↓
7. Results returned to user
```

### Tournament Flow

```
1. Runner.run_tournament() called
      ↓
2. For each match (1..num_matches):
   - Run single match (see above)
   - Aggregate results
      ↓
3. TournamentResult with statistics
      ↓
4. Display summary to user
```

## Directory Structure

```
arena/
├── Cargo.toml              # Rust package manifest
├── src/
│   ├── lib.rs             # Library root
│   ├── main.rs            # CLI entry point
│   ├── game.rs            # Game trait + helpers
│   ├── agent.rs           # Agent trait + registry
│   ├── evaluator.rs       # Evaluator trait + builtins
│   ├── runner.rs          # Match/tournament runner
│   ├── results.rs         # Storage backends
│   ├── python.rs          # Python interop (PyO3)
│   ├── games.rs           # Game module includes
│   └── agents.rs          # Agent module includes
│
├── games/
│   ├── <game_name>/
│   │   ├── game.rs        # Game implementation
│   │   └── eval.rs        # Optional custom evaluator
│   └── ...
│
├── agents/
│   ├── <agent_name>/
│   │   ├── agent.rs       # Rust agent
│   │   └── agent.py       # OR Python agent
│   └── ...
│
├── arena/
│   └── mod.py             # Python mod integration
│
├── results/               # Match results (gitignored)
│   └── *.json
│
└── docs/
    ├── README.md
    ├── QUICKSTART.md
    ├── EXAMPLES.md
    └── ARCHITECTURE.md (this file)
```

## Type System

### Move Types

Moves are serializable game actions:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TicTacToeMove {
    row: usize,
    col: usize,
}
impl_move!(TicTacToeMove);
```

### State Types

States represent complete game snapshots:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TicTacToeState {
    board: [[Option<usize>; 3]; 3],
    current_player: usize,
    winner: Option<usize>,
}
impl_game_state!(TicTacToeState);
```

### Score Types

Scores include value + optional metrics:

```rust
struct Score {
    agent: String,
    value: f64,
    metrics: HashMap<String, Value>,
}
```

## Python Interop

### Python Agent Interface

```python
class Agent:
    def forward(self, state_json: str) -> str:
        """Return move as JSON string"""

    def on_match_start(self, game_name: str, num_players: int):
        """Optional: called at match start"""

    def on_match_end(self, result_json: str):
        """Optional: called at match end"""

    def observe(self, player: int, state_json: str, move_json: str):
        """Optional: called when observing other player"""
```

### Python Evaluator Interface

```python
class Evaluator:
    def evaluate(
        self,
        game_name: str,
        agents_json: str,
        history_json: str,
        final_state_json: str
    ) -> str:
        """Return list of Score objects as JSON string"""
```

### PyO3 Bridge

```rust
pub struct PythonAgent {
    py_module: String,
    py_class: String,
}

impl PythonAgent {
    fn call_python<F, R>(&self, f: F) -> Result<R>
    where F: FnOnce(Python) -> PyResult<R>
}
```

## Storage System

### Local Storage

```rust
pub struct LocalStorage {
    path: PathBuf,  // ./results/
}

// Saves as: {path}/{match_id}.json
```

### IPFS Storage

```rust
pub struct IpfsStorage {
    local: LocalStorage,    // Cache
    client: IpfsClient,     // IPFS API
}

// Returns: IPFS CID (e.g., QmHash...)
```

### Result Format

```json
{
  "id": "uuid-v4",
  "game": "tic_tac_toe",
  "agents": ["bot1", "bot2"],
  "evaluator": "win_loss",
  "scores": [
    {
      "agent": "bot1",
      "value": 1.0,
      "metrics": {}
    }
  ],
  "winner": 0,
  "history": [...],
  "final_state": {...},
  "timestamp": "2024-03-22T12:00:00Z",
  "duration_ms": 42
}
```

## Extension Points

### Adding a New Game

1. Create `games/<name>/game.rs`
2. Implement `Game` trait
3. Add to `src/games.rs` include
4. Register in `src/main.rs`

### Adding a New Agent

**Rust:**
1. Create `agents/<name>/agent.rs`
2. Implement `Agent` trait
3. Register in `src/main.rs`

**Python:**
1. Create `agents/<name>/agent.py`
2. Implement `Agent` class with `forward()`
3. Register in `src/main.rs` to load via PyO3

### Adding a New Evaluator

**Rust:**
1. Create `games/<name>/eval.rs`
2. Implement `Evaluator` trait
3. Register in `src/main.rs`

**Python:**
1. Create `games/<name>/eval.py`
2. Implement `Evaluator` class with `evaluate()`
3. Register in `src/main.rs` to load via PyO3

### Adding a New Storage Backend

1. Implement `Storage` trait
2. Add to `create_storage()` in `src/main.rs`

Example:
```rust
pub struct S3Storage { ... }

#[async_trait]
impl Storage for S3Storage {
    async fn save(&self, result: &MatchResult) -> Result<String>;
    async fn load(&self, id: &str) -> Result<MatchResult>;
    async fn list(&self, limit: usize) -> Result<Vec<MatchResult>>;
    async fn query(&self, game: Option<&str>, agent: Option<&str>) -> Result<Vec<MatchResult>>;
}
```

## Performance Considerations

### Async Runtime

- Uses Tokio for async/await
- Agents can be async (e.g., API calls)
- Parallel tournament execution (future)

### Memory

- Games clone state on each move
- Use `Rc<>` or `Arc<>` for large states
- Stream results for large tournaments

### Python Bridge

- PyO3 has overhead on each call
- Consider batching multiple decisions
- Use Rust agents for performance-critical code

### Storage

- Local storage is fast
- IPFS has network overhead
- Consider caching strategies

## Security

### Sandboxing

- Python agents run in-process (no sandbox)
- Consider container/VM for untrusted code
- Validate all JSON inputs

### Resource Limits

- Implement timeouts in Agent.forward()
- Limit max game length
- Cap result storage size

## Future Enhancements

- [ ] Parallel match execution
- [ ] Web dashboard
- [ ] Streaming results
- [ ] Plugin system for games/agents
- [ ] Distributed tournaments
- [ ] Replay system
- [ ] State compression
- [ ] Agent versioning
- [ ] Matchmaking system
- [ ] Rating/ranking algorithms

## Dependencies

### Core
- `tokio` - Async runtime
- `serde` / `serde_json` - Serialization
- `async-trait` - Async traits

### Python
- `pyo3` - Python bindings
- `pyo3-asyncio` - Async Python calls

### Storage
- `ipfs-api` - IPFS integration

### CLI
- `clap` - Command line parsing
- `colored` - Terminal colors

### Utilities
- `anyhow` / `thiserror` - Error handling
- `chrono` - Timestamps
- `uuid` - Unique IDs
- `rand` - Random numbers

## Contributing

When adding new features:

1. Follow existing trait patterns
2. Add examples to EXAMPLES.md
3. Update this architecture doc
4. Include tests
5. Document public APIs

## License

MIT
