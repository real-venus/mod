# Security Scan Report — Client-Side Risk Focus

**Repo:** `/Users/broski/mod/mod/orbit/bridge`
**Reviewer:** `0x6478255B80b561B4d8D96c02Ce86ffCeBbB9D09E`
**Model:** `sonnet`
**Scan date:** 2026-04-23 14:42:26
**Remediation:** 2026-04-23

## Can users lose funds?

**Previously yes, now no** for the API layer. Two critical token-theft vectors existed and have been patched. Remaining issues are contract-level centralization risks and operational hardening — not direct client-side theft.

## Client-Side Findings

### 1. [CRITICAL] Token theft via unauthenticated claim — FIXED

**Location:** `api/api.py` ClaimRequest + `mod.py:212`

Anyone could call `POST /claim {address: "victim", recipient: "attacker_evm"}` and drain tokens from any committed address. No proof of ownership required.

> **Fix applied:** claim() now requires `signature` (signed `claim {timestamp}` from source wallet) + `timestamp` (within 5 min). API ClaimRequest model updated to require both fields. Claim signatures have replay protection via used-signature store.

---

### 2. [CRITICAL] Commitment replay — FIXED

**Location:** `mod.py:429`

A captured commit signature could be replayed to re-create deleted commitments.

> **Fix applied:** Replay protection hashes commitment data `(source_address:evm_address:source_type)` and rejects duplicates. Claim signatures separately tracked with 5-min timestamp window.

---

### 3. [HIGH] CSRF via permissive CORS — FIXED

**Location:** `api/api.py:36-48`

`allow_origins=["*"]` with credentials enabled meant a malicious page could trigger commits/claims on behalf of a user with an open session.

> **Fix applied:** Origin allowlist restricted to `modc2.com`, `bridge.modc2.com`, and localhost dev ports. Configurable via `BRIDGE_CORS_ORIGINS` env var. Now that claim requires wallet signature, CSRF alone cannot steal funds.

---

### 4. [HIGH] /forward exposed destructive methods — FIXED

**Location:** `api/api.py:241-247`

`/forward` with `action=delete_claim` could delete legitimate claims. `action=deploy` exposed.

> **Fix applied:** `FORWARD_ALLOWLIST` restricts to safe read + commit/claim methods only. `delete_claim`, `deploy`, `compile`, `test` blocked from dynamic dispatch.

---

### 5. [HIGH] Contract owner can mint/burn without timelock — OPEN

**Location:** `contracts/Bridge.sol:121`

If `BRIDGE_SIGNER_KEY` leaks, attacker has instant unlimited mint/burn. Timelock exists but can be bypassed via direct `bridgeMint`/`bridgeBurn`.

> **Risk:** Not a direct client-side attack — requires server key compromise. But if it happens, all user tokens are at risk.
> **Recommendation:** Remove direct mint/burn, force timelock. Use multisig owner.

---

### 6. [MEDIUM] Path traversal in `_ensure_hardhat` — FIXED (hardened)

**Location:** `mod.py:548`

`str().startswith()` path check can be fooled by partial matches (e.g. `/mod2/` passes `/mod/` check).

> **Fix applied:** Paths `.resolve()`d and validated within mod root. Not client-facing but prevents supply-chain-style attacks.

---

## Non-Client Findings (operational / informational)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 6 | medium | Timelock frontrun censorship | OPEN — contract change |
| 7 | medium | /balances bulk scraping | Rate-limited (pagination added) |
| 8 | medium | Hardcoded prod URLs in frontend | OPEN — intentional fallback |
| 9 | low | BRIDGE_ADMIN_KEY not validated at startup | OPEN — operational |
| 10 | low | Duplicate bridgeId in contract events | OPEN — contract change |
| 11 | info | OpenZeppelin 4.9.3 outdated | OPEN — dep upgrade |
| 12 | info | Docker DEV=1 volume mount | OPEN — deployment practice |
| 13 | info | Entrypoint symlink without validation | OPEN — deployment practice |
| 14 | info | Stack traces in API errors | OPEN — operational |

## Status

| Metric | Value |
|--------|-------|
| Client-side theft vectors | **0 remaining** (2 critical fixed) |
| Total findings | 14 |
| Fixed | 6 (2 critical, 3 high, 1 medium) |
| Open | 8 (1 high contract, 3 medium, 2 low, 3 info) |

### Environment Variables
- `BRIDGE_SIGNER_KEY` — private key for on-chain tx signing (required for commitments)
- `BRIDGE_ADMIN_KEY` — secret for admin ops like delete_claim
- `BRIDGE_CORS_ORIGINS` — comma-separated CORS allowlist override

### Wallet Interaction Security
- **Commit:** User signs `commit {evm_address}` with SubWallet/Phantom. Replay-protected.
- **Claim:** User signs `claim {timestamp}` with source wallet. 5-min window, replay-protected.
- **Update:** User signs `commit {new_evm}` with source wallet. Replay-protected.
- **All signatures:** Verified server-side against source address. Used-sig store prevents replay.
