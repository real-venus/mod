# Claude Mod

<div align="center">

**Programmable AI developer interface**

Python SDK · Rust Job Server · 8-Bit Terminal UI

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Rust 1.70+](https://img.shields.io/badge/rust-1.70+-orange.svg)](https://www.rust-lang.org)
[![Next.js 14](https://img.shields.io/badge/next.js-14-black.svg)](https://nextjs.org)

</div>

---

Script code tasks with Python, run long-lived jobs through a Rust backend, version everything to IPFS, and watch it all from a retro terminal dashboard.

## Quick Start

```bash
git clone https://github.com/modprotocol/mod.git
cd mod/mod/orbit/claude

pip install -r requirements.txt
cd app && npm install && cd ..

./scripts/start.sh          # starts Rust server + Next.js UI
```

Open **http://localhost:8821** — no wallet required in local mode (default).

```bash
./scripts/start.sh --build   # force Rust rebuild
./scripts/start.sh --prod    # production Next.js build
```

<details>
<summary><strong>Install from IPFS</strong></summary>

```bash
ipfs get <CID> -o claude && cd claude
pip install -r requirements.txt
cd app && npm install && cd ..
```

The IPFS CID for the latest version is stored in the module's on-chain registry. Use `m.get_cid('claude')` to retrieve it.

</details>

## Python SDK

```python
from claude import Mod

c = Mod()
```

### Core Operations

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

### Background Jobs

**Local** — fire-and-forget via Claude CLI:

```python
task = c.bg("refactor utils.py to use async", mod="core", model="sonnet")
# => {'pid': 12345, 'log_file': '~/.mod/claude/logs/...'}
```

**Server** — managed execution with streaming through the Rust engine:

```python
job = c.submit("Build React dashboard", model="sonnet", work_dir="/project")

c.tail(job['id'])       # stream live output (SSE)
c.jobs()                # list all jobs
c.cancel(job['id'])     # cancel a running job
c.delete_job(job['id']) # delete a job
```

### Versioning

Semantic versioning backed by IPFS:

```python
c.snapshot("v1.2.0", message="Add auth endpoints")   # create versioned snapshot
c.changelog()                                          # view version history
c.show_changelog()                                     # pretty-print changelog
c.get_version("v1.2.0")                               # fetch specific version
c.restore_version("v1.2.0")                            # restore from IPFS CID
```

### Module Operations

```python
c.create_module("mymod", prompt="Build a web scraper module")
c.edit_module("mymod", prompt="Add rate limiting")
c.fork_module("myclaude", fork_source="claude", prompt="Add GitLab integration")
```

## Web UI

Retro terminal dashboard at **http://localhost:8821** with:

- ASCII boot screen and CRT aesthetic
- Job submission, live SSE streaming, cancel/delete
- File browser with syntax highlighting (20+ languages)
- File search (`Cmd+P`) and content search (`Cmd+Shift+F`)
- Image paste support
- MetaMask wallet auth
- 6 themes: dark, light, matrix, cyberpunk, amber, ocean

## REST API

Rust server on port `8820`.

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/config` | Module config |
| `GET` | `/owner` | Owner status |
| `GET` | `/repos` | List git repos |
| `GET` | `/modules` | List orbit/core modules |
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

```bash
curl -X POST http://localhost:8820/jobs \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add error handling to api.py", "model": "sonnet", "work_dir": "/project"}'
```

## Auth & Permissions

| Mode | How | Details |
|------|-----|---------|
| **Local** | `CLAUDE_JOBS_LOCAL=1` (default) | No auth, all endpoints open |
| **Wallet** | MetaMask / SubWallet / BIP-39 mnemonic / password-derived key | EIP-191 challenge/verify, 24-hour JWT |

The first wallet to authenticate becomes the **owner**. Owners can edit any file. Non-owners can only edit modules under `_outer/{their_address}/`. Read-only operations (`analyze_code`, `debug`, `ask`) are open to everyone.

```python
c = Mod(owner="0x1234...")   # set owner at init
c.set_owner("0x1234...")     # or set later
c.is_owner("0x1234...")      # check ownership
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Anthropic API key (optional for Claude Max) |
| `OPENROUTER_API_KEY` | — | OpenRouter key for 200+ models |
| `CLAUDE_JOBS_LOCAL` | `0` | `1` to disable auth |
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
├── claude/claude.py        # Python SDK (Mod class)
├── server/src/             # Rust job engine (Axum + SQLite + SSE)
│   ├── api.rs              #   REST endpoints + file browser
│   ├── jobs.rs             #   Job lifecycle and process management
│   ├── auth.rs             #   Wallet signature auth (EIP-191)
│   └── main.rs             #   Entry point
├── app/src/                # Next.js 14 terminal UI
│   ├── app/page.tsx        #   Dashboard
│   ├── app/globals.css     #   6 retro themes
│   └── components/         #   FileTree, CodeViewer, Search, WalletModal
├── config.json             # Module metadata, endpoints, owner
├── scripts/start.sh        # One-command launcher
└── tests/                  # Python test suite
```

## Development

```bash
python -m pytest tests/              # run tests
cd server && cargo build --release   # build Rust server
cd app && npm run dev -- -p 8821     # frontend dev server
```

```python
from claude import Mod
Mod.set_log_level('DEBUG')           # enable debug logging
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
./scripts/start.sh --build  # restart with rebuild
```
</details>

<details>
<summary>IPFS not available</summary>

```bash
brew install ipfs
ipfs init && ipfs daemon &
```
</details>

## Fork This Module

```bash
m fork claude myclaude "Add GitLab integration"
```

Forks include full source (Python, Rust, Next.js), config, tests, and docs. Lives in `~/mod/mod/orbit/<name>` and can be published with `m.publish('name')`.

---

[Architecture](ARCHITECTURE.md) · [Backends](BACKENDS.md) · [Permissions & IPFS](PERMISSIONS_AND_IPFS.md) · [Module Creation](MODULE_CREATION.md) · [Examples](EXAMPLE_USAGE.md) · [Quick Ref](QUICK_REFERENCE.md) · [Wallet Guide](WALLET_GUIDE.md)

Part of the [Mod framework](https://github.com/modprotocol/mod).
