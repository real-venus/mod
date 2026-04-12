# Orbit Modules

The orbit ecosystem contains 200+ pluggable modules. Each module lives in `mod/orbit/` and is automatically discovered by the framework. No registration needed --- just drop a folder with an anchor file and it's live.

## Module Categories

### AI & Agents

| Module | Description |
|--------|------------|
| `agent` | Agentic AI workflows — structured tool execution with memory and planning |
| `claude` | Claude Code CLI integration — code analysis, generation, refactoring, background jobs |
| `model` | Model management and routing |
| `model.openrouter` | OpenRouter API proxy for multi-model access |
| `skill` | Skill-based task execution |
| `arena` | AI arena (stub) |

### Storage & Data

| Module | Description |
|--------|------------|
| `ipfs` | IPFS client with auto-managed Kubo daemon — `put()`, `get()`, pinning |
| `filecoin` | Filecoin storage deals |
| `lighthouse` | Lighthouse (Filecoin/IPFS) storage provider |
| `cache` | Function-level caching (`fncache`) |
| `localfs` | Local filesystem storage |

### Blockchain & DeFi

| Module | Description |
|--------|------------|
| `bridge` | Sr25519 → EVM token bridge — verify Substrate signatures, mint ERC20 tokens |
| `uniswap` | Uniswap V3 multichain strategy engine (Rust backend) — DCA, limit orders, momentum, copy trading |
| `safe` | Gnosis Safe multisig integration |
| `eth` | Ethereum utilities |
| `near` | NEAR Protocol integration |
| `solana` | Solana integration |
| `polycopy` | Polygon copy trading |
| `raydium` | Raydium DEX (Solana) |

### Dev Tools

| Module | Description |
|--------|------------|
| `git` | Git operations |
| `gitagent` | AI-powered git workflows |
| `pytest` | Python test runner |
| `conda` | Conda environment management |
| `replit` | Replit integration |
| `docker` | Docker management |

### Infrastructure

| Module | Description |
|--------|------------|
| `web` | Web utilities |
| `mcp` | Model Context Protocol |
| `modal` | Modal.com serverless |
| `proton` | Proton integration |
| `protonmail` | ProtonMail integration |

### And Many More

The full list of 200+ modules can be discovered with:

```bash
m mods
```

---

## Key Modules In Depth

### agent — Agentic AI Workflows

The agent module runs multi-step AI workflows with structured tool execution.

```python
agent = m.mod('agent')()

result = agent.forward(
    query="Build a REST API for user management",
    path="/path/to/project",
    tools=['cmd', 'git', 'deploy'],
    steps=10
)
```

**How it works**:
1. `init_memory()` — sets up goal, output format, available tools, and context
2. Runs N steps, each step:
   - Sends context to LLM (via OpenRouter, default `anthropic/claude-opus-4.5`)
   - Parses structured plan from response (`<PLAN><STEP>JSON</STEP></PLAN>`)
   - Executes tool calls from the plan
   - Appends results to context
3. `finish` tool terminates the loop

**Tool schema**: Tools are loaded dynamically via `m.schema(tool_name)` — any module can be a tool.

**Memory**: Uses `agent.memory` module for persistent context across sessions.

**Philosophy**: Aggressive, one-shot when possible. Minimal reads, maximum action.

---

### claude — Claude Code Integration

Programmatic access to Claude Code for automated code operations.

```python
claude = m.mod('claude')()

# Ask Claude
response = claude.ask("Explain this code", model="anthropic/claude-opus-4")

# Analyze code
analysis = claude.analyze_code("/path/to/file.py")

# Generate code
code = claude.generate_code("REST API with FastAPI")

# Refactor
claude.refactor("/path/to/messy.py")

# Debug
claude.debug("/path/to/broken.py")

# Edit a file with instructions
claude.edit_file("/path/to/file.py", instructions="Add error handling")
```

**Background jobs** (via Rust server at `localhost:8820`):
```python
job_id = claude.submit("Long running task")
claude.jobs()          # List all jobs
claude.job(job_id)     # Check status
claude.cancel(job_id)  # Cancel job
claude.logs(job_id)    # View logs
```

