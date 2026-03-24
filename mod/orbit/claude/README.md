# Claude Mod

<div align="center">

**Programmable AI developer interface**

Python SDK · Rust Job Server · 8-Bit Terminal UI

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Rust 1.70+](https://img.shields.io/badge/rust-1.70+-orange.svg)](https://www.rust-lang.org)
[![Next.js 14](https://img.shields.io/badge/next.js-14-black.svg)](https://nextjs.org)

</div>

---

Claude Mod gives you a programmable interface to Claude Code for autonomous development workflows. Script code tasks with Python, manage long-running jobs through a Rust backend, and monitor everything from a retro terminal dashboard.

**What's in the box:**

- **Python SDK** — Type-safe API for code analysis, generation, refactoring, debugging, and AI chat
- **Rust Job Engine** — Axum HTTP server with SQLite persistence, SSE streaming, and wallet auth
- **8-Bit Terminal UI** — Next.js dashboard with CRT aesthetic, 6 themes, and image paste support
- **File Browser** — VS Code-style file explorer with syntax highlighting, search (Cmd+P), and content search (Cmd+Shift+F)
- **Background Jobs** — Long-running autonomous tasks with streaming logs
- **IPFS Storage** — Content-addressed versioning of all code changes
- **Multi-Model Support** — 200+ models via OpenRouter (Claude, GPT, Llama, etc.)
- **Owner-Based Access Control** — Restrict code edits to specific wallet addresses
- **Module Forking** — Generate and fork Mod framework modules programmatically

## Quick Start

```bash
git clone https://github.com/modprotocol/mod.git
cd mod/mod/orbit/claude

pip install -r requirements.txt
cd app && npm install && cd ..

./scripts/start.sh
```

Open **http://localhost:8821** — no wallet required in local mode (default).

The start script sets `CLAUDE_JOBS_LOCAL=1` by default, skipping authentication entirely.

```bash
# Options
./scripts/start.sh --build   # Force Rust rebuild
./scripts/start.sh --prod    # Production Next.js build
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

### Synchronous Operations

```python
c.analyze_code(path="/project", focus="security")
c.generate_code(description="FastAPI auth endpoint with JWT", path="/project")
c.refactor(instructions="Extract validation into decorators", path="/project")
c.debug(issue_description="TypeError on line 42", path="/project")
c.run_task(task="Add docstrings to all public functions", path="/project")
c.batch_process(["Check SQL injection", "Find unused imports"], model="haiku")
c.ask("Explain this error: TypeError on line 42")
```

### Background Jobs (CLI)

Fire-and-forget tasks using Claude CLI directly:

```python
task = c.bg("refactor utils.py to use async", mod="core", model="sonnet")
# Returns: {'pid': 12345, 'log_file': '~/.mod/claude/logs/...'}
```

### Background Jobs (Server)

Submit to the Rust job engine for managed execution with streaming:

```python
job = c.submit("Build React dashboard", model="sonnet", work_dir="/project")

c.tail(job['id'])       # Stream live output
c.jobs()                # List all jobs
c.cancel(job['id'])     # Cancel running job
```

### Module Operations

```python
c.create_module("mymod", prompt="Build a web scraper module")
c.fork_module("mymod", fork_source="claude", prompt="Add rate limiting")
c.edit_file("config.py", "Add DATABASE_URL environment variable")
```

## Web UI

Retro terminal dashboard at **http://localhost:8821** with job submission, live SSE streaming, module creation, image paste, wallet auth, and 6 themes (dark, light, matrix, cyberpunk, amber, ocean).

## REST API

Rust server on port `8820`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/repos` | List git repos |
| `GET` | `/auth/challenge?address=0x...` | Get signature challenge |
| `POST` | `/auth/verify` | Verify signature, returns JWT |
| `POST` | `/jobs` | Submit new job |
| `GET` | `/jobs` | List all jobs |
| `GET` | `/jobs/{id}` | Get job details |
| `DELETE` | `/jobs/{id}` | Delete job |
| `POST` | `/jobs/{id}/cancel` | Cancel running job |
| `GET` | `/jobs/{id}/stream` | SSE stream of job output |
| `GET` | `/owner` | Check owner status |

```bash
curl -X POST http://localhost:8820/jobs \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add error handling to api.py", "model": "sonnet", "work_dir": "/project"}'
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Anthropic API key (optional for Claude Max users) |
| `OPENROUTER_API_KEY` | — | OpenRouter key for 200+ models |
| `CLAUDE_JOBS_LOCAL` | `0` | Set to `1` to disable authentication |
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
├── claude/claude.py        # Python SDK
├── server/src/             # Rust job engine (Axum + SQLite + SSE)
│   ├── api.rs              #   REST endpoints
│   ├── jobs.rs             #   Job lifecycle and process management
│   ├── auth.rs             #   Wallet signature auth (EIP-191)
│   └── main.rs             #   Entry point
├── app/src/app/            # Next.js 14 terminal UI
│   ├── page.tsx            #   Dashboard
│   └── globals.css         #   6 retro themes
├── scripts/start.sh        # One-command launcher
└── tests/                  # Python test suite
```

## Auth

- **Local mode** (`CLAUDE_JOBS_LOCAL=1`) — No auth, all endpoints open
- **Wallet mode** — EIP-191 signature challenge/verify with 24-hour JWT tokens

Wallet options: MetaMask, SubWallet, local key (BIP-39 mnemonic), or password-derived key (keccak256 hash).

<details>
<summary><strong>Owner-Based Access Control</strong></summary>

The first person to authenticate automatically becomes the owner. Owner-only operations include `refactor()`, `generate_code()`, and `edit_file()`. Read-only operations like `analyze_code()`, `debug()`, and `ask()` are available to everyone.

```python
c = Mod(owner="0x1234...")   # Set owner during init
c.set_owner("0x1234...")     # Or set later
c.is_owner("0x1234...")      # Check ownership
c.reload_owner()             # Reload from config
```

See [AUTO_OWNER_SETUP.md](./AUTO_OWNER_SETUP.md) for details.

</details>

<details>
<summary><strong>IPFS Version History</strong></summary>

All code changes are automatically stored to IPFS for immutable, content-addressed versioning.

```python
c.show_history(limit=10)    # Display recent changes with CIDs
history = c.get_history()    # Get full history as JSON
cid = c.get_latest_cid()    # Get most recent CID
content = c.ipfs.cat(cid)   # Retrieve code from IPFS
```

</details>

<details>
<summary><strong>Commune Registration</strong></summary>

Register the module on-chain via commune using IPFS CIDs from `config.json`:

```python
c = Mod()
c.show_config()
cid = c.get_config_cid()
cid = c.update_config_urls(app_url="https://claude.yourapp.com", api_url="https://api.yourapp.com")
```

See [examples/commune_registration.py](examples/commune_registration.py) for a full example.

</details>

<details>
<summary><strong>File Browser with Syntax Highlighting</strong></summary>

VS Code-style file explorer built into the UI with color-coded files, syntax highlighting, and full-text search.

**Features:**
- 📁 **File Tree** — Color-coded by type (Python, JS, Rust, etc.) with expand/collapse
- 🎨 **Code Viewer** — Syntax highlighting for 20+ languages (VS Code Dark+ theme)
- 🔍 **File Search** — `Cmd+P` / `Ctrl+P` for quick file name search
- 🔎 **Content Search** — `Cmd+Shift+F` / `Ctrl+Shift+F` for grep-style full-text search
- ⌨️ **Keyboard Navigation** — Arrow keys, Enter, Esc throughout

**Usage:**

```typescript
import FileTree from "../components/FileTree";
import CodeViewer from "../components/CodeViewer";
import FileSearch from "../components/FileSearch";
import ContentSearch from "../components/ContentSearch";

<FileTree workDir="~/mod" onFileSelect={setFile} selectedFile={file} />
<CodeViewer filePath={file} workDir="~/mod" />
<FileSearch workDir="~/mod" onFileSelect={setFile} isOpen={searchOpen} onClose={close} />
<ContentSearch workDir="~/mod" onFileSelect={setFile} isOpen={grepOpen} onClose={close} />
```

**API Endpoints:**
- `GET /files/tree?path=~/mod&depth=3` — Directory tree structure
- `GET /files/content?path=~/mod/file.py` — File contents
- `GET /files/search?path=~/mod&query=test` — Search file names
- `GET /files/grep?path=~/mod&query=function&caseSensitive=false` — Search contents

See [FILE_BROWSER_GUIDE.md](./FILE_BROWSER_GUIDE.md) for complete documentation, [FILE_BROWSER_ARCHITECTURE.md](./FILE_BROWSER_ARCHITECTURE.md) for architecture details, and [examples/file-browser.tsx](./examples/file-browser.tsx) for a working example.

</details>

## Fork This Module

```bash
# CLI
m fork claude myclaude "Add GitLab integration"
```

```python
# Python
c.fork_module("myclaude", fork_source="claude", prompt="Add GitLab integration")
```

Forks include full source (Python, Rust, Next.js), all config, tests, and docs. The forked module lives in `~/mod/mod/orbit/<name>` and can be published to IPFS with `m.publish('name')`.

## Development

```bash
python -m pytest tests/              # Run tests
cd server && cargo build --release   # Build Rust server
cd app && npm run dev -- -p 8821     # Frontend dev server
```

```python
from claude import Mod
Mod.set_log_level('DEBUG')           # Enable debug logging
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
# Or: echo "sk-ant-..." > ~/.anthropic/api_key && chmod 600 ~/.anthropic/api_key
```
</details>

<details>
<summary>Job server not starting</summary>

```bash
lsof -i :8820              # Check if port is in use
pkill -f claude-jobs        # Kill existing process
./scripts/start.sh --build  # Restart with rebuild
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

## Docs

[Architecture](ARCHITECTURE.md) · [Backends](BACKENDS.md) · [Permissions & IPFS](PERMISSIONS_AND_IPFS.md) · [Module Creation](MODULE_CREATION.md) · [Examples](EXAMPLE_USAGE.md) · [Quick Ref](QUICK_REFERENCE.md) · [Wallet Guide](WALLET_GUIDE.md)

---

Part of the [Mod framework](https://github.com/modprotocol/mod).
