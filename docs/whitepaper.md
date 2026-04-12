# MOD Protocol: Decentralized Modular Computation with Time-Weighted Revenue Distribution

**Version 2.0 | April 2026**

**Abstract.** MOD Protocol is a decentralized framework for building, deploying, and monetizing composable software modules. The protocol unifies on-chain economic primitives with off-chain computation across a five-layer architecture: a Python framework core with 200+ composable orbit modules, the BlocTime smart contract suite on Base (EVM), a FastAPI service layer, IPFS-backed distributed storage, and a Next.js frontend. Developers register callable functions on-chain, set prices, and earn revenue on every invocation. Revenue flows through a Treasury contract and is distributed to BlocTime stakers via a novel time-weighted multiplier mechanism---without inflationary token emission. All core contracts implement `setOwnerless()` for irreversible decentralization. The protocol supports multi-chain operation across EVM, Substrate, and Solana ecosystems.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Protocol Architecture](#2-protocol-architecture)
3. [BlocTime Smart Contract Suite](#3-bloctime-smart-contract-suite)
4. [Tokenomics & Economic Model](#4-tokenomics--economic-model)
5. [Module System & Orbit Ecosystem](#5-module-system--orbit-ecosystem)
6. [On-Chain Registry & Marketplace](#6-on-chain-registry--marketplace)
7. [Oracle System & Price Feeds](#7-oracle-system--price-feeds)
8. [Debit Protocol & EIP-712 Authorization](#8-debit-protocol--eip-712-authorization)
9. [AI-Native Architecture](#9-ai-native-architecture)
10. [Security Model](#10-security-model)
11. [Governance & Decentralization Path](#11-governance--decentralization-path)
12. [Network Deployment](#12-network-deployment)
13. [Conclusion](#13-conclusion)

---

## 1. Introduction

### 1.1 Problem Statement

Modern software development relies on composable libraries and microservices, yet developers receive no direct economic benefit when their code is consumed by others at runtime. Package registries (npm, PyPI) track downloads but provide no revenue mechanism. Existing blockchain-based marketplaces either (a) require developers to learn Solidity/smart contract development, (b) operate inflationary token models divorced from real economic activity, or (c) lack the composability needed for general-purpose software engineering.

Meanwhile, AI is transforming development workflows but remains siloed---models run in walled gardens with no interoperability, no on-chain settlement, and no way for developers to monetize autonomous agent actions.

### 1.2 Solution

MOD Protocol bridges the gap between on-chain economics and off-chain development:

1. **Zero-friction module registration**: Drop a Python module into the orbit directory; the framework auto-discovers it with zero configuration.
2. **On-chain revenue flow**: Module invocations generate fees that accumulate in a Treasury contract and are distributed to stakers.
3. **Time-weighted staking**: BlocTime rewards long-term commitment through a configurable multiplier curve---longer lock durations yield proportionally larger treasury shares.
4. **Non-inflationary rewards**: All staker rewards derive from real marketplace activity (credit fees, debit fees), not token minting.
5. **AI-native execution**: Built-in agent framework, Claude integration, and persistent memory enable autonomous module composition.
6. **Irreversible decentralization**: Every core contract includes `setOwnerless()`, a one-way function that permanently renounces administrative control.

### 1.3 Design Principles

- **Composability over monolithism**: 200+ independent modules that compose at runtime.
- **Revenue from usage, not inflation**: Treasury rewards funded exclusively by marketplace fees.
- **Progressive decentralization**: Contracts begin owner-managed, with an irreversible path to full autonomy.
- **AI-native by default**: Agent workflows, memory, and tool execution are first-class primitives.
- **Multi-chain by design**: Native support for EVM (Base, Ethereum, Polygon), Substrate (Polkadot), and Solana.

---

## 2. Protocol Architecture

### 2.1 Five-Layer Stack

```
 LAYER 5  [ FRONTEND ]     Next.js 14 + TypeScript + ethers.js v6
           │
 LAYER 4  [ SERVICE  ]     FastAPI async endpoints + module registry + IPFS
           │
 LAYER 3  [ MODULES  ]     200+ composable Python orbit modules
           │
 LAYER 2  [ CHAIN    ]     BlocTime Protocol contracts (Solidity 0.8.20, Base)
           │
 LAYER 1  [ CORE     ]     mod.py framework engine (crypto, storage, routing)
```

### 2.2 Data Flow

```
Developer → registers module on-chain (Registry.sol)
         → uploads code to IPFS
         → sets price in config.json

User → discovers module via frontend/API
     → deposits stablecoins into Market (credit)
     → invokes module function (debit)
     → fee split: 5% → Treasury, remainder → provider

Staker → stakes NativeToken into BlocTime
       → receives BlocTime tokens (time-weighted)
       → claims proportional share of Treasury revenue
```

### 2.3 Core Framework: `mod.py`

The framework engine (`mod/core/mod.py`) provides:

| Subsystem | Description |
|-----------|-------------|
| **Module Discovery** | Anchor-file pattern: `agent.py` > `mod.py` > `block.py` > `{name}.py` |
| **Cryptographic Primitives** | ECDSA key generation, AES-256 encryption, signature verification |
| **Storage** | Encrypted key-value store at `~/.mod/{module}/` |
| **Server Management** | Process lifecycle for API servers per module |
| **Git Integration** | Commit, push, repo discovery |
| **AI Integration** | Claude API, OpenRouter, agent orchestration |
| **Execution** | Thread/process pool executors with function-level caching |

Module loading is lazy and O(1):

```python
m.mod('agent')()         # Load module class
m.fn('agent/run')(q='.') # Call module function directly
```

---

## 3. BlocTime Smart Contract Suite

All contracts are compiled with Solidity 0.8.20, use OpenZeppelin libraries, and are deployed on Base Sepolia (Chain ID: 84532).

### 3.1 Contract Addresses (Base Sepolia)

| Contract | Address | Role |
|----------|---------|------|
| NativeToken | `0xB9b6F5CdB25f8BC9fC88CA171381B509Df907b51` | Stakeable ERC20 |
| BlocTime | `0xF25AAFDd0A842ff50b041595C79210b48d6795bD` | Time-weighted staking |
| Treasury | `0xe9a96Ae58108E9Dd7e14c5DdCb66C175BB877785` | Revenue distribution |
| Market | `0x2F0B61616Fbf662A4f4C544D7d5d909D74ef7687` | Stablecoin marketplace |
| Registry | `0x4f9e72C935e5762E941F98DA50696cb022008a43` | Module registration |
| Debit | `0x6F941E762C7Df3db8DfD0C47d53Acd85D73Da442` | EIP-712 signed debits |
| TokenGate | `0x97c7a7066e80F13Ee4ABEdeaA223CbC71472de8b` | Whitelist & oracle registry |
| ManualPriceOracle | `0x40C37CA1321f967831c86E5AF8935aC043F9adF1` | Price feeds |
| USDC | `0xe22970F0bB899C7D615ED522B2a807629F99ec01` | Test stablecoin |
| USDT | `0xc68d5E71404cAb1101597B7531A5738873E226Bc` | Test stablecoin |

### 3.2 BlocTime.sol --- Time-Weighted Staking

**Purpose**: Lock NativeToken for a specified block duration; receive BlocTime tokens proportional to lock commitment.

#### 3.2.1 Multiplier Curve

The multiplier function $M: \mathbb{N} \to \mathbb{R}^+$ is defined as a piecewise-linear interpolation over a monotonically increasing set of control points $\{(b_i, m_i)\}_{i=0}^{n-1}$:

$$M(x) = \begin{cases}
m_0 & \text{if } x \leq b_0 \\
m_i + \frac{(m_{i+1} - m_i)(x - b_i)}{b_{i+1} - b_i} & \text{if } b_i < x \leq b_{i+1} \\
m_{n-1} & \text{if } x > b_{n-1}
\end{cases}$$

Where $b_i$ is measured in blocks and $m_i$ in basis points (10000 = 1.0x). The monotonicity constraint $b_i < b_{i+1}$ and $m_i \leq m_{i+1}$ is enforced on-chain.

**Example configuration:**

| Lock Duration (blocks) | Multiplier |
|------------------------|------------|
| 0 | 1.0x (10000 bps) |
| 10,000 | 1.5x (15000 bps) |
| 50,000 | 2.0x (20000 bps) |
| 100,000 | 3.0x (30000 bps) |

#### 3.2.2 Staking Mechanics

```
stake(amount, lockBlocks):
    require(amount > 0)
    require(lockBlocks <= maxLockBlocks)
    transferFrom(msg.sender, this, amount)
    bloctime_minted = amount * M(lockBlocks) / 10000
    mint(msg.sender, bloctime_minted)
    positions[msg.sender][stakeId] = {amount, lockBlocks, startBlock, bloctime_minted}

unstake(stakeId):
    require(block.number >= position.startBlock + position.lockBlocks)
    burn(msg.sender, position.bloctime_minted)
    transfer(msg.sender, position.amount)
```

Multiple concurrent positions per address are supported, each with an independent lock schedule.

### 3.3 Treasury.sol --- Multi-Token Revenue Distribution

**Purpose**: Accumulate marketplace fees and distribute proportionally to governance token holders.

#### 3.3.1 Distribution Formula

For a holder with governance token balance $g_u$, total supply $G$, treasury balance $T_k$ of token $k$, and owner percentage $p$ (in basis points):

$$\text{claimable}_{u,k} = \frac{T_k \cdot (10000 - p) \cdot g_u}{10000 \cdot G}$$

The calculation uses current balances (snapshot-free), avoiding the gas overhead of historical accounting. The governance token is BlocTime, making the distribution proportional to time-weighted stake commitment.

#### 3.3.2 Multi-Token Support

The Treasury accepts any ERC20 token whitelisted through TokenGate. `withdrawAll()` iterates over all whitelisted tokens and transfers the caller's proportional share of each.

### 3.4 Market.sol --- Stablecoin Marketplace

**Purpose**: USD-pegged credit system with oracle-backed conversions and instant withdrawals.

#### 3.4.1 Credit (Deposit)

```
credit(paymentToken, stableAmount, maxPaymentAmount):
    price = oracle.getPrice(paymentToken)
    paymentAmount = stableAmount * price / 10^decimals
    treasuryFee = paymentAmount * creditFeeBps / 10000
    transfer(treasury, treasuryFee)
    transfer(this, paymentAmount - treasuryFee)
    mint(msg.sender, stableAmount * (10000 - creditFeeBps) / 10000)
```

- **Credit fee**: Configurable (default 1%), sent to Treasury
- **Slippage protection**: `maxPaymentAmount` reverts if exceeded

#### 3.4.2 Withdrawal (Instant)

```
withdraw(paymentToken, stableAmount, minReceiveAmount):
    burn(msg.sender, stableAmount)
    paymentAmount = stableAmount * price / 10^decimals
    require(paymentAmount >= minReceiveAmount)
    transfer(msg.sender, paymentAmount)
```

- **Withdrawal fee**: 0.1%
- **No lockup period**: Instant liquidity

### 3.5 Registry.sol --- On-Chain Module Registration

Modules are registered with a unique `(creator, name)` tuple and arbitrary metadata (typically an IPFS CID):

```
registerMod(name, data) → modId
updateMod(modId, data)
removeMod(modId)
transferOwnership(modId, newOwner)
```

`getUserMods(address)` returns all module IDs for a creator, enabling per-developer dashboards.

### 3.6 Perms.sol --- Hierarchical Key-Based Access Control

A generic permission system mapping parent keys to arrays of child keys:

- First caller to `addKey(parent, child)` becomes the owner of that parent key
- Owner can `setKeys()`, `removeKey()`, `transferKeyOwnership()`
- Configurable limits: max child keys (default 100), max key size (default 1024 bytes)
- Swap-and-pop deletion for O(1) removal

---

## 4. Tokenomics & Economic Model

### 4.1 Token Taxonomy

| Token | Type | Supply Model | Decimals | Purpose |
|-------|------|-------------|----------|---------|
| **NativeToken** | ERC20 | Fixed (minted on deploy) | 18 | Stakeable governance asset |
| **BlocTime** | ERC20 | Dynamic (minted/burned on stake/unstake) | 18 | Time-weighted stake receipt |
| **Market Token** | ERC20 | Dynamic (minted/burned on credit/withdraw) | 8 | USD-pegged marketplace credit |
| **USDC/USDT** | ERC20 | External | 6 | Payment tokens for marketplace |

### 4.2 Value Flow

```
                    ┌──────────────────────────────────────┐
                    │         MODULE MARKETPLACE           │
                    │                                      │
  User deposits     │   ┌─────────┐    ┌──────────────┐   │
  USDC/USDT ───────►│   │ Market  │───►│ Market Token │   │
                    │   │ credit()│    │   (minted)   │   │
                    │   └────┬────┘    └──────┬───────┘   │
                    │        │ 1% fee         │           │
                    │        ▼                ▼           │
                    │   ┌─────────┐    ┌──────────────┐   │
                    │   │Treasury │    │  Debit.sol   │   │
                    │   │  .sol   │◄───│  5% fee      │   │
                    │   └────┬────┘    └──────────────┘   │
                    │        │                            │
                    └────────┼────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              ▼              │
              │  ┌───────────────────────┐  │
              │  │  REVENUE DISTRIBUTION │  │
              │  │  share_u = T × g_u/G  │  │
              │  └───────────┬───────────┘  │
              └──────────────┼──────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              ▼              │
              │  ┌───────────────────────┐  │
              │  │   BLOCTIME STAKING    │  │
              │  │  stake(amount, lock)  │  │
              │  │  BT = amt × M(lock)  │  │
              │  └───────────────────────┘  │
              │                             │
              │  NativeToken holders stake  │
              │  for BlocTime, claim from   │
              │  Treasury proportionally    │
              └─────────────────────────────┘
```

### 4.3 Fee Schedule

| Operation | Fee Rate | Destination | Mechanism |
|-----------|----------|-------------|-----------|
| Market Credit | 1% (configurable, bps) | Treasury | Automatic on `credit()` |
| Market Withdrawal | 0.1% | Retained in Market | Implicit in conversion |
| Debit Execution | 5% (constant) | Treasury | Automatic on `executeDebit()` |
| Owner Treasury Claim | Configurable % | Owner address | Manual via `ownerWithdraw()` |

### 4.4 Staking Reward Derivation

Let:
- $S_u$ = user's staked NativeToken amount
- $L_u$ = user's chosen lock duration (blocks)
- $M(L_u)$ = multiplier at lock duration $L_u$ (basis points)
- $B_u$ = user's BlocTime balance = $S_u \cdot M(L_u) / 10000$
- $B_{total}$ = sum of all BlocTime balances
- $T_k$ = Treasury balance of token $k$
- $p$ = owner percentage (basis points)

**User's claimable amount of token $k$:**

$$R_{u,k} = \frac{T_k \cdot (10000 - p)}{10000} \cdot \frac{B_u}{B_{total}}$$

**Annualized yield** (assuming constant Treasury inflow rate $F_k$ per year):

$$\text{APY}_{u,k} = \frac{F_k \cdot (10000 - p)}{10000} \cdot \frac{M(L_u)}{P_{\text{native}} \cdot B_{total}} \times 100\%$$

### 4.5 Anti-Gaming Properties

1. **Monotonic multiplier curve**: Prevents arbitrage between lock durations.
2. **Block-based lock enforcement**: Cannot unstake early; on-chain `block.number` check.
3. **Current-balance distribution**: No historical snapshots to exploit with flash loans (balance must persist through the `withdrawToken` transaction).
4. **No minting outside staking**: BlocTime supply is strictly controlled by stake/unstake.

---

## 5. Module System & Orbit Ecosystem

### 5.1 Module Structure

Every orbit module follows a canonical directory layout:

```
mod/orbit/{module_name}/
  {module_name}/
    mod.py              # Primary anchor (or agent.py, block.py)
    __init__.py
    requirements.txt    # Python dependencies
    config.json         # Module configuration
    README.md           # Documentation
```

**Anchor file resolution order**: `agent.py` > `mod.py` > `block.py` > `{module_name}.py`

### 5.2 Module Categories (200+)

| Category | Count | Examples |
|----------|-------|---------|
| AI & Agents | 10+ | `agent`, `claude`, `claudecode`, `model`, `arena`, `skill`, `ag0` |
| DeFi & Trading | 15+ | `uniswap`, `hyperliquid`, `goldfi`, `prefi`, `raydium`, `copyquant`, `defi` |
| Blockchain | 12+ | `bridge`, `safe`, `eth`, `near`, `solana`, `base`, `cardano`, `zcash` |
| Storage | 6+ | `ipfs`, `filecoin`, `lighthouse`, `cache`, `localfs`, `arweave` |
| Dev Tools | 10+ | `git`, `gitagent`, `pytest`, `conda`, `docker`, `codex`, `claudegit` |
| Infrastructure | 150+ | `web`, `mcp`, `modal`, `compute`, `caddy`, `proton`, `ssh`, `config` |

### 5.3 Module Lifecycle

```
1. DISCOVER   mod.py scans orbit/ for anchor files → O(n) at startup, cached
2. LOAD       m.mod('name') imports and instantiates → lazy, O(1)
3. REGISTER   api.reg('name') uploads to IPFS + writes to Registry.sol
4. INVOKE     m.fn('name/function')(args) executes locally
5. MONETIZE   Remote calls go through Market → Debit → fee to Treasury
```

### 5.4 IPFS-Backed Registry

Module metadata is stored on IPFS (Kubo daemon, auto-managed):

```python
# Registration flow
cid = ipfs.put(module_code_and_metadata)
registry.registerMod(name, cid)  # On-chain pointer to IPFS CID

# Retrieval flow
(owner, name, cid) = registry.getMod(modId)
metadata = ipfs.get(cid)
```

Versioning is achieved by updating the CID pointer on-chain; previous CIDs remain accessible on IPFS indefinitely.

---

## 6. On-Chain Registry & Marketplace

### 6.1 Registration

```solidity
function registerMod(string memory name, string memory data)
    external returns (uint256 modId)
```

- `name`: Human-readable identifier, unique per `(msg.sender, name)` tuple
- `data`: Arbitrary string (IPFS CID, JSON, or URI)
- Returns: Monotonically increasing `modId`

### 6.2 Market Credit/Withdraw Cycle

```
┌─────────┐   credit(USDC, 100)   ┌──────────┐
│  User   │ ─────────────────────► │  Market  │
│ (USDC)  │                        │  .sol    │
│         │ ◄───────────────────── │          │
│         │   mint 99 Market Tokens│          │
└─────────┘   (1% fee to Treasury) └──────────┘

┌─────────┐   withdraw(USDC, 50)   ┌──────────┐
│  User   │ ─────────────────────► │  Market  │
│ (Market)│                        │  .sol    │
│         │ ◄───────────────────── │          │
│         │   burn 50, send USDC   │          │
└─────────┘   (instant, 0.1% fee)  └──────────┘
```

### 6.3 Module Invocation Payment

When a user invokes a paid module:

1. User calls `Debit.executeDebit(client, provider, amount, deadline, signature)`
2. Debit contract verifies EIP-712 signature and authority approvals
3. 5% fee transferred to Treasury
4. 95% transferred to provider
5. Provider's module executes the function

---

## 7. Oracle System & Price Feeds

### 7.1 Architecture

```
┌──────────────┐     ┌────────────────┐     ┌───────────────┐
│  TokenGate   │────►│ IOracleAdapter │◄────│  Market.sol   │
│  (registry)  │     │  (interface)   │     │               │
└──────┬───────┘     └────────┬───────┘     └───────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐  ┌────────────────────┐  ┌─────────────────┐
│ManualPrice   │  │ChainlinkAdapter.sol│  │ PythAdapter.sol │
│Oracle.sol    │  │                    │  │                 │
└──────────────┘  └────────────────────┘  └─────────────────┘
```

### 7.2 Oracle Interface

```solidity
interface IOracleAdapter {
    function getPrice(address token)
        external view returns (uint256 price, uint8 decimals, uint256 timestamp);
    function hasPriceFeed(address token)
        external view returns (bool);
}
```

### 7.3 Price Resolution

TokenGate resolves prices with fallback:

1. Check token-specific oracle --- if registered and has feed, use it
2. Fallback to default oracle --- if set
3. Revert if no oracle available

---

## 8. Debit Protocol & EIP-712 Authorization

### 8.1 EIP-712 Domain

```solidity
EIP712Domain({
    name: "ModDebit",
    version: "1",
    chainId: <chain_id>,
    verifyingContract: <Debit_address>
})
```

### 8.2 Authorization Structure

```solidity
struct DebitAuthorization {
    address client;      // Who is being debited
    address provider;    // Who receives payment
    uint256 amount;      // Stable amount
    uint256 nonce;       // Replay prevention
    uint256 deadline;    // Signature expiry (block.timestamp)
}
```

### 8.3 Multi-Authority Approval System

Clients can configure a multi-signature approval scheme:

1. **Add authorities**: `addAuthority(address)` --- trusted approvers
2. **Set threshold**: `setApprovalThreshold(n)` --- minimum approvals needed
3. **Authority approves**: `approveDebit(client, maxAmount, deadline)` --- spending cap + time limit
4. **Debit executes**: If enough authorities have approved with sufficient remaining allowance

### 8.4 Daily Spending Limits

Each client has a configurable daily limit (default: 1000 USD equivalent). The limit resets every 24 hours (86400 seconds). Debits exceeding the remaining daily allowance are reverted.

---

## 9. AI-Native Architecture

### 9.1 Agent Framework

The `agent` module provides autonomous multi-step AI workflows:

```python
agent = m.mod('agent')()
result = agent.forward(
    query="Build a REST API for user management",
    tools=['cmd', 'git', 'deploy'],
    steps=10
)
```

**Execution loop**:
1. Initialize memory with goal, tools, and context
2. Send context to LLM (Claude, OpenRouter)
3. Parse structured plan (`<PLAN><STEP>JSON</STEP></PLAN>`)
4. Execute tool calls from the plan
5. Append results to context; repeat until `finish` tool is called

### 9.2 Persistent Memory

Agents maintain persistent memory across sessions via the `agent.memory` module:
- Vector embeddings for semantic retrieval
- Key-value facts storage
- Session history with automatic summarization

### 9.3 Claude Integration

The `claude` module provides programmatic access to Claude for code operations:

```python
claude = m.mod('claude')()
claude.ask("Explain this codebase")
claude.analyze_code("/path/to/file.py")
claude.generate_code("FastAPI endpoint with auth")
```

Background job execution via Rust server enables long-running AI tasks without blocking.

### 9.4 AI-Driven Module Composition

Agents can discover, load, and compose modules autonomously:

```python
# Agent discovers available modules
mods = m.mods()

# Agent selects and chains modules
data = m.fn('web/scrape')(url='...')
analysis = m.fn('agent/analyze')(data=data)
cid = m.fn('ipfs/put')(data=analysis)
m.fn('registry/register')(name='analysis', data=cid)
```

This enables autonomous agents to build, deploy, and monetize new modules without human intervention.

---

## 10. Security Model

### 10.1 Smart Contract Security

| Measure | Implementation |
|---------|---------------|
| Reentrancy protection | `ReentrancyGuard` on all state-changing functions |
| Safe token transfers | OpenZeppelin `SafeERC20` throughout |
| Overflow protection | Solidity 0.8.20 built-in checked arithmetic |
| Access control | `Ownable` + per-function modifiers |
| Emergency stops | `Pausable` on Market contract |
| Input validation | `require` guards on all external functions |
| Monotonic enforcement | Multiplier curve points must be strictly increasing |

### 10.2 Cryptographic Security

- **Key management**: ECDSA (secp256k1), Sr25519, and Ed25519 key generation
- **Storage encryption**: AES-256-GCM for sensitive data at rest
- **Signature verification**: EIP-712 structured data signing for debit authorizations
- **Safe multisig**: Gnosis Safe integration with `v + 4` adjustment for `eth_sign` mode
- **Client-side key generation**: Private keys never leave the user's device

### 10.3 Anti-Flash-Loan Design

The Treasury distribution model uses current token balances (not historical snapshots), which means a flash-loan attacker would need to:
1. Acquire governance tokens (BlocTime --- only obtainable by staking with a lock period)
2. Hold them through the `withdrawToken()` call (same transaction)

Since BlocTime can only be minted by staking NativeToken with a lock period, flash-loan attacks on the distribution are structurally infeasible.

### 10.4 Infrastructure Security

- **HTTPS enforced** in production (TLS 1.3)
- **Rate limiting** on all API endpoints (Redis-backed)
- **Token gating** for premium features (ERC-20/ERC-721)
- **Input sanitization** on all user-facing endpoints
- **Environment secrets** isolated from version control

---

## 11. Governance & Decentralization Path

### 11.1 Ownership Model

All core contracts inherit `Ownable` with an additional `setOwnerless()` function:

```solidity
bool public ownerless;

function setOwnerless() external onlyOwner {
    ownerless = true;
    renounceOwnership();
}

modifier notOwnerless() {
    require(!ownerless, "Contract is ownerless");
    _;
}
```

This is a **one-way function**: once called, no administrative changes can ever be made to the contract.

### 11.2 Progressive Decentralization Roadmap

```
Phase 1: MANAGED
  └─ Owner = deployer EOA
  └─ Full administrative control
  └─ Rapid iteration and parameter tuning

Phase 2: MULTISIG
  └─ Transfer ownership to Gnosis Safe
  └─ N-of-M signature requirement
  └─ Timelock on parameter changes

Phase 3: DAO
  └─ Governance token voting (BlocTime-weighted)
  └─ On-chain proposals and execution
  └─ Community-driven parameter changes

Phase 4: OWNERLESS
  └─ Call setOwnerless() on all contracts
  └─ Permanent, irreversible decentralization
  └─ Protocol operates autonomously
```

### 11.3 Functions Locked by `setOwnerless()`

| Contract | Locked Functions |
|----------|-----------------|
| BlocTime | `setPoints()`, `setParams()`, `emergencyWithdraw()` |
| Treasury | `setOwnerPercentage()`, `setGovernanceToken()`, `setTokenGate()` |
| Market | `setTreasury()`, `setTokenGate()`, `setDebitContract()`, `pause()`, `unpause()` |
| Debit | `setMarket()`, `setSignatureRequired()` |
| TokenGate | Oracle management, token whitelisting |
| Perms | `setMaxChildKeys()`, `setMaxKeySize()` |

---

## 12. Network Deployment

### 12.1 Supported Networks

| Network | Chain ID | Status | RPC |
|---------|----------|--------|-----|
| Base Sepolia (testnet) | 84532 | Live | `https://sepolia.base.org` |
| Base Mainnet | 8453 | Production-ready | `https://mainnet.base.org` |
| Hardhat (local) | 31337 | Development | `localhost:8545` |

### 12.2 Compiler & Framework

- **Solidity**: 0.8.20
- **Framework**: Hardhat
- **Libraries**: OpenZeppelin Contracts v5.x
- **Testing**: Hardhat + Chai

### 12.3 Multi-Chain Module Support

Beyond EVM contracts, the orbit module ecosystem supports:

- **Substrate**: `bridge` module (Sr25519 signatures, cross-chain token minting)
- **Solana**: `solana`, `raydium` modules (SPL token operations)
- **NEAR**: `near` module (NEAR Protocol integration)
- **Cardano**: `cardano` module
- **Zcash**: `zcash` module (privacy-preserving transactions)
- **Arweave**: `arweave` module (permanent storage)

---

## 13. Conclusion

MOD Protocol presents a production-ready framework for decentralized module development, AI-native computation, and on-chain revenue sharing. The key contributions:

1. **BlocTime staking**: A time-weighted multiplier mechanism that aligns long-term commitment with proportional revenue share via piecewise-linear interpolation over configurable control points.

2. **Non-inflationary economics**: All staker rewards derive from real marketplace activity, eliminating the inflation-dilution problem common in DeFi protocols.

3. **200+ composable modules**: The orbit ecosystem spans AI agents, DeFi protocols, cross-chain bridges, decentralized storage, and developer tooling---all discoverable and callable with zero configuration.

4. **AI-native execution**: Built-in agent framework with persistent memory, tool composition, and autonomous module creation enables a new paradigm of self-building software systems.

5. **Irreversible decentralization**: The `setOwnerless()` pattern provides a cryptographically guaranteed path to full protocol autonomy.

6. **EIP-712 debit authorization**: Structured signature-based payment with multi-authority approval, daily spending limits, and replay protection.

The protocol is deployed on Base Sepolia with all 10 core contracts operational and is architecturally ready for mainnet deployment.

---

## Appendix A: Contract Interface Summary

```solidity
// BlocTime
stake(uint256 amount, uint256 lockBlocks)
unstake(uint256 stakeId)
getMultiplier(uint256 blockCount) → uint256
getStakePosition(address, uint256) → StakePosition

// Treasury
fundTreasury(address token, uint256 amount)
withdrawToken(address token)
withdrawAll()
getClaimableAmount(address holder, address token) → uint256

// Market
credit(address paymentToken, uint256 stableAmount, uint256 maxPaymentAmount)
withdraw(address paymentToken, uint256 stableAmount, uint256 minReceiveAmount)

// Registry
registerMod(string name, string data) → uint256
updateMod(uint256 modId, string data)
removeMod(uint256 modId)
getUserMods(address) → uint256[]

// Debit
executeDebit(address client, address provider, uint256 amount, uint256 deadline, bytes sig)
addAuthority(address)
approveDebit(address client, uint256 maxAmount, uint256 deadline)
setApprovalThreshold(uint256)
setDailyLimit(uint256)
```

## Appendix B: Configuration Schema

```json
{
  "name": "mod",
  "version": "2.0.0",
  "port_range": [50050, 50150],
  "shortcuts": { "m": "mod", "c": "mod" },
  "expose": ["forward", "info"],
  "cost": {
    "forward": 1.0,
    "info": 0.5
  }
}
```

---

*MOD Protocol is open-source software. All smart contracts are verified and auditable on-chain.*

*Version 2.0 --- April 2026*
