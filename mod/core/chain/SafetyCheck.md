# Safety Check: Pre-Mainnet Security Audit

**Contracts Analyzed:** Market, Treasury, BlocTime, TokenGate, Oracles (Manual/Chainlink/Pyth), Bridge
**Solidity Version:** ^0.8.0
**OpenZeppelin:** v4.9.3 (ERC20, Ownable, ReentrancyGuard, SafeERC20)
**Target Chain:** Base (chainId 8453)

---

## CRITICAL SEVERITY

### 1. Owner Key = God Mode (Single Point of Failure)

Every contract uses single-address `Ownable`. If the owner private key is compromised, an attacker can:

| Contract | What they can do |
|----------|-----------------|
| **Market** | Call `debit()` to burn any user's balance and mint to themselves |
| **Treasury** | Call `emergencyWithdraw()` to drain all treasury tokens instantly |
| **Treasury** | Set `ownerPercentage` to 10000 (100%) and claim everything |
| **BlocTime** | Call `emergencyWithdraw()` to drain all staked native tokens |
| **BlocTime** | Change multiplier `points` or `params` to break staking |
| **TokenGate** | Swap oracle to a malicious one that returns fake prices |
| **ManualOracle** | Set any token price to any value |
| **Bridge** | Mint unlimited tokens, burn from any address |

**Impact:** Total loss of all funds across the entire protocol.
**Recommendation:** Use a multisig (Safe) as owner. Add a Timelock contract (OpenZeppelin TimelockController) for all admin functions. Consider a 48h delay minimum.

---

### 2. Market: Oracle Price Manipulation → Fund Drain

**File:** `Market.sol:62-80` (credit) and `Market.sol:114-133` (withdraw)

The credit/withdraw flow trusts the oracle price with zero protection:

```
1. Attacker credits when oracle price is HIGH (pays fewer stablecoins, gets X market tokens)
2. Oracle price drops (or is manipulated down)
3. Attacker withdraws same X market tokens → receives MORE stablecoins than deposited
```

**No staleness check.** The `getTokenPrice()` returns a timestamp but it's never validated. A stale Chainlink price or a manipulated ManualOracle price is accepted without question.

**No slippage protection.** Users specify `stableAmount` but have no way to set a minimum/maximum on the actual `paymentAmount`. Front-runners or oracle updates between tx submission and execution can cause unexpected losses.

**No price deviation circuit breaker.** If an oracle returns a price 100x different from the last known price, the contract accepts it.

**Impact:** Draining the contract's token reserves.
**Recommendation:** Add staleness thresholds, slippage parameters, price deviation bounds, and a pause mechanism.

---

### 3. Treasury: Flash Loan Governance Attack

**File:** `Treasury.sol:117-141` (getClaimableAmount)

The Treasury calculates claimable amounts based on `governanceToken.balanceOf(holder)` at the moment of the call. There is no snapshotting.

**Attack:**
1. Attacker flash-loans or borrows a large amount of governance tokens (BlocTime)
2. Calls `withdrawAll()` — their share is calculated against inflated balance
3. Claims disproportionate share of all treasury tokens
4. Returns the flash-loaned governance tokens

**Note:** BlocTime tokens are freely transferable ERC20 tokens (`transfer`/`transferFrom` are not overridden). They can be traded, pooled, or flash-loaned.

**Impact:** Draining the entire treasury.
**Recommendation:** Use ERC20Votes with checkpoints/snapshots. Require governance tokens to be held for a minimum number of blocks before claiming. Or use a merkle-proof distribution system.

---

### 4. Treasury: `emergencyWithdraw` Has No Limits

**File:** `Treasury.sol:261-263`

```solidity
function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
    IERC20(token).safeTransfer(owner(), amount);
}
```

No timelock. No multi-sig requirement. No event beyond the ERC20 Transfer event. No cooldown. The owner can instantly drain every token in the treasury with zero notice to governance token holders.

**Impact:** Total treasury drain.
**Recommendation:** At minimum, add a timelock delay. Consider removing this function entirely after launch, or gating it behind a governance vote or multi-sig threshold.

---

### 5. BlocTime: Emergency Withdraw Drains Staker Funds

**File:** `BlocTime.sol:287-289`

Same issue as Treasury — the owner can call `emergencyWithdraw` to steal all staked native tokens. Users who locked tokens for thousands of blocks have no protection.

**Impact:** Total loss of all staked funds.
**Recommendation:** Same as Treasury — timelock, multi-sig, or remove.

---

## HIGH SEVERITY

### 6. Market: `debit()` Burns From Users Without Approval

**File:** `Market.sol:87-112`

```solidity
function debit(address client, address provider, uint256 stableAmount) external onlyOwner
```

