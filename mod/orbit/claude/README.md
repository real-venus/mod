<div align="center">

# Claude Mod

**Programmable AI developer interface**

Script tasks with Python. Run jobs through Rust. Version to IPFS. Watch from a retro terminal.

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-3776ab.svg)](https://www.python.org/downloads/)
[![Rust](https://img.shields.io/badge/rust-1.70+-dea584.svg)](https://www.rust-lang.org)
[![Next.js 14](https://img.shields.io/badge/next.js-14-000.svg)](https://nextjs.org)
[![IPFS](https://img.shields.io/badge/IPFS-versioned-65c2cb.svg)](#versioning)

```
┌──────────────────────────────────────────┐
│  Python SDK  →  Rust Engine  →  Next.js  │
│  34 methods     Axum + SQLite   Terminal  │
│  claude/mod.py  api/src/        app/src/  │
└──────────────────────────────────────────┘
```

</div>

## Quick Start

```bash
git clone https://github.com/modprotocol/mod.git
cd mod/mod/orbit/claude

pip install -r requirements.txt
./start.sh
```

API on **:8820**, UI on **:8821**. Local mode by default — no wallet needed.

<details>
<summary>Docker</summary>

```bash
docker compose up -d
```

</details>

<details>
<summary>Install from IPFS</summary>

```bash
ipfs get <CID> -o claude && cd claude
pip install -r requirements.txt
```

Get the latest CID from the on-chain registry: `m.get_cid('claude')`

</details>

---

## Python SDK

```python
from claude import Mod

c = Mod()
```

### Code Operations

```python
c.analyze_code(path="/project", focus="security")
c.generate_code(description="FastAPI auth with JWT", path="/project")
c.refactor(instructions="Extract into decorators", path="/project")
c.debug(path="/project", error="TypeError on line 42")
c.run_task(task="Add docstrings to public functions", path="/project")
c.batch_process(["Check SQL injection", "Find unused imports"], model="haiku")
c.ask("Explain this error: TypeError on line 42")
c.edit_file("config.py", "Add DATABASE_URL env var")
```

### Jobs

**Local** — fire-and-forget via Claude CLI:

```python
task = c.bg("refactor utils.py to use async", mod="core", model="sonnet")
c.bg_status(task['pid'])
c.bg_list()
```

**Server** — managed execution with live streaming through the Rust engine:

```python
job = c.submit("Build React dashboard", model="sonnet", work_dir="/project")
c.tail(job['id'])          # stream live output (SSE)
c.jobs()                   # list all jobs
c.cancel(job['id'])        # cancel running job
c.delete_job(job['id'])    # remove job
```

The SDK auto-starts the Rust API on first use and shuts it down after idle timeout (default 300s).

### Versioning

Semantic versioning backed by IPFS:

```python
c.snapshot("v1.2.0", description="Add auth endpoints")
c.changelog()
c.get_version("v1.2.0")
c.restore_version("v1.2.0")
```

### Modules

```python
c.create_module("mymod", prompt="Build a web scraper module")
c.edit_module("mymod", prompt="Add rate limiting")
c.modules()
```

---

## Web UI

Retro terminal dashboard at **localhost:8821**.

| Feature | Details |
|---|---|
| Job submission | Live SSE streaming with output tail |
| File browser | Syntax highlighting for 20+ languages |
| Search | `Cmd+P` file search, `Cmd+Shift+F` content grep |
| Wallet auth | MetaMask, SubWallet, BIP-39, password-derived key |
| Themes | dark, light, matrix, cyberpunk, amber, ocean |
| Extras | Image paste, ASCII boot screen, CRT aesthetic |

---

## REST API

Rust server (Axum + SQLite) on port `8820`.

<details>
<summary>Public Endpoints</summary>

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/config` | Module config |
| `GET` | `/owner` | Owner address |
| `GET` | `/repos` | List git repos |
| `GET` | `/modules` | List orbit modules |
| `GET` | `/modules/{name}/config` | Module config by name |
| `GET` | `/changelog` | Version changelog |
| `GET` | `/versions/{version}` | Version entry |
| `GET` | `/files/tree?path=&depth=` | Directory tree |
| `GET` | `/files/content?path=` | File contents |
| `GET` | `/files/search?path=&query=` | Search file names |
| `GET` | `/files/grep?path=&query=` | Grep file contents |

</details>

<details>
<summary>Authenticated Endpoints</summary>

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/challenge?address=0x...` | Signature challenge |
| `POST` | `/auth/verify` | Verify signature, get JWT |
| `GET` | `/auth/role` | Check user role |
| `POST` | `/jobs` | Submit job |
| `GET` | `/jobs` | List jobs |
| `GET` | `/jobs/{id}` | Job details |
| `DELETE` | `/jobs/{id}` | Delete job |
| `POST` | `/jobs/{id}/cancel` | Cancel job |
| `GET` | `/jobs/{id}/stream` | SSE output stream |
| `POST` | `/files/write` | Write file |

</details>

**Example:**

```bash
curl -X POST http://localhost:8820/jobs \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add error handling to api.py", "model": "sonnet", "work_dir": "/project"}'
```

---

## Auth & Permissions

| Mode | How | Details |
|---|---|---|
| **Local** | `CLAUDE_JOBS_LOCAL=1` (default) | No auth, all endpoints open |
| **Wallet** | MetaMask / SubWallet / BIP-39 / password key | EIP-191 challenge-verify, HMAC bearer token (24h) |

The first wallet to authenticate becomes the **owner**. Owners can edit any file and delete any module. Non-owners can only edit modules under `_outer/{their_address}/`. Read-only operations are always open.

---

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Anthropic API key (optional with Claude Max) |
| `OPENROUTER_API_KEY` | — | OpenRouter key for 200+ models |
| `CLAUDE_JOBS_LOCAL` | `1` | Set `0` to enable wallet auth |
| `MOD_ANCHOR` | `~/mod` | Base directory for module creation |

**Models:**

| Model | Speed | Use |
|---|---|---|
| `haiku` | Fast | Quick checks, linting, simple tasks |
| `sonnet` | Medium | General development (default) |
| `opus` | Slow | Complex architecture, major refactors |

---

## Architecture

```
claude/
├── claude/mod.py          Python SDK (34 methods, auto-starts API)
├── api/src/               Rust job engine
│   ├── api.rs               Axum REST + file browser + module ops
│   ├── jobs.rs              Job lifecycle, process mgmt, crash recovery
│   ├── auth.rs              EIP-191 wallet auth + HMAC tokens
│   └── main.rs              Tokio entry point
├── app/src/               Next.js 14 terminal UI
│   ├── app/page.tsx         Dashboard — jobs, files, modules, wallet
│   ├── app/globals.css      Theme system (6 themes)
│   └── app/api/             Service proxy routes
├── config.json            Module metadata + endpoint schema
├── start.sh / stop.sh     Process management
├── docker-compose.yml     Container deployment
├── requirements.txt       Python deps
└── tests/                 Test suite
```

---

## Development

```bash
python -m pytest tests/                # run tests
cd api && cargo build --release        # build Rust server
cd app && npm run dev -- -p 8821       # frontend dev server
```

---

## Troubleshooting

<details>
<summary>Claude CLI not found</summary>

```bash
npm install -g @anthropic-ai/claude-code
```

</details>

<details>
<summary>API key issues</summary>

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

</details>

<details>
<summary>Job server not starting</summary>

```bash
lsof -i :8820              # check if port is in use
pkill -f claude-jobs        # kill existing process
./start.sh                  # restart
```

</details>

<details>
<summary>IPFS not available</summary>

```bash
brew install ipfs
ipfs init && ipfs daemon &
```

</details>

---

## Fork

```bash
m fork claude myclaude "Add GitLab integration"
```

Forks include full source (Python, Rust, Next.js), config, and tests. Lives in `~/mod/mod/orbit/<name>` and can be published with `m.publish('name')`.

---

<div align="center">

Part of the [Mod framework](https://github.com/modprotocol/mod).

</div>
