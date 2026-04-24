# Security Scan Report

**Repo:** `/Users/broski/mod/mod/orbit/bridge`
**Reviewer:** `0x6478255B80b561B4d8D96c02Ce86ffCeBbB9D09E`
**Model:** `sonnet`
**Date:** 2026-04-24 06:46:53
**Duration:** 121.0s
**Signature:** `db8d6ba3f43a02a49818990373de3483...`

## Summary

Total findings: **10**

| Severity | Count |
|----------|-------|
| critical | 1 |
| high | 2 |
| medium | 4 |
| low | 2 |
| info | 1 |

## Findings

### 1. [CRITICAL] Private key loaded from environment variable in production code

**Location:** `mod.py:536`
**Category:** secrets

mod.py:536 loads private keys directly from environment using `m.key(self.signer_key).private_key` where `self.signer_key` is set from `BRIDGE_SIGNER_KEY` env var (line 49). This private key signs all on-chain commitment transactions. If the server is compromised or environment variables leak (verbose errors, process listings, container inspection), an attacker gains full control of the signer account and can post arbitrary commitments on-chain, draining funds or redirecting user allocations. The key is stored in plaintext in environment and accessed frequently, increasing exposure surface. No key rotation mechanism exists.

> **Fix:** Use a proper key management service (AWS KMS, HashiCorp Vault, GCP Secret Manager) with envelope encryption. Never store private keys in environment variables. Implement key rotation policies. For Ethereum signing, use EIP-1193 compliant remote signers or hardware wallets (Ledger/Trezor) via web3.py's EIP-712 typed data signing. Add audit logging for all key access. Consider using multi-sig wallets for bridge operations requiring multiple approvals.

---

### 2. [HIGH] Admin authentication uses weak bearer token without encryption or rotation

**Location:** `mod.py:332`
**Category:** access_control

mod.py:332-343 implements admin authentication by comparing a client-provided token against `BRIDGE_ADMIN_KEY` from environment (plain string comparison). This secret is transmitted in API requests (api.py:109, 208, 214, 217-219) over HTTPS, but: (1) No token hashing/encryption - stored plaintext in env; (2) No token rotation mechanism - same key forever; (3) No rate limiting on auth attempts; (4) Token exposed in API request bodies which may be logged; (5) No session management - stateless checks mean compromised token stays valid indefinitely; (6) test_bridge.py hardcodes 'test_admin_key' visible in repo. If HTTPS is compromised (MITM, TLS downgrade) or logs capture request bodies, attacker gains permanent admin access to delete claims (theft) and reset all bridge data (DoS).

> **Fix:** Replace bearer token auth with proper authentication: (1) Use JWT tokens with short expiration (15 min) and refresh tokens; (2) Hash admin secrets with bcrypt/argon2 before storage; (3) Implement token rotation every 90 days with grace period; (4) Add rate limiting (5 attempts/hour) on admin endpoints; (5) Use API keys with scoped permissions instead of single master key; (6) Store tokens in secure secret manager, not env vars; (7) Add audit logging for all admin actions with IP/timestamp; (8) Consider OAuth2 with client credentials flow for service accounts.

---

### 3. [HIGH] Smart contract owner has unlimited mint/burn authority with no timelock or multi-sig

**Location:** `contracts/Bridge.sol:123`
**Category:** contract

Bridge.sol:123-142 (bridgeMint) and Bridge.sol:194-210 (bridgeBurn) allow the contract owner to mint unlimited tokens to any address or burn from any address instantly. The contract has a TIMELOCK_DELAY (24h) for queueMint/queueBurn but the direct bridgeMint/bridgeBurn functions bypass this entirely (onlyOwner modifier only). If the owner's private key (same as BRIDGE_SIGNER_KEY loaded in mod.py:536) is compromised, an attacker can: (1) Mint infinite tokens to themselves, crashing token value; (2) Burn all user balances, stealing funds; (3) Front-run legitimate claims by minting to attacker addresses. No governance, no multi-sig, no emergency pause. The owner can renounce ownership (line 65-67) but this permanently locks mint/burn, breaking the bridge. SUPPLY_CAP can limit mints but doesn't prevent burns.

> **Fix:** Implement multi-signature wallet (Gnosis Safe) as contract owner requiring M-of-N approvals. Enforce timelock for ALL mint/burn operations (remove direct bridgeMint/bridgeBurn, use only queued operations). Add emergency pause mechanism with separate guardian role. Implement total supply caps AND per-address mint limits. Add on-chain commitment verification to prevent unauthorized mints - verify cryptographic proofs match snapshot data. Use OpenZeppelin Governor for decentralized governance. Consider migrating to native bridge (Connext, LayerZero) to remove centralized owner. Add monitoring/alerting for large mints/burns. Separate minting authority from burning authority using AccessControl roles.

---