The owner can burn tokens from ANY client address and mint to ANY provider address. There is no `approve()` flow, no user signature, no consent mechanism. This is by design (the owner acts as the marketplace operator), but it means:

- Users must **fully trust** the owner not to misbehave
- A compromised owner key means every user balance is at risk
- There is no on-chain audit trail of WHY a debit occurred (no metadata/reason field)

**Impact:** Unauthorized fund transfers from any user.
**Recommendation:** Consider requiring user approval (EIP-712 signatures for off-chain consent), or at minimum, add a dispute/freeze window.

---

### 7. BlocTime: Transferable Staking Tokens Create Accounting Issues

**File:** `BlocTime.sol` — inherits `ERC20` without overriding `transfer`/`transferFrom`

BlocTime tokens are minted on `stake()` and burned on `unstake()`. But they're freely transferable. This creates scenarios:

1. User A stakes 100 tokens, receives 150 BlocTime (1.5x multiplier)
2. User A transfers 150 BlocTime to User B
3. User A calls `unstake()` → **reverts** because `_burn` fails (insufficient balance)
4. User A's native tokens are permanently locked in the contract

Alternatively:
1. User A stakes and gets BlocTime
2. User A sells BlocTime on a DEX for immediate profit
3. User A's native tokens are stuck (can't unstake without BlocTime)
4. BlocTime buyer has tokens with no staking position to unstake

**Impact:** Permanent fund lockup or broken staking invariants.
**Recommendation:** Override `_beforeTokenTransfer` to prevent BlocTime transfers (make it soulbound), OR decouple the token from the staking/unstaking mechanism.

---

### 8. Chainlink Adapter: No Staleness Check

**File:** `ChainlinkAdapter.sol:73-98`

```solidity
require(answer > 0, "Invalid price");
require(updatedAt > 0, "Price not updated");
```

This only checks that the price is positive and was updated at some point. It does NOT check:
- How old the price is (could be hours or days stale)
- Whether `answeredInRound >= roundId` (sequencer check)
- L2 sequencer uptime (critical on Base/L2s)

On Base (an L2), if the sequencer goes down, Chainlink prices freeze. When it comes back up, stale prices are served briefly. Attackers exploit this window.

**Impact:** Trading at stale/incorrect prices, draining the Market contract.
**Recommendation:** Add heartbeat staleness check (`block.timestamp - updatedAt < MAX_STALENESS`). Add L2 sequencer uptime feed check for Base.

---

### 9. Pyth Adapter: Uses `getPriceUnsafe`

**File:** `PythAdapter.sol:89`

```solidity
IPyth.Price memory pythPrice = pyth.getPriceUnsafe(priceId);
```

`getPriceUnsafe` explicitly skips staleness validation. Pyth provides `getPrice()` with built-in staleness checks, but it's not used. The staleness parameter is never validated.

**Impact:** Same as Chainlink — stale price exploitation.
**Recommendation:** Use `getPrice()` or `getPriceNoOlderThan(priceId, maxAge)` instead.

---

### 10. ManualPriceOracle: Fully Centralized Price Control

**File:** `ManualPriceOracle.sol`

The owner can set any price for any token at any time. For mainnet with real money:

- Owner (or compromised key) sets USDC price to $0.01 → attackers `credit()` cheaply, then price is restored, they `withdraw()` at $1.00 = 100x profit
- No on-chain mechanism ensures prices match reality
- No multi-oracle aggregation or fallback

**Impact:** Arbitrary price manipulation = complete fund drain.
**Recommendation:** Do NOT use ManualPriceOracle on mainnet for any token with real liquidity. Use Chainlink/Pyth with proper staleness checks. If manual oracle is needed for exotic tokens, add price deviation limits and a timelock on price changes.

---

## MEDIUM SEVERITY

### 11. Treasury: Governance Token Immutable After Set

**File:** `Treasury.sol:56-61`

```solidity
function setGovernanceToken(address _governanceToken) external onlyOwner {
    require(address(governanceToken) == address(0), "Already set");
```

Once set, the governance token can never be changed. If the governance token has a bug, is exploited, or needs migration, the treasury is permanently locked to the broken token.

**Impact:** Permanent loss of treasury governance capability.
**Recommendation:** Allow governance token migration with a timelock and proper snapshot of claims.

---

### 12. Treasury: `ownerPercentage` Can Be Changed Retroactively

**File:** `Treasury.sol:46-49`

The owner can change their percentage at any time. This retroactively affects all unclaimed balances:

1. Treasury accumulates $1M with owner at 20%
2. Owner changes percentage to 90%
3. Owner claims 90% of everything, holders only get 10%

There's no timelock, no notice period, no governance vote.

