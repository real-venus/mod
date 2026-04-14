# StakeTime Protocol

**Programmable Inflationary Token Distribution via Time-Weighted Validator Staking**

## Abstract

StakeTime is a protocol for fair distribution of inflationary tokens through time-weighted staking on validators. Anyone can deploy a StakeTime instance with their own token, configure custom emission curves, and let users stake on validators to earn proportional rewards. The inflation mechanism is a function **I(StakeTime)** — separating the incentive layer from the staking primitive. The default incentive function is **Yuma Consensus**: exponentially-decayed blocktime scoring that rewards active, consistent validators.

## 1. Problem

Inflationary token distribution is a fundamental problem in decentralized systems:

- **Proof of Stake** concentrates rewards to large capital holders
- **Airdrops** are gamed by sybil attacks and provide no ongoing incentive alignment
- **Mining** requires specialized hardware and wastes energy
- **Governance voting** is plutocratic — more tokens = more power
- **Fixed vesting** distributes regardless of contribution

What's missing is a **programmable, fair distribution mechanism** where:
1. Anyone can create their own inflationary token
2. Rewards flow to **active participants** (validators) and their **supporters** (stakers)
3. The emission curve is **configurable** — deployers choose their own incentive shape
4. The mechanism **decays stale participation** so latecomers aren't permanently disadvantaged

## 2. Solution: StakeTime

StakeTime separates three concerns:

```
┌─────────────────────────────────────────────┐
│  Token Layer     — NativeToken (any ERC20)  │
├─────────────────────────────────────────────┤
│  Staking Layer   — StakeTime (STT)          │
│   └─ Users stake NativeToken ON validators  │
│   └─ STT minted = amount × M(lockBlocks)   │
│   └─ Custom multiplier curves per deploy    │
├─────────────────────────────────────────────┤
│  Incentive Layer — I(StakeTime)             │
│   └─ Default: Yuma Consensus               │
│   └─ Blocktime scoring with exp. decay     │
│   └─ Emissions ∝ validator blocktime score  │
│   └─ Split: commission → validator,         │
│            remainder → stakers (∝ STT)      │
└─────────────────────────────────────────────┘
```

### 2.1 Anyone Can Deploy

StakeTime is a **factory pattern**. Anyone deploys their own instance with:
- Their own NativeToken (the token being distributed)
- Their own emission rate, decay rate, epoch length
- Their own multiplier curve (Points[])
- Their own max stakers per validator, commission caps

This means:
- A DAO deploys StakeTime to distribute governance tokens to active community validators
- A game deploys StakeTime to reward players who run game servers
- A protocol deploys StakeTime to incentivize node operators and their delegators
- An artist deploys StakeTime to distribute tokens to fans who support curators

### 2.2 Custom Curves

The multiplier curve `M(lockBlocks)` determines how much StakeTime a staker earns based on their lockup duration. Deployers define this as a set of **Points**:

```
Point[] = [
  { blocks: 0,      multiplier: 10000 },   // 1.0x at 0 lock
  { blocks: 43200,  multiplier: 15000 },   // 1.5x at 1 day
  { blocks: 302400, multiplier: 30000 },   // 3.0x at 1 week
]
```

Between points, **linear interpolation** provides a smooth curve. This means:
- Short-term stakers get base rewards (1x)
- Medium-term stakers get moderate boost (1.5x)
- Long-term stakers get maximum boost (3x)

Deployers can create **any curve shape**: flat (everyone equal), steep (heavily reward lockups), stepped (discrete tiers), or aggressive (10x for maximum lock).

**StakeTime minted:**
```
STT = amount × M(lockBlocks) / 10000
```

### 2.3 Deleting / Unwinding

Users can **unstake** any position after its lock period expires. On unstake:
1. StakeTime (STT) tokens are **burned**
2. NativeToken is **returned** to the staker
3. The position is fully deleted from on-chain state

Contract owners can **deactivate validators**, adjust parameters, or use `emergencyWithdraw` for recovery. The `setOwnerless()` pattern (from BlocTime) can be adopted to permanently decentralize a deployment.

## 3. Incentive Function: I(StakeTime)

The incentive layer is **pluggable**. The default is Yuma Consensus.

### 3.1 Yuma Consensus (Default)

Validators **check in** regularly (heartbeat). Each checkin increases their **blocktime score**:

```
score = decay(score) + delta
decay(score) = score × (10000 - decayBps) / 10000
```

Where `delta` = blocks since last checkin (capped at epochLength).

**Properties:**
- **Active validators** accumulate score by checking in frequently
- **Stale validators** decay exponentially — if you stop checking in, your score drops to zero
- **No capital requirement** for validators — anyone can register and participate
- **Epoch-based distribution** — emissions happen every `epochLength` blocks

### 3.2 Emission Distribution

Each epoch, the total `emissionRate` of NativeToken is distributed:

```
For each active validator V:
  validatorShare = emissionRate × V.blocktimeScore / totalBlocktime

  if V has stakers:
    commission = validatorShare × V.commissionBps / 10000
    stakerPool = validatorShare - commission

    For each staker S on V:
      S.reward += stakerPool × S.stakeTimeBalance / V.totalStakeTime

    V.balance += commission
  else:
    V.balance += validatorShare (100%)
```