**CLI integration**: Wraps the `claude` binary, auto-installs via Homebrew if missing.

---

### ipfs — IPFS Storage

Full IPFS client with automatic daemon management.

```python
ipfs = m.mod('ipfs')()

# Store and retrieve JSON
cid = ipfs.put({'key': 'value'})
data = ipfs.get(cid)

# File operations
cid = ipfs.add_file('/path/to/file.txt')
ipfs.get_file(cid)

# Raw content
content = ipfs.cat(cid)

# Pinning
ipfs.pin_add(cid)
ipfs.pin_rm(cid)
pinned = ipfs.pins()

# Node management
ipfs.start_node()
ipfs.stop_node()
ipfs.restart_node()
status = ipfs.node_status()

# CID validation
ipfs.valid_cid('QmXyz...')  # True/False
```

**Auto-management**:
- Installs Kubo v0.40.1 if missing (macOS, Linux, Windows)
- Starts daemon automatically on first use
- Health checks every 30 seconds
- Auto-reconnects on failure
- Connects on `127.0.0.1:5001` (fallback `0.0.0.0:5001`)

---

### bridge — Token Bridge

Cross-chain bridge for Substrate (Sr25519) users to claim ERC20 tokens on EVM.

```python
bridge = m.mod('bridge')()

# Claim tokens (verify sr25519 sig, mint ERC20)
bridge.claim(auth_token='signed_token', recipient='0xEVM_ADDRESS')

# Process claims (owner)
bridge.process_claim(address='5Substrate...', recipient='0x...', amount=100)

# Batch process
bridge.batch_process_claims()

# Check unclaimed
bridge.unclaimed()

# Burn (reverse bridge)
bridge.burn(address='0x...', amount=50)

# Deploy contracts
bridge.deploy()
```

**Architecture**: Balances from snapshots (`snapshot/*.json`), claims tracked in `~/.mod/bridge`.

---

### uniswap — DEX Strategy Engine

Multichain Uniswap V3 integration with a Rust backend for strategy execution.

```python
uni = m.mod('uniswap')()

# Get a swap quote
quote = uni.quote(
    chain_id=8453,
    token_in='0xUSDC...',
    token_out='0xWETH...',
    amount_in=1000000
)

# Build a swap transaction
tx = uni.build_swap(...)

# Check pool state
state = uni.pool_state(chain_id=8453, pool='0xPool...')

# Check balance
balance = uni.balance(chain_id=8453, token='0xUSDC...', wallet='0x...')
```

**Strategy types**:
```python
# DCA (Dollar Cost Averaging)
uni.create_strategy(type='dca', interval=3600, amount=100, ...)

# Limit Order
uni.create_strategy(type='limit', target_price=2000, ...)

# Momentum (SMA crossover)
uni.create_strategy(type='momentum', short_window=10, long_window=30, ...)

# Cross-chain Arbitrage
uni.create_strategy(type='cross_chain_arb', chains=[8453, 137], ...)

# Portfolio Rebalancing
uni.create_strategy(type='rebalance', allocations={...}, ...)

# Copy Trading
uni.add_to_watchlist(wallet='0xTrader...')
uni.copy_trade(wallet='0xTrader...', max_trade_size=1000, ...)
```

**Strategy management**:
```python
uni.list_strategies()
uni.get_strategy(strategy_id)
uni.pause_strategy(strategy_id)
uni.resume_strategy(strategy_id)
uni.delete_strategy(strategy_id)
uni.strategy_history(strategy_id)
```

**Supported chains**: Base (8453), Polygon (137)
**Backend**: Rust HTTP server at `localhost:8080`

---

## Creating a New Module

1. Create the directory:
```bash
mkdir -p mod/orbit/mymod/mymod
```

2. Create the anchor file (`mod.py`):
```python
# mod/orbit/mymod/mymod/mod.py
class Mod:
    description = "What this module does"

    def forward(self, **kwargs):
        return {"status": "ok"}
```

3. Use it immediately:
```bash
m mymod
m mymod/forward
m info mymod
```

No registration, no config — it just works.
