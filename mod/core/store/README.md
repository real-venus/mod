# mod store

The mod **store** module: a local key-value store **and** an app for
decentralized storage via the `filecoin` and `hippius` orbit modules, gated
by MetaMask Sign-In with Ethereum (SIWE).

```
mod/core/store/
├── src/                      # local-FS Store class + backend adapters
│   ├── mod.py                # Store (KV) + serve()/app()/api()/backends()
│   ├── filecoin/mod.py       # adapter → m.mod('filecoin')()
│   ├── hippius/mod.py        # adapter → m.mod('hippius')()
│   └── localfs/              # localfs backend (existing)
├── api/api.py                # FastAPI gateway + SIWE
├── app/                      # Next.js app: MetaMask connect → SIWE → upload
├── config.json
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── serve.sh                  # local launcher (no docker)
└── test/
```

## Run

### Docker (recommended)

```bash
cd ~/mod/mod/core/store
docker compose up --build         # API: 50150, App: 50151
# open http://localhost:50151
```

Tear down:
```bash
docker compose down -v            # also remove the data volume
```

The compose file uses the repo root as its build context so the image can
include `mod/`, `mod/orbit/filecoin/`, `mod/orbit/hippius/`, `mod/orbit/dstore/`,
and the root `config.json` / `requirements.txt` the mod runtime needs.

### Local (no docker)

```bash
~/mod/mod/core/store/serve.sh     # starts uvicorn + next dev
```

Or programmatically via the mod protocol:

```bash
m store/serve                     # spawns serve.sh in background
m store/api                       # API only
m store/app                       # App only
```

## Endpoints

| Method | Path        | Auth | Notes |
|--------|-------------|------|-------|
| GET    | `/health`   | —    | liveness |
| GET    | `/status`   | —    | module + backend status |
| GET    | `/backends` | —    | list backends |
| GET    | `/nonce`    | —    | issue SIWE nonce for address |
| POST   | `/verify`   | —    | verify SIWE signature → bearer token |
| GET    | `/me`       | ✓    | current session address |
| POST   | `/put`      | ✓    | multipart upload (form: file, backend, key) |
| GET    | `/get`      | —    | retrieve by CID |
| POST   | `/pin`      | ✓    | pin a CID on a backend |
| GET    | `/list`     | ✓    | list caller's objects |
| DELETE | `/rm`       | ✓    | remove an index record |

## SIWE flow

1. App: `GET /nonce?address=0x…` → `{nonce, domain, origin}`
2. App builds EIP-4361 message, MetaMask `personal_sign`
3. App: `POST /verify {message, signature}` → server `ecrecover`s, issues HMAC-SHA256 bearer token
4. App stores token in `localStorage`, sends `Authorization: Bearer <token>` on each call
5. Server-side: address is the per-object `owner` column

Set `STORE_JWT_SECRET` in the environment for stable sessions across restarts.

## Environment

| Var | Default | Notes |
|-----|---------|-------|
| `STORE_JWT_SECRET` | random per-run | HMAC secret |
| `STORE_DOMAIN` | `localhost:50151` | SIWE domain field |
| `STORE_ORIGIN` | `http://localhost:50151` | SIWE URI field |
| `FILECOIN_GATEWAY` | `https://node.lighthouse.storage` | gateway for `put`/`get` when lotus not running |
| `FILECOIN_GATEWAY_TOKEN` | — | bearer token for gateway uploads |
| `HIPPIUS_S3_ENDPOINT` | `https://s3.hippius.com` | S3 gateway |
| `HIPPIUS_S3_KEY` / `_SECRET` / `_BUCKET` | — | S3 credentials |
| `HIPPIUS_IPFS_GATEWAY` | `https://get.hippius.network` | retrieval gateway |
| `STORE_API_PORT` / `STORE_APP_PORT` | `50150` / `50151` | port overrides |

## Architecture

```
   ┌─────────────────────┐
   │ Next.js (50151)     │  MetaMask + SIWE
   └──────┬──────────────┘
          │ Bearer JWT
   ┌──────▼──────────────┐
   │ FastAPI (50150)     │  /nonce /verify /put /get …
   └──────┬──────────────┘
          │
   ┌──────▼──────────────┐
   │ orbit/dstore        │  unified put/get/list, SQLite index
   └──┬──────────────┬───┘
      │              │
 ┌────▼─────┐  ┌─────▼──────┐
 │ orbit/   │  │ orbit/     │
 │ filecoin │  │ hippius    │
 │ (lotus)  │  │ (substrate)│
 └──────────┘  └────────────┘
```