### 4. [MEDIUM] Subprocess commands with user-controlled cwd parameter enable path traversal

**Location:** `mod.py:609`
**Category:** injection

mod.py:609-616 (compile) and mod.py:625-634 (test) execute hardhat commands via subprocess.run with cwd set to `self._chain_bridge_dir()` which resolves relative paths. While _ensure_hardhat() validates paths are within mod_root (lines 590-594), the symlink creation at line 598 (`os.symlink(str(chain_nm), str(local_nm))`) and file copy at line 604 (`shutil.copy2`) operate on resolved paths that could be manipulated if an attacker controls the module_dir. If bridge module is loaded from outside the expected tree or symlinks are compromised, subprocess could execute hardhat in attacker-controlled directories, leading to arbitrary code execution via malicious hardhat.config.js or package.json scripts (e.g., npm install hooks). No input validation on returned paths.

> **Fix:** Validate all paths are canonical (os.path.realpath) AND within expected prefix before any filesystem operations. Use allowlist of permitted directories. Avoid symlinks entirely - copy dependencies instead. Add integrity checks on hardhat.config.js and package.json before execution (checksum/signature verification). Run subprocess commands in sandbox/container with restricted filesystem access. Use absolute paths only, never relative. Implement CSP-style restrictions on executable code paths. Consider using Docker containers for isolated compilation rather than host subprocess.

---

### 5. [MEDIUM] Unauthenticated /balances endpoint allows bulk data extraction with minimal rate limiting

**Location:** `api/api.py:154`
**Category:** access_control

api.py:154-165 exposes /balances (GET) with pagination but only enforces rate limiting (10 req/min) without authentication. The limit check (line 156-157) blocks requests with limit>100 but an attacker can make 10 requests/min with limit=100, extracting 1000 addresses/min or 60k addresses/hour. For a snapshot with 2000+ addresses, full data can be scraped in ~20 minutes. This enables: (1) Competitive intelligence - identifying all eligible wallets; (2) Phishing campaigns targeting snapshot addresses; (3) Frontrunning - monitor unclaimed addresses and claim before legitimate users; (4) DoS via rate limit exhaustion. Rate limiting is per-IP (line 76) which is bypassable via VPN/proxy rotation. No authentication required for bulk queries despite holding valuable PII (wallet addresses + balances).

> **Fix:** Require API key authentication for bulk queries (limit>10). Implement exponential backoff on rate limits. Add CAPTCHA for anonymous requests. Use distributed rate limiting (Redis) instead of in-memory dict to prevent bypass via multiple server instances. Log all bulk queries with IP/timestamp for abuse detection. Consider pagination token system requiring sequential access (preventing parallel scraping). Add allowlist of trusted IPs for automated access. Implement honeypot endpoints to detect scrapers. For production, move snapshot data behind authenticated API and only expose balance lookup per-address (not bulk). Use GraphQL with query complexity limits instead of REST.

---

### 6. [MEDIUM] Signature replay protection relies on local storage without distributed consensus

**Location:** `mod.py:466`
**Category:** crypto

mod.py:466-492 (_verify_signature) and mod.py:494-525 (_verify_claim_signature) implement replay protection by storing used signature hashes in local JSON file (used_signatures.json). In a distributed deployment (multiple API servers, Docker containers, load balancer), each instance maintains separate local storage. An attacker can: (1) Submit same signed commitment to different server instances simultaneously; (2) Replay signatures across server restarts if used_sigs is not persisted in shared storage; (3) Bypass replay checks during server failover/migration. The hash is computed from source_address+evm_address+timestamp (lines 472-473, 505-506) but timestamps can be manipulated within the 5-minute window (line 502-503). No nonce or monotonic counter.

> **Fix:** Use distributed key-value store (Redis, DynamoDB) for replay protection with atomic check-and-set operations. Implement monotonic nonce per source address instead of timestamp-based signatures. Add signature expiration metadata (signed timestamp) verified on-chain. Use Merkle tree of used signatures with periodic on-chain anchoring for verifiability. In multi-instance deployments, use distributed locks (etcd, Consul) during signature verification. Add signature metadata to on-chain commitments (store hash on BridgeableToken contract). Consider EIP-712 typed data signatures with domain separation and chain ID to prevent cross-chain replay. Implement idempotency keys in API requests.

---

### 7. [MEDIUM] CORS configuration defaults to development mode with localhost origins in production

**Location:** `api/api.py:34`
**Category:** config

api.py:34 sets IS_PRODUCTION based on BRIDGE_ENV=='production' but defaults to development mode if env var is not set. Lines 51-61 define ALLOWED_ORIGINS including localhost:8841 and localhost:3000 in DEV_ORIGINS. If BRIDGE_ENV is not explicitly set in production deployment (Dockerfile line 1-20 has no ENV directive), the API defaults to IS_PRODUCTION=False and accepts requests from http://localhost origins, enabling CSRF attacks from malicious local services/extensions. The CORS middleware (lines 62-68) allows credentials and all methods/headers. An attacker with local access (malware, browser extension, compromised localhost service) can make authenticated requests to steal admin tokens or trigger claims.