**Impact:** Rug pull of treasury funds.
**Recommendation:** Add timelock. Consider making it immutable after deployment, or require governance vote.

---

### 13. Market: Rounding Errors in Price Conversion

**File:** `Market.sol:72` and `Market.sol:125`

```solidity
uint256 paymentAmount = (stableAmount * 10**uint256(paymentDecimals) * 10**uint256(priceDecimals))
    / (tokenPrice * 10**uint256(decimals()));
```

Integer division truncates. For small amounts or tokens with few decimals, this can round to 0 or create favorable rounding for the user. Repeated small transactions can extract value through rounding.

**Specific risk:** If `stableAmount` is very small and `tokenPrice * 10^8` is large, the payment amount rounds to 0. User gets free market tokens.

**Impact:** Slow value extraction through dust amounts.
**Recommendation:** Add minimum amount checks. Ensure `paymentAmount > 0` after calculation. Consider rounding up for `credit()` and rounding down for `withdraw()`.

---

### 14. No Pause Mechanism Anywhere

None of the contracts implement `Pausable`. If an exploit is discovered mid-attack:

- You cannot stop `credit()`/`withdraw()` on Market
- You cannot stop `withdrawAll()` on Treasury
- You cannot stop `unstake()` on BlocTime

The only emergency option is `emergencyWithdraw` (which itself is a rug vector).

**Impact:** Inability to stop an active exploit.
**Recommendation:** Add OpenZeppelin `Pausable` to Market, Treasury, and BlocTime. Gate all state-changing functions behind `whenNotPaused`.

---

### 15. BlocTime: Unbounded Array Iteration in `unstake()`

**File:** `BlocTime.sol:215-222`

```solidity
uint256[] storage stakeIds = userStakeIds[msg.sender];
for (uint256 i = 0; i < stakeIds.length; i++) {
    if (stakeIds[i] == stakeId) {
```

If a user has hundreds of stake positions, unstaking iterates through all of them to find the matching ID. Gas cost grows linearly. Eventually, unstaking could exceed the block gas limit, permanently locking funds.