This creates a **two-sided market**:
- Validators compete for stakers by being active (high blocktime score) and offering competitive commission rates
- Stakers choose validators based on performance (score), commission rate, and reliability
- Both parties are incentivized to participate consistently

### 3.3 Alternative Incentive Functions

Because I(StakeTime) is separated from the staking layer, future implementations can swap in alternative incentive functions:

- **Proof of Work**: validators submit hash proofs instead of checkins
- **Proof of Storage**: validators prove they store data
- **Proof of Inference**: validators prove they ran ML models
- **Governance Weighted**: validators weighted by governance votes
- **Flat**: equal distribution to all active validators (no scoring)

The staking layer (stake on validators, earn STT, claim rewards) remains unchanged.

## 4. Tokenomics

### 4.1 Two-Token Model

| Token | Type | Purpose |
|-------|------|---------|
| **NativeToken** | Any ERC20 | Staked by users, distributed as rewards |
| **StakeTime (STT)** | Minted/burned | Proof of stake-duration, determines reward share |

STT is **not transferable for reward calculation** — rewards are tied to StakePosition records, not STT balance. STT can be freely transferred as a reputation/governance signal, but only active stake positions earn emissions.

### 4.2 Inflation Model

The deployer funds the contract with NativeToken. Each epoch, `emissionRate` tokens flow from the contract balance to validators and stakers. The deployer controls:

- **emissionRate**: how many tokens per epoch
- **decayBps**: how fast stale validators lose weight
- **epochLength**: how often distribution happens
- **Points[]**: the lockup multiplier curve

This gives deployers full control over their token's inflation schedule and incentive structure.

### 4.3 Commission

Validators set their own commission rate (capped at 50%). This creates competitive dynamics:
- New validators may offer 0% commission to attract stakers
- Established high-score validators can charge higher commission
- Stakers balance commission rate vs. validator reliability

## 5. Mechanism Properties

### 5.1 Fairness

- **No minimum stake** — anyone can stake any amount
- **No minimum capital for validators** — register with any key type
- **Time-weighted rewards** — longer lockup = more STT = more reward share
- **Decay prevents entrenchment** — inactive validators lose weight automatically

### 5.2 Security

- **ReentrancyGuard** on all state-changing staking functions
- **SafeERC20** for all token transfers
- **Monotonicity validation** on multiplier curves (blocks must increase, multipliers must not decrease)
- **Max stakers per validator per epoch** prevents sybil flooding of a single validator
- **Lock period enforcement** — cannot unstake before lock expires
- **Commission cap** (50%) prevents predatory validator behavior

### 5.3 Sybil Resistance

- **Blocktime scoring** requires continuous activity — splitting into sybil validators splits the score, not multiplies it
- **Max stakers per epoch** limits the rate of new stakers per validator
- **Lock periods** impose real cost on short-term gaming

## 6. Architecture

### 6.1 On-Chain (Solidity)

Single contract: `StakeTime.sol` inheriting `ERC20`, `ReentrancyGuard`, `Ownable`.

- ~550 lines of Solidity
- Deployed on Base Sepolia (L2, low gas)
- OpenZeppelin 4.9.x dependencies

### 6.2 Off-Chain (Python + API + App)

- **mod.py** — CLI interface for all contract interactions
- **FastAPI** — REST API for querying state and submitting transactions
- **Next.js** — Web dashboard for staking, validator management, leaderboards

### 6.3 Multi-Key Support

Validators can use any key type:
- **ECDSA** (Ethereum) — self-register, self-checkin
- **ed25519** (Solana, Polkadot) — owner-relayed registration and checkins
- **sr25519** (Substrate) — owner-relayed registration and checkins

Keys are stored as plain strings. The contract hashes them with keccak256 for indexing. This means any future key format can be added without contract migration.

## 7. Deployment

```javascript
constructor(
    address _nativeToken,               // ERC20 to stake and distribute
    uint256 _emissionRate,              // tokens per epoch (e.g. 100e18)
    uint256 _decayBps,                  // score decay (500 = 5%)
    uint64  _epochLength,               // blocks per epoch (43200 ≈ 1 day on Base)
    uint256 _maxLockBlocks,             // max lock duration (100000 ≈ 2.3 days)
    uint256 _maxStakersPerValidator,    // cap per validator per epoch
    uint256 _defaultCommissionBps       // default validator commission (1000 = 10%)
)
```

After deployment, the deployer:
1. Funds the contract with NativeToken for emissions
2. Sets their custom multiplier curve via `setPoints(Point[])`
3. Registers initial validators
4. Users begin staking and earning

## 8. Summary

StakeTime is a primitive for **programmable inflationary token distribution**. It separates:

- **What gets distributed** (any ERC20)
- **How it's earned** (staking on validators with time-weighted lockups)
- **Who gets it** (proportional to blocktime score × commission split)
- **The incentive shape** (custom curves, pluggable I(StakeTime))

The default incentive function — Yuma Consensus — rewards consistent, active validators and their stakers. But the protocol is designed so any community can deploy their own instance, choose their own curves, and build their own economy on top of StakeTime.

---

*StakeTime Protocol — Base Sepolia*
*Contract: StakeTime.sol | Token: STT (StakeTime)*