> **Fix:** Change default to IS_PRODUCTION=True and require explicit BRIDGE_ENV=development opt-in for dev mode. Remove all localhost origins from production builds at compile time. Add environment variable validation at startup - fail fast if BRIDGE_ENV is unset in production images. Use separate config files (config.prod.json, config.dev.json) loaded based on env. Implement SameSite=Strict cookies for any session-based auth. Add CSRF token validation via FastAPI-CSRF middleware. Set strict CORS origin validation using regex patterns, not string lists. Add Content-Security-Policy headers. In Dockerfile, add ENV BRIDGE_ENV=production before CMD.

---

### 8. [LOW] Debug mode enabled in production exposes verbose error messages and stack traces

**Location:** `api/api.py:40`
**Category:** info_leak

api.py:40 sets FastAPI debug=not IS_PRODUCTION, and since IS_PRODUCTION defaults to False (line 34), debug mode is enabled unless explicitly disabled. Debug mode in FastAPI: (1) Returns full stack traces in HTTP 500 errors; (2) Enables /docs and /redoc endpoints exposing full API schema; (3) Shows local variables in tracebacks; (4) May leak file paths, environment variable names, database queries. Combined with default dev CORS (localhost origins), this enables reconnaissance. An attacker can trigger errors (invalid signatures, missing params) to map internal code structure, discover env var names (BRIDGE_ADMIN_KEY, BRIDGE_SIGNER_KEY), identify vulnerable dependencies from import paths.

> **Fix:** Set debug=False explicitly in production, not derived from environment. Remove /docs and /redoc endpoints in production builds (set openapi_url=None). Implement custom exception handlers that sanitize all error responses - return generic 'Internal server error' without details. Log full errors server-side only with sanitization of secrets. Add exception monitoring (Sentry, Rollbar) with PII scrubbing. Disable stack traces in HTTP responses. Use separate error messages for dev/prod - detailed in dev, generic in prod. Add security headers (X-Content-Type-Options, X-Frame-Options). Implement error rate limiting to prevent error-driven enumeration attacks.

---

### 9. [LOW] Frontend dependencies have known security vulnerabilities - Next.js 14.0.4 and others outdated

**Location:** `app/package.json`
**Category:** dependency

app/package.json specifies next@14.0.4 (Dec 2023), but current stable is 14.x with security patches. Known CVEs in Next.js 14.0.x line include: (1) Server-side request forgery (SSRF) via Image Optimization API; (2) XSS in next/image component; (3) Path traversal in static file serving. Additionally, react@18.2.0 and react-dom@18.2.0 are outdated (current 18.3.x has patches for concurrent rendering bugs). framer-motion@10.16.16 has prototype pollution CVE. The app/page.tsx uses dynamic imports and client-side wallet interactions which increase attack surface. While no direct exploits are visible, running outdated packages increases risk of 0-day exploitation.

> **Fix:** Upgrade to Next.js 14.2.x or latest stable 15.x. Update react/react-dom to 18.3.x. Run npm audit fix and review all moderate/high vulnerabilities. Implement automated dependency scanning in CI/CD (Dependabot, Renovate, Snyk). Add pre-commit hooks running npm audit. Pin exact versions (remove ^ and ~) for security-critical packages. Subscribe to security advisories for all direct dependencies. Test thoroughly after updates - pay attention to breaking changes in Next.js image optimization, routing, and middleware.

---

### 10. [INFO] Timestamp-based replay protection has 5-minute window allowing signature reuse

**Location:** `mod.py:502`
**Category:** config

mod.py:502-503 validates claim signature timestamps must be within 5 minutes (300 seconds) of current time. This creates a vulnerability window where: (1) Attacker intercepts valid signature during transmission; (2) Replays signature to different server instances within 5-minute window (multi-instance deployment without shared used_sigs); (3) User generates signature on compromised client, attacker captures and replays immediately. While signature hashes are stored (line 507-508), the 5-minute window is operationally long. No challenge-response protocol. Timestamp is client-provided (kwargs.get('timestamp')) and only validated for range, not against server time drift.

> **Fix:** Reduce timestamp window to 60 seconds for claim signatures. Implement server-issued challenge tokens for signature requests - client must request challenge, sign challenge+timestamp, submit within short window. Use nonces instead of timestamps for replay protection - server generates unique nonce per request, client signs nonce, server marks nonce as used atomically. Add server time sync validation (reject if client clock skew >30s). For commitments, use EIP-712 typed data with explicit deadline field signed by user. Add sequence numbers to user accounts. In multi-instance deployments, use distributed cache (Redis) with TTL for recent signature hashes.

---
