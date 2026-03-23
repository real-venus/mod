# Claude Mod

<div align="center">

**Programmable AI developer interface**

Python SDK • Rust Job Server • 8-Bit Terminal UI

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Rust 1.70+](https://img.shields.io/badge/rust-1.70+-orange.svg)](https://www.rust-lang.org)
[![Next.js 14](https://img.shields.io/badge/next.js-14-black.svg)](https://nextjs.org)

```
╔══════════════════════════════════════════════════════════╗
║              █  J O B   R U N N E R  v1  █              ║
║         « Background AI Tasks • 8-Bit Terminal »        ║
╚══════════════════════════════════════════════════════════╝
```

</div>

**Claude Mod** provides a programmable interface to Claude Code for autonomous development workflows.

**Three ways to use it:**
- 🐍 **Python SDK** — Script and automate code tasks
- 🖥️ **Web UI** — Retro terminal interface with 6 themes
- 🚀 **Background Jobs** — Long-running autonomous tasks

## Features

- 🐍 **Python SDK** — Type-safe API for code analysis, generation, refactoring, debugging
- ⚙️ **Rust Job Engine** — Axum HTTP server with SQLite, SSE streaming, wallet auth
- 🖥️ **8-Bit Terminal UI** — Next.js dashboard with CRT aesthetic, 6 themes, image paste support
- 🔒 **Owner-Based Access Control** — Restrict code edits to specific wallet addresses
- 📦 **IPFS Storage** — Automatic content-addressed versioning of all code changes
- 🚀 **Background Jobs** — Long-running autonomous tasks with streaming logs
- 🤖 **Multi-Model Support** — Access 200+ models via OpenRouter (Claude, GPT, Llama, etc.)
- 🔗 **Module Creation** — Generate and fork Mod framework modules programmatically

## Table of Contents

- [Quick Start](#quick-start)
  - [From GitHub](#from-github)
  - [From IPFS](#from-ipfs)
  - [Launch](#launch)
- [Usage](#usage)
  - [Web UI](#web-ui)
  - [Python SDK](#python-sdk)
  - [REST API](#rest-api)
- [Configuration](#configuration)
- [Advanced](#advanced)
  - [Architecture](#architecture)
  - [Auth](#auth)
  - [Access Control](#owner-based-access-control)
  - [IPFS Versioning](#ipfs-version-history)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Quick Start

### From GitHub

```bash
# Clone the repository
git clone https://github.com/modprotocol/mod.git
cd mod/mod/orbit/claude

# Install dependencies
pip install -r requirements.txt
cd app && npm install && cd ..
```

### From IPFS

```bash
# Get the module from IPFS (requires ipfs CLI)
ipfs get <CID> -o claude
cd claude

# Install dependencies
pip install -r requirements.txt
cd app && npm install && cd ..
```

> **Note:** The IPFS CID for the latest version is stored in the module's on-chain registry. Use `m.get_cid('claude')` to retrieve it.

### Launch

```bash
# Start everything (Rust backend on :8820, Next.js UI on :8821)
./scripts/start.sh

# Options
./scripts/start.sh --build   # Force Rust rebuild
./scripts/start.sh --prod    # Production Next.js build
```

**Open http://localhost:8821** — No wallet required in local mode (default)

✅ The start script sets `CLAUDE_JOBS_LOCAL=1` by default, skipping authentication entirely.

---

## Fork This Module

Want to customize Claude Mod for your own use case? You can fork it as a new module in the Mod framework.

### Using the Web UI

1. Open http://localhost:8821
2. Look for the **"Fork Module"** section
3. Enter your module name (e.g., `myclaude`)
4. Add your customization prompt (e.g., "Add support for GitLab integration")
5. Click **Fork** — it creates a copy in `~/mod/mod/orbit/myclaude`

### Using Python

```python
from claude import Mod

c = Mod()
c.fork_module(
    "myclaude",
    fork_source="claude",
    prompt="Add support for GitLab integration and custom themes"
)
```

### Using the Mod Framework

```bash
# From anywhere in your terminal
m fork claude myclaude "Add GitLab integration"

# Or use the interactive CLI
m
> fork claude myclaude
```

**What gets forked:**
- ✅ Full source code (Python SDK, Rust server, Next.js UI)
- ✅ All dependencies and configuration files
- ✅ Tests and documentation
- ✅ Your customizations via AI prompt

**The forked module:**
- Lives in `~/mod/mod/orbit/<your-module-name>`
- Can be published to IPFS with `m.publish('your-module-name')`
- Can be shared via GitHub, IPFS, or the on-chain registry
- Maintains its own git history and version control

---

## Usage

### Web UI

**8-bit terminal dashboard** at http://localhost:8821

**Features:**
- ✏️ **Job submission** — Describe a task, pick a model (haiku/sonnet/opus), set working directory
- 📸 **Image paste** — Paste screenshots from clipboard directly into task description
- 📦 **Module creation** — Create new orbit modules or fork existing ones
- 📡 **Live streaming** — Real-time output as Claude works (Server-Sent Events)
- 🎛️ **Job management** — Filter, cancel, delete, view full output
- 🔐 **Wallet auth** — MetaMask, SubWallet, local key, or password-derived key (optional)
- 💎 **Wallet manager** — View balance, transaction history, and token holdings ([Quick Start](WALLET_QUICKSTART.md) • [Full Guide](WALLET_GUIDE.md))
- 🎨 **Theme selector** — 6 retro themes (dark, light, matrix, cyberpunk, amber, ocean)

### Python SDK

**Import and initialize:**

```python
from claude import Mod

c = Mod()
```

**Synchronous Operations**

```python
# Code analysis
c.analyze_code(path="/project", focus="security")

# Code generation
c.generate_code(description="FastAPI auth endpoint with JWT", path="/project")

# Refactoring
c.refactor(instructions="Extract validation into decorators", path="/project")

# Debugging
c.debug(issue_description="TypeError on line 42", path="/project")

# Custom tasks
c.run_task(task="Add docstrings to all public functions", path="/project")

# Batch processing
c.batch_process(["Check SQL injection", "Find unused imports"], model="haiku")

# Raw query
c.forward(query="Explain this error", path="/project", model="sonnet")
```

**Background Jobs (No Server)**

Fire-and-forget tasks using Claude CLI directly:

```python
task = c.bg("refactor utils.py to use async", mod="core", model="sonnet")
# Returns: {'pid': 12345, 'log_file': '~/.mod/claude/logs/...'}
# Use: tail -f <log_file> to watch progress
```

**Background Jobs (Rust Server)**

Submit to the Rust job engine for managed execution with streaming:

```python
# Submit job
job = c.submit("Build React dashboard", model="sonnet", work_dir="/project")

# Manage jobs
c.tail(job['id'])       # Stream live output
c.jobs()                # List all jobs
c.cancel(job['id'])     # Cancel running job

# Create modules
c.create_module("mymod", prompt="Build a web scraper module")
c.fork_module("mymod", fork_source="claude", prompt="Add rate limiting")
```

**AI Chat**

```python
# Ask questions
response = c.ask("Explain this error: TypeError on line 42")

# List models
c.models(search="claude")  # Show Claude models only
```

### REST API

**Rust server endpoints** (port `8820`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/repos` | List git repos |
| `GET` | `/auth/challenge?address=0x...` | Get signature challenge |
| `POST` | `/auth/verify` | Verify signature → JWT token |
| `POST` | `/jobs` | Submit new job |
| `GET` | `/jobs` | List all jobs |
| `GET` | `/jobs/{id}` | Get job details |
| `DELETE` | `/jobs/{id}` | Delete job |
| `POST` | `/jobs/{id}/cancel` | Cancel running job |
| `GET` | `/jobs/{id}/stream` | SSE stream of job output |

**Example: Submit Job**

```bash
curl -X POST http://localhost:8820/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add error handling to api.py",
    "model": "sonnet",
    "work_dir": "/path/to/project",
    "images": [{"name": "screenshot.png", "data": "data:image/png;base64,..."}]
  }'
```

## Configuration

**Environment Variables**

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Anthropic API key (optional for Claude Max users) |
| `OPENROUTER_API_KEY` | — | OpenRouter key for 200+ models |
| `CLAUDE_JOBS_LOCAL` | `0` | Set to `1` to disable authentication |
| `MOD_ANCHOR` | `~/mod` | Base directory for module creation |

**Model Selection**

| Model | Speed | Best For |
|-------|-------|----------|
| `haiku` | ⚡⚡⚡ | Fast checks, linting, simple tasks |
| `sonnet` | ⚡⚡ | General development (default) |
| `opus` | ⚡ | Complex architecture, major refactors |

### Module Configuration & Commune Registration

The `config.json` file contains module metadata for **on-chain registration with commune**:

```json
{
  "name": "claude",
  "version": "1.0.0",
  "urls": {
    "app": "http://localhost:8821",
    "api": "http://localhost:8820"
  },
  "fns": ["forward", "ask", "analyze_code", ...],
  "endpoints": {"/health": "Health check", ...}
}
```

**When config.json is missing**, it's automatically created with default localhost URLs on first initialization.

**Register with Commune:**

```python
c = Mod()

# View current config and IPFS CID
c.show_config()

# Get CID for registration
cid = c.get_config_cid()
print(f"Register this CID: {cid}")

# Update URLs for production deployment
cid = c.update_config_urls(
    app_url="https://claude.yourapp.com",
    api_url="https://api.yourapp.com"
)

# Register with commune using the CID (pseudo-code)
# commune.register_module(name='claude', cid=cid, key=m.key())
```

**Benefits:**
- 🔗 Content-addressed config on IPFS
- 🌐 On-chain discoverability via commune
- 📍 URLs reference app frontend and API backend
- 🔄 Version tracking with IPFS CID updates

See [examples/commune_registration.py](examples/commune_registration.py) for full example.

## Advanced

### Architecture

```
claude/
├── claude/claude.py        # Python SDK — sync ops, background jobs, AI chat
├── server/src/             # Rust job engine — Axum HTTP + SQLite + SSE
│   ├── api.rs              # REST endpoints (port 8820)
│   ├── jobs.rs             # Job lifecycle, Claude CLI process management
│   ├── auth.rs             # Wallet signature auth (EIP-191)
│   └── main.rs             # Entry point
├── app/src/app/            # Next.js 14 — retro terminal UI
│   ├── page.tsx            # Dashboard with job management
│   └── globals.css         # 6 retro themes
├── scripts/start.sh        # One-command launcher
└── tests/                  # Python test suite
```

### Auth

**Two modes:**

- 🔓 **Local mode** (`CLAUDE_JOBS_LOCAL=1`) — No auth, all endpoints open
- 🔐 **Wallet mode** — EIP-191 signature challenge/verify → 24-hour JWT token

**Wallet options:**
- MetaMask (browser extension)
- SubWallet (browser extension)
- Local key (BIP-39 mnemonic stored in localStorage)
- Password-derived key (keccak256 hash → deterministic wallet)

### Owner-Based Access Control

**Automatic ownership on first sign-in:**

When no owner is configured, the **first person to authenticate** automatically becomes the owner:

```python
# No owner set yet
c = Mod()  # → "No owner set - first authenticated user will become owner"

# First user signs in via web UI → automatically becomes owner
# Check ownership
c.reload_owner()           # Reload from disk after auth
owner = c.get_owner()      # → "0x1234..."
```

**Manual ownership management:**

```python
c = Mod(owner="0x1234...")  # Set owner during init
c.set_owner("0x1234...")    # Or set later
c.is_owner("0x1234...")     # Check ownership
c.reload_owner()            # Reload from config file
```

**Permission levels:**
- ✏️ **Owner-only:** `refactor()`, `generate_code()`, `edit_file()`
- 👁️ **Read-only:** `analyze_code()`, `debug()`, `ask()`

**API endpoint:**
```bash
# Check owner status
curl http://localhost:8820/owner
# → {"has_owner": true, "owner": "0x...", "message": "Owner is set"}
```

See [AUTO_OWNER_SETUP.md](./AUTO_OWNER_SETUP.md) for detailed documentation.

### IPFS Version History

**All code changes** are automatically stored to IPFS:

```python
c.show_history(limit=10)   # Display recent changes with CIDs
history = c.get_history()   # Get full history as JSON
cid = c.get_latest_cid()    # Get most recent CID
content = c.ipfs.cat(cid)   # Retrieve code from IPFS
```

**Benefits:**
- 📦 Immutable storage
- 🔗 Content-addressed sharing
- 📝 Complete audit trail
- 🌐 Decentralized distribution

### File-Level Editing

**Direct file modifications** with AI assistance:

```python
c.edit_file("config.py", "Add DATABASE_URL environment variable")
c.edit_file("api/routes.py", "Add rate limiting to all endpoints")
```

## Development

**Install dependencies:**

```bash
pip install -r requirements.txt
cd app && npm install && cd ..
```

**Run tests:**

```bash
python -m pytest tests/                # All tests
python tests/test_simple.py            # Basic unit tests
python tests/test_simple.py --live     # Live API tests
```

**Build Rust server only:**

```bash
cd server && cargo build --release
```

**Frontend dev server:**

```bash
cd app && npm run dev -- -p 8821
```

**Enable debug logging:**

```python
from claude import Mod
Mod.set_log_level('DEBUG')
```

## Documentation

📚 **Detailed guides:**

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design and component overview
- [BACKENDS.md](BACKENDS.md) — Backend integration patterns
- [PERMISSIONS_AND_IPFS.md](PERMISSIONS_AND_IPFS.md) — Access control and IPFS storage
- [MODULE_CREATION.md](MODULE_CREATION.md) — Creating new orbit modules
- [EXAMPLE_USAGE.md](EXAMPLE_USAGE.md) — Real-world usage patterns
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — API cheat sheet
- [WALLET_QUICKSTART.md](WALLET_QUICKSTART.md) — Wallet manager quick start
- [WALLET_GUIDE.md](WALLET_GUIDE.md) — Complete wallet manager guide

## Troubleshooting

### ❌ Claude CLI not found

Auto-installation should handle this, but if it fails:

```bash
brew install anthropics/claude/claude
claude --version
```

### ❌ API key issues

```bash
# Set via environment variable
export ANTHROPIC_API_KEY=sk-ant-...

# Or store in file
echo "sk-ant-..." > ~/.anthropic/api_key && chmod 600 ~/.anthropic/api_key
```

### ❌ Job server not starting

```bash
# Check if port 8820 is in use
lsof -i :8820

# Kill existing process
pkill -f claude-jobs

# Restart with rebuild
./scripts/start.sh --build
```

### ❌ Permission errors

```python
# Bypass permission prompts for automation
c = Mod(bypass_permissions=True)
```

### ❌ IPFS not available

```bash
# Install IPFS (required for version history and IPFS forking)
brew install ipfs

# Initialize and start daemon
ipfs init
ipfs daemon &
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│ GETTING STARTED                                             │
├─────────────────────────────────────────────────────────────┤
│ GitHub:  git clone https://github.com/modprotocol/mod.git  │
│ IPFS:    ipfs get <CID> -o claude                           │
│ Install: pip install -r requirements.txt && cd app && npm i │
│ Launch:  ./scripts/start.sh                                 │
│ Open:    http://localhost:8821                              │
├─────────────────────────────────────────────────────────────┤
│ PYTHON SDK                                                  │
├─────────────────────────────────────────────────────────────┤
│ from claude import Mod                                      │
│ c = Mod()                                                   │
│                                                             │
│ c.generate_code("FastAPI endpoint")  # Generate code       │
│ c.refactor("Use async/await")        # Refactor            │
│ c.debug("Fix TypeError on line 42")  # Debug               │
│ c.submit("Build dashboard")          # Background job      │
│ c.ask("How does this work?")         # Ask questions       │
├─────────────────────────────────────────────────────────────┤
│ REST API (port 8820)                                        │
├─────────────────────────────────────────────────────────────┤
│ POST /jobs              Submit job                          │
│ GET  /jobs              List all jobs                       │
│ GET  /jobs/{id}/stream  Stream job output (SSE)            │
│ POST /jobs/{id}/cancel  Cancel running job                 │
├─────────────────────────────────────────────────────────────┤
│ MODELS                                                      │
├─────────────────────────────────────────────────────────────┤
│ haiku  → Fast checks, linting (⚡⚡⚡)                       │
│ sonnet → General development (⚡⚡) [default]               │
│ opus   → Complex architecture (⚡)                          │
├─────────────────────────────────────────────────────────────┤
│ FORKING                                                     │
├─────────────────────────────────────────────────────────────┤
│ Web UI:  Use "Fork Module" section at localhost:8821       │
│ Python:  c.fork_module("name", fork_source="claude")       │
│ CLI:     m fork claude myname "customization prompt"       │
└─────────────────────────────────────────────────────────────┘
```

---

## License

Part of the [Mod framework](https://github.com/modprotocol/mod) ecosystem.

---

<div align="center">

**Built for autonomous development workflows**

[Quick Start](#quick-start) • [Fork This](#fork-this-module) • [Python SDK](#python-sdk) • [Web UI](#web-ui)

</div>
