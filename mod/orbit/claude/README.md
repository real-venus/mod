# Claude Mod

<div align="center">

**Programmable AI developer interface**

Python SDK · Rust Job Engine · Retro Terminal UI · IPFS Versioning

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Rust 1.70+](https://img.shields.io/badge/rust-1.70+-orange.svg)](https://www.rust-lang.org)
[![Next.js 14](https://img.shields.io/badge/next.js-14-black.svg)](https://nextjs.org)

</div>

---

Script code tasks with Python. Run long-lived jobs through a Rust backend. Version everything to IPFS. Watch it all from a retro terminal dashboard.

## Quick Start

```bash
git clone https://github.com/modprotocol/mod.git
cd mod/mod/orbit/claude

pip install -r requirements.txt
./start.sh
```

API server on **:8820**, terminal UI on **:8821**. No wallet required in local mode (default).

<details>
<summary><strong>Docker</strong></summary>

```bash
docker compose up -d
```

</details>

<details>
<summary><strong>Install from IPFS</strong></summary>

```bash
ipfs get <CID> -o claude && cd claude
pip install -r requirements.txt
```

Get the latest CID from the on-chain registry: `m.get_cid('claude')`

</details>

## Python SDK

```python
from claude import Mod

c = Mod()
```

### Code Operations

```python
c.analyze_code(path="/project", focus="security")       # read-only analysis
c.generate_code(description="FastAPI auth with JWT",     # generate new code (owner-only)
                path="/project")
c.refactor(instructions="Extract into decorators",       # refactor existing code (owner-only)
           path="/project")
c.debug(issue_description="TypeError on line 42",        # debug issues
        path="/project")
c.run_task(task="Add docstrings to public functions",    # general task
           path="/project")
c.batch_process(["Check SQL injection",                  # batch multiple queries
                 "Find unused imports"], model="haiku")
c.ask("Explain this error: TypeError on line 42")        # conversational (OpenRouter)
c.edit_file("config.py", "Add DATABASE_URL env var")     # edit a specific file (owner-only)
```

### Jobs

**Local** — fire-and-forget via Claude CLI:

```python
task = c.bg("refactor utils.py to use async", mod="core", model="sonnet")
# => {'pid': 12345, 'log_file': '~/.mod/claude/logs/...'}

c.bg_status(task['pid'])   # check status
c.bg_list()                # list all background tasks
```

**Server** — managed execution with streaming through the Rust engine:

```python
job = c.submit("Build React dashboard", model="sonnet", work_dir="/project")

c.tail(job['id'])       # stream live output (SSE)
c.jobs()                # list all jobs
c.cancel(job['id'])     # cancel a running job
c.delete_job(job['id']) # delete a job
```

The SDK auto-starts the Rust API on first use and shuts it down after idle timeout (default 300s).

### Versioning

Semantic versioning backed by IPFS:

```python
c.snapshot("v1.2.0", message="Add auth endpoints")
c.changelog()
c.get_version("v1.2.0")
c.restore_version("v1.2.0")
```

### Modules

```python
c.create_module("mymod", prompt="Build a web scraper module")
c.edit_module("mymod", prompt="Add rate limiting")
c.modules()              # list all orbit modules
```

## Web UI

Retro terminal dashboard at **localhost:8821**:

- ASCII boot screen with CRT aesthetic
- Job submission with live SSE streaming
- File browser with syntax highlighting (20+ languages)
- File search (`Cmd+P`) and content search (`Cmd+Shift+F`)
- Image paste support
- MetaMask / multi-chain wallet auth
- 6 themes: dark, light, matrix, cyberpunk, amber, ocean

## REST API

Rust server (Axum + SQLite) on port `8820`.

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/config` | Module config |
| `GET` | `/owner` | Owner address |
| `GET` | `/repos` | List git repos |
| `GET` | `/modules` | List orbit modules |
| `GET` | `/modules/{name}/config` | Module config by name |
| `GET` | `/changelog` | Version changelog |
| `GET` | `/versions/{version}` | Specific version entry |
| `GET` | `/files/tree?path=&depth=` | Directory tree |
| `GET` | `/files/content?path=` | File contents |
| `GET` | `/files/search?path=&query=` | Search file names |
| `GET` | `/files/grep?path=&query=` | Grep file contents |

### Authenticated

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/challenge?address=0x...` | Signature challenge |
| `POST` | `/auth/verify` | Verify signature, get JWT |
| `GET` | `/auth/role` | Check user role |
| `POST` | `/jobs` | Submit new job |
| `GET` | `/jobs` | List all jobs |
| `GET` | `/jobs/{id}` | Job details |
| `DELETE` | `/jobs/{id}` | Delete job |
| `POST` | `/jobs/{id}/cancel` | Cancel running job |
| `GET` | `/jobs/{id}/stream` | SSE stream of job output |
| `POST` | `/files/write` | Write file contents |

```bash
curl -X POST http://localhost:8820/jobs \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add error handling to api.py", "model": "sonnet", "work_dir": "/project"}'
```

## Auth & Permissions

| Mode | How | Details |
|------|-----|---------|
| **Local** | `CLAUDE_JOBS_LOCAL=1` (default) | No auth, all endpoints open |
| **Wallet** | MetaMask / SubWallet / BIP-39 / password-derived key | EIP-191 challenge-verify, HMAC bearer token (24h) |

The first wallet to authenticate becomes the **owner**. Owners can edit any file and delete any module. Non-owners can only edit modules under `_outer/{their_address}/`. Read-only operations are open to everyone.

```python
c = Mod(owner="0x1234...")
c.is_owner("0x1234...")
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Anthropic API key (optional for Claude Max) |
| `OPENROUTER_API_KEY` | — | OpenRouter key for 200+ models |
| `CLAUDE_JOBS_LOCAL` | `1` | `0` to enable wallet auth |
| `MOD_ANCHOR` | `~/mod` | Base directory for module creation |

**Models:**

| Model | Speed | Best For |
|-------|-------|----------|
| `haiku` | Fast | Quick checks, linting, simple tasks |
| `sonnet` | Medium | General development (default) |
| `opus` | Slow | Complex architecture, major refactors |

## Architecture

```
claude/
├── claude/mod.py          # Python SDK — 34 public methods, auto-starts API
├── api/src/               # Rust job engine (Axum + SQLite + SSE)
│   ├── api.rs             #   REST endpoints, file browser, module ops
│   ├── jobs.rs            #   Job lifecycle, process management, crash recovery
│   ├── auth.rs            #   Wallet signature auth (EIP-191 + HMAC)
│   └── main.rs            #   Entry point, Tokio runtime
├── app/src/               # Next.js 14 terminal UI
│   ├── app/page.tsx       #   Dashboard (jobs, files, modules, wallet)
│   ├── app/globals.css    #   6 retro themes
│   └── app/api/           #   Service proxy routes
├── config.json            # Module metadata, endpoints, schema
├── start.sh / stop.sh     # Process management
├── docker-compose.yml     # Container deployment
├── requirements.txt       # Python deps
└── tests/                 # Python test suite
```

## Development

```bash
python -m pytest tests/                # run tests
cd api && cargo build --release        # build Rust server
cd app && npm run dev -- -p 8821       # frontend dev server
```

## Troubleshooting

<details>
<summary>Claude CLI not found</summary>

```bash
brew install anthropics/claude/claude
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

## Fork

```bash
m fork claude myclaude "Add GitLab integration"
```

Forks include full source (Python, Rust, Next.js), config, and tests. Lives in `~/mod/mod/orbit/<name>` and can be published with `m.publish('name')`.

---

Part of the [Mod framework](https://github.com/modprotocol/mod).
