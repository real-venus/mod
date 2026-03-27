# evocoin

Evolutionary token protocol on Base Sepolia. Hub-and-spoke exchange where spoke tokens trade against a central EVO token via bonding curves, and AI agents evolve optimal tokenomics through generational selection.

## How it works

**On-chain**: TokenFactory deploys spoke tokens registered in EvoRegistry with configurable bonding curves. HubExchange handles all trading -- users deposit EVO, receive spoke tokens priced by the curve. Fees split between the token creator and a burn mechanism.

**Off-chain**: LLM agents (cloud or local 1-bit quantized models) run evolutionary simulations. Creator agents propose token configs, investor agents allocate virtual capital, top performers survive and mutate into the next generation. The result is AI-discovered optimal tokenomics.

## Architecture

```
evocoin/
├── contracts/              # Solidity (OpenZeppelin)
│   ├── EvoToken.sol        # Hub ERC20 (10M supply)
│   ├── HubExchange.sol     # Bonding curve trading engine
│   ├── SpokeToken.sol      # Spoke ERC20 (mint/burn by exchange)
│   ├── EvoRegistry.sol     # Token metadata + fitness scores
│   └── TokenFactory.sol    # One-tx spoke deployment
├── engine/                 # Rust backend (Axum)
│   └── src/
│       ├── main.rs         # Server entry
│       ├── routes.rs       # REST endpoints
│       ├── config.rs       # Chain config loader
│       ├── contracts.rs    # ABI bindings
│       └── types.rs        # Shared types
├── evocoin/                # Python mod
│   ├── mod.py              # CLI interface + simulation
│   └── agents/unbit/       # Local LLM agents
│       ├── agent.py        # Creator/Investor agent classes
│       ├── server.py       # FastAPI server (port 8421)
│       ├── models.py       # GGUF model registry
│       └── cli.py          # Agent CLI commands
├── test/
│   └── EvoCoin.test.js     # 35+ Hardhat tests
├── scripts/
│   ├── deploy.js           # Base Sepolia deployment
│   └── simulate.js         # Hardhat-local simulation
├── config.json             # Contract addresses + engine config
└── hardhat.config.js
```

## Bonding curves

| Type | ID | Pricing | Use case |
|------|-----|---------|----------|
| Linear | 0 | Price scales with supply (sqrt returns) | Predictable growth |
| Exponential | 1 | `param * (supply/SCALE)^2` | Moon-or-bust |
| Sigmoid | 2 | `SCALE * supply / (supply + midpoint)` | Capped upside |
| Fixed | 3 | Constant price | Stablecoins |

## Setup

```bash
cp .env.example .env
# Fill in PRIVATE_KEY and optionally OPENROUTER_API_KEY

npm install          # Hardhat + ethers
```

### Deploy contracts

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

### Run the Rust engine

```bash
cd engine && cargo run
# Serves on port 8420
```

## Usage (mod CLI)

```bash
# List all spoke tokens
m evocoin scan

# Get token details
m evocoin info spoke=0x...

# Check spot price
m evocoin price spoke=0x...

# Create a new spoke token
m evocoin create name=MoonShot symbol=MOON curve_type=1 curve_param=500 buy_fee=250 sell_fee=250

# Buy spoke tokens with EVO
m evocoin buy spoke=0x... evo_amount=1000

# Sell spoke tokens back to EVO
m evocoin sell spoke=0x... spoke_amount=500

# Health check
m evocoin health
```

## Evolutionary simulation

Run AI-driven tokenomics discovery:

```bash
# Default: 5 generations, 6 agents, top 2 survive
m evocoin simulate

# Custom parameters
m evocoin simulate generations=10 agents_per_gen=8 top_k=3
```

Each generation:
1. **Propose** -- Creator agents design tokens (curve type, fees, burn %)
2. **Invest** -- Investor agents allocate 10,000 virtual capital across proposals
3. **Rank** -- Tokens sorted by total investment (fitness)
4. **Select** -- Top-K survive, rest eliminated
5. **Mutate** -- Survivors' params vary +-20%, fees +-50-100 bps
6. **Repeat** -- New agents join survivors for the next round

### Local LLM agents (UnBit)

Run simulations offline with 1-bit quantized models:

```bash
# Available models
#   qwen-0.5b-q2   (230 MB, default, best JSON output)
#   smollm-135m    (75 MB, fastest)
#   llama-1b-q1    (460 MB, balanced)

# Download and start
python -m evocoin.agents.unbit download --model qwen-0.5b-q2
python -m evocoin.agents.unbit serve

# Or use cloud LLMs via OpenRouter
export OPENROUTER_API_KEY=...
export EVOCOIN_LLM_MODEL=mistralai/mistral-7b-instruct:free
```

## Engine API

Read endpoints (chain state):

```
GET  /health              # Server + contract status
GET  /info                # Protocol overview
GET  /spokes              # List tokens (paginated)
GET  /spokes/:address     # Token details
GET  /spokes/creator/:addr # Tokens by creator
GET  /price/:address      # Spot price
GET  /balance/:token/:wallet
```

Write endpoints (return unsigned tx data for client-side signing):

```
POST /tx/create           # Build spoke creation tx
POST /tx/buy              # Build buy tx
POST /tx/sell             # Build sell tx
```

## Testing

```bash
npx hardhat test
```

Covers all four curve types, fee distribution, burn mechanics, slippage protection, registry pagination, and full integration flows.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Deployer wallet key |
| `BASE_TESTNET_RPC_URL` | No | Defaults to `https://sepolia.base.org` |
| `OPENROUTER_API_KEY` | No | Cloud LLM for simulation |
| `EVOCOIN_LLM_MODEL` | No | Defaults to `mistralai/mistral-7b-instruct:free` |
| `UNBIT_BACKEND` | No | `llama_cpp` (default) or `ollama` |
| `UNBIT_MODEL` | No | `qwen-0.5b-q2` (default), `smollm-135m`, `llama-1b-q1` |