**Impact:** Permanent fund lockup for power users.
**Recommendation:** Use a mapping from stakeId to array index (similar to TokenGate's swap-and-pop pattern) for O(1) removal.

---

### 16. Treasury: `withdrawAll()` Unbounded Iteration

**File:** `Treasury.sol:181-201`

```solidity
address[] memory tokens = tokenGate.getTokenList();
for (uint256 i = 0; i < tokens.length; i++) {
```

If many tokens are whitelisted, this call can exceed block gas limits. Additionally, the `nonReentrant` guard is on `withdrawAll()`, but internally it calls `getClaimableAmount()` which makes external calls to `tokenGate` and `governanceToken` for each token.

**Impact:** Function becomes uncallable if too many tokens whitelisted.
**Recommendation:** Add pagination or let users specify which tokens to claim.

---

### 17. Bridge: Unlimited Minting With No Replay Protection

**File:** `Bridge.sol:40-46`

```solidity
function bridgeMint(address to, uint256 amount, string memory bridgeId) external onlyOwner {
```

`bridgeId` is a string with no uniqueness enforcement. The same `bridgeId` can be used multiple times → double-minting. There is no mapping of processed bridge IDs.

**Impact:** Token inflation via double-minting.
**Recommendation:** Track processed `bridgeId`s in a mapping. Reject duplicates.

---

### 18. ChainlinkAdapter / PythAdapter: Custom Ownable (Not OpenZeppelin)

**Files:** `ChainlinkAdapter.sol:29-36`, `PythAdapter.sol:33-39`

These contracts implement their own `onlyOwner` pattern instead of using OpenZeppelin's `Ownable`. There's no two-step ownership transfer, no renounce capability, and no event for ownership changes.

**Risk:** Accidental ownership transfer to wrong address is irreversible.
**Recommendation:** Use OpenZeppelin `Ownable2Step` for safe ownership transfers.

---

## LOW SEVERITY

### 19. Market: No Event for `setTokenGate` / `setTreasury` Side Effects

When the owner swaps the TokenGate or Treasury address, all existing operations instantly point to new contracts. Users in the middle of transactions could be affected. Events exist but no delay.

### 20. BlocTime: `stakes` Mapping (Legacy) Inconsistency

**File:** `BlocTime.sol:49`

The `stakes` mapping aggregates across all positions but `startBlock` and `lockBlocks` only reflect the first stake's values. This `getStakeInfo` legacy function returns misleading data for multi-position stakers.

### 21. Token Delisting Can Strand Funds

If a token is delisted from TokenGate while:
- Users have Market credits backed by that token → they can't `withdraw()` to that token
- Treasury holds that token → it can't be claimed via `withdrawToken()`

### 22. No Contract Size / Proxy Upgradability

All contracts are directly deployed (no proxy pattern). Bug fixes require redeployment, migration of all state, and repointing all integrations. With real funds at stake, this is operationally risky.

### 23. `BlocTime.stake()` With `lockBlocks = 0`

Users can stake with `lockBlocks = 0`, which means they can immediately unstake in the same block. The multiplier would be 1x (10000 basis points), so they get `amount` BlocTime and can immediately unstake. This is functionally useless but wastes gas and bloats state.

---

## CROSS-CONTRACT ATTACK SCENARIOS

### Scenario A: Oracle Sandwich Attack
1. Attacker monitors mempool for owner's `ManualPriceOracle.setPrice()` tx
2. Front-runs with `Market.credit()` at old (favorable) price
3. Price update executes
4. Back-runs with `Market.withdraw()` at new (unfavorable-to-contract) price
5. Profit = price difference minus gas

### Scenario B: BlocTime → Treasury Drain
1. Attacker accumulates large BlocTime position via staking
2. Calls `Treasury.withdrawAll()` to claim proportional share of all treasury tokens
3. Immediately `unstake()` to reclaim staked native tokens
4. Net result: claimed treasury tokens for free (BlocTime was just a temporary holding)

### Scenario C: Token Delist Grief
1. Owner delists a token from TokenGate
2. All Market users holding credits backed by that token can no longer withdraw to it
3. Treasury holders can no longer claim that token
4. Funds effectively stranded until re-listing

### Scenario D: Coordinated Owner Attack (Rug Pull)
1. Owner sets ManualOracle price for USDC to $0.001
2. Accomplice calls `Market.credit()` with tiny USDC amount, gets massive market tokens
3. Owner restores USDC price to $1.00
4. Accomplice calls `Market.withdraw()` → drains all USDC from contract
5. Owner calls `Treasury.emergencyWithdraw()` to drain treasury
6. Owner calls `BlocTime.emergencyWithdraw()` to drain staked tokens

---

## PRE-MAINNET CHECKLIST

### Must Fix (Blocking)
- [ ] Deploy all contracts behind a multisig (Safe) — NOT an EOA
- [ ] Add Timelock (48h minimum) on all owner functions
- [ ] Add `Pausable` to Market, Treasury, BlocTime
- [ ] Replace ManualPriceOracle with Chainlink/Pyth for all mainnet tokens
- [ ] Add staleness checks to ChainlinkAdapter (heartbeat + L2 sequencer check)
- [ ] Switch PythAdapter from `getPriceUnsafe` to `getPriceNoOlderThan`
- [ ] Add slippage protection to `Market.credit()` and `Market.withdraw()`
- [ ] Make BlocTime non-transferable OR decouple from unstaking
- [ ] Add flash-loan protection to Treasury claims (snapshot/checkpoint system)
- [ ] Add minimum amount checks to prevent rounding exploits in Market
- [ ] Add bridge ID replay protection to Bridge contract

### Should Fix (High Priority)
- [ ] Add timelock to `ownerPercentage` changes in Treasury
- [ ] Use O(1) stake removal in BlocTime (index mapping)
- [ ] Add pagination to `Treasury.withdrawAll()`
- [ ] Use OpenZeppelin `Ownable2Step` in ChainlinkAdapter and PythAdapter
- [ ] Add price deviation circuit breaker to oracle adapters
- [ ] Ensure `paymentAmount > 0` after price conversion in Market
- [ ] Add re-listing protection for token delist scenarios

### Should Consider
- [ ] Upgradeable proxy pattern (UUPS or Transparent) for bug fixes
- [ ] Formal verification of price conversion math
- [ ] Professional audit by a reputable firm (Trail of Bits, OpenZeppelin, Spearbit)
- [ ] Bug bounty program (Immunefi)
- [ ] On-chain monitoring/alerting (Forta, OpenZeppelin Defender)
- [ ] Rate limiting on large withdrawals
- [ ] Governance vote requirement for emergency withdrawals

---

## SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 5 | Must fix before mainnet |
| High | 8 | Should fix before mainnet |
| Medium | 8 | Fix or accept with mitigation |
| Low | 5 | Nice to have |

**The single biggest risk is owner key compromise.** Every contract funnels total control through one address. Moving to a multisig + timelock pattern eliminates the majority of critical and high severity issues simultaneously.

**The second biggest risk is oracle manipulation**, whether through the ManualPriceOracle, stale Chainlink/Pyth feeds, or front-running price updates. Proper oracle hygiene (staleness checks, deviation bounds, L2 sequencer awareness) is essential for mainnet.

**Get a professional audit before deploying real funds.**
