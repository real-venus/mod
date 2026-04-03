# Claude vs ClaudeGit Comparison

A detailed comparison between the **Claude** and **ClaudeGit** modules.

## Overview

| Aspect | Claude | ClaudeGit |
|--------|--------|-----------|
| **Purpose** | Programmable AI developer interface | Claude + GitHub integration |
| **Primary Use** | Code automation, AI development tasks | Automated code sync to GitHub |
| **Best For** | Local development, team workflows | Solo projects, auto-deployment |

## Features Comparison

### Core Features

| Feature | Claude | ClaudeGit | Notes |
|---------|:------:|:---------:|-------|
| Python SDK | ✅ | ✅ | Same API |
| AI Code Operations | ✅ | ✅ | generate_code, refactor, debug, etc. |
| Multi-Model Support | ✅ | ✅ | 200+ models via OpenRouter |
| Background Jobs | ✅ | ❌ | ClaudeGit: Python SDK only (no Rust server yet) |
| Web UI | ✅ | ❌ | Claude: 8-bit terminal UI on :8821 |
| Rust Job Server | ✅ | ❌ | Claude: Axum + SQLite + SSE streaming |
| IPFS Storage | ✅ | ✅ | Both store code to IPFS |
| Owner Access Control | ✅ | ✅ | Wallet-based permissions |

### GitHub Integration

| Feature | Claude | ClaudeGit | Notes |
|---------|:------:|:---------:|-------|
| GitHub Authentication | ❌ | ✅ | Personal Access Token |
| Auto Force Push | ❌ | ✅ | Configurable per-instance |
| Git Remote Setup | ❌ | ✅ | Automatic authenticated remote |
| Manual Push Control | ❌ | ✅ | `sync_to_github()` method |
| Multi-Repo Support | ❌ | ✅ | Multiple instances → multiple repos |
| Branch Configuration | ❌ | ✅ | Specify target branch |

### Architecture

| Component | Claude | ClaudeGit |
|-----------|--------|-----------|
| **Backend** | Rust (Axum) on :8820 | Python SDK only |
| **Frontend** | Next.js on :8821 | None (CLI/SDK only) |
| **Database** | SQLite (jobs) | None |
| **Streaming** | SSE (Server-Sent Events) | None |
| **Config Storage** | `~/.mod/claude/` | `~/.mod/claudegit/` |

## API Comparison

### Shared Methods (Same API)

Both modules provide these methods with identical signatures:

```python
# Code operations
c.analyze_code(path, focus)
c.generate_code(description, path)
c.refactor(instructions, path)
c.debug(issue_description, path)
c.edit_file(file_path, instructions)
c.run_task(task, path)
c.batch_process(tasks, model)

# AI chat
c.ask(question)
c.forward(query, path, model)

# Module management
c.create_module(name, prompt)
c.fork_module(name, fork_source, prompt)
```

### ClaudeGit-Specific Methods

```python
# GitHub integration (only in ClaudeGit)
c.configure_github(token, repo, branch, auto_push)
c.git_force_push(path, branch, commit_message)
c.git_push(path, branch)
c.sync_to_github(path, message)
```

### Claude-Specific Methods

```python
# Background jobs (only in Claude with Rust server)
c.submit(prompt, model, work_dir)
c.jobs()
c.cancel(job_id)
c.tail(job_id)
```

## Use Cases

### When to Use Claude

✅ **Use Claude when:**
- You need a **web UI** for job management
- You want **background jobs** with streaming output
- You need **team collaboration** via web dashboard
- You want **SSE streaming** for real-time feedback
- You need **job history and management**
- You prefer a **full-stack application** (Rust + Next.js)

**Example: Team Development**
```python
# Submit job via web UI at localhost:8821
# Multiple team members can view progress
# Jobs run in background with streaming logs
```

### When to Use ClaudeGit

✅ **Use ClaudeGit when:**
- You need **automatic GitHub sync**
- You want **force push** after every change
- You're working on a **solo project**
- You want **automated deployments**
- You need **multi-repo development**
- You prefer a **lightweight Python SDK**

**Example: Automated Development**
```python
from claudegit import Mod

c = Mod(
    github_repo='myorg/myapp',
    github_branch='claudegit-auto',
    auto_push=True
)

# Every change automatically pushed to GitHub
c.generate_code("Add user model")
c.generate_code("Add CRUD endpoints")
c.refactor("Add async/await")

# All changes are on GitHub in claudegit-auto branch
```

## Configuration Comparison

### Claude Configuration

```bash
# Environment variables
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
CLAUDE_JOBS_LOCAL=1  # Disable auth

# Config files
~/.mod/claude/
├── owner.json          # Owner address
├── cid_history.json    # IPFS history
└── config_cid.json     # Config IPFS CID

# Project config
~/mod/mod/orbit/claude/config.json  # Module metadata
```

### ClaudeGit Configuration

```bash
# Environment variables
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
GITHUB_TOKEN=ghp_...    # GitHub token
GITHUB_REPO=user/repo   # Target repo

# Config files
~/.mod/claudegit/
├── github.json         # GitHub config (chmod 600)
├── owner.json          # Owner address
└── cid_history.json    # IPFS history

# Project config
~/mod/mod/orbit/claudegit/config.json  # Module metadata
```

## Workflow Comparison

### Claude Workflow

1. Start servers: `./scripts/start.sh`
2. Open web UI: http://localhost:8821
3. Submit job via UI or SDK
4. View streaming logs in web UI
5. Manage jobs (cancel, delete, filter)
6. Changes stored locally + IPFS

**Pros:**
- Visual feedback
- Team collaboration
- Job management
- Background processing

**Cons:**
- Requires running servers
- More complex setup
- No GitHub auto-sync

### ClaudeGit Workflow

1. Configure GitHub: `export GITHUB_TOKEN=...`
2. Initialize: `c = Mod(auto_push=True)`
3. Make changes: `c.generate_code(...)`
4. Auto-pushed to GitHub
5. Review via GitHub web UI or CLI

**Pros:**
- Lightweight (Python only)
- Automatic GitHub sync
- Simple setup
- Multi-repo support

**Cons:**
- No web UI
- No background jobs
- Force push risks
- Solo-focused

## Performance

| Metric | Claude | ClaudeGit |
|--------|--------|-----------|
| **Startup Time** | ~3-5s (Rust + Next.js) | ~0.5s (Python only) |
| **Memory Usage** | ~200-300MB (servers) | ~50-100MB (SDK) |
| **CPU Usage** | Medium (background jobs) | Low (synchronous) |
| **Network** | Local + IPFS | Local + IPFS + GitHub |

## Migration Guide

### Claude → ClaudeGit

```python
# Before (Claude)
from claude import Mod
c = Mod()
c.generate_code("Add feature")
# Changes stored locally

# After (ClaudeGit)
from claudegit import Mod
c = Mod(
    github_repo='user/repo',
    auto_push=True
)
c.generate_code("Add feature")
# Changes stored locally + GitHub
```

### ClaudeGit → Claude

```python
# Before (ClaudeGit)
from claudegit import Mod
c = Mod(auto_push=True)
c.generate_code("Add feature")
# Auto-pushed to GitHub

# After (Claude)
from claude import Mod
c = Mod()
c.generate_code("Add feature")
# Stored locally, manual git workflow
```

## Pros and Cons

### Claude

**Pros:**
- ✅ Full-stack application (Rust + Next.js)
- ✅ Web UI for job management
- ✅ Background jobs with streaming
- ✅ Team collaboration
- ✅ Job history and management
- ✅ SSE streaming for real-time feedback

**Cons:**
- ❌ More complex setup (multiple servers)
- ❌ No GitHub integration
- ❌ Manual git workflow required
- ❌ Higher resource usage

### ClaudeGit

**Pros:**
- ✅ Automatic GitHub sync
- ✅ Lightweight (Python SDK only)
- ✅ Simple setup
- ✅ Multi-repo support
- ✅ Configurable auto-push
- ✅ Low resource usage

**Cons:**
- ❌ No web UI
- ❌ No background jobs
- ❌ Force push risks
- ❌ Solo-focused (not team-oriented)
- ❌ No streaming feedback

## Recommendations

### Use Both Together

You can use both modules in different contexts:

```python
# Local development with Claude
from claude import Mod as ClaudeMod
local = ClaudeMod()
local.submit("Build feature X")  # Background job with UI

# Production deployment with ClaudeGit
from claudegit import Mod as ClaudeGitMod
deploy = ClaudeGitMod(
    github_repo='prod/app',
    github_branch='deploy',
    auto_push=True
)
deploy.generate_code("Update config")  # Auto-deployed
```

### Choose Based on Needs

| Your Need | Choose | Why |
|-----------|--------|-----|
| Team development | **Claude** | Web UI, collaboration |
| Solo automation | **ClaudeGit** | Auto-sync, lightweight |
| Complex workflows | **Claude** | Background jobs, management |
| Quick deployments | **ClaudeGit** | Auto-push, simple |
| Learning/exploring | **Claude** | Visual feedback, easier |
| Production CI/CD | **ClaudeGit** | GitHub integration |

## Future Roadmap

### Planned for ClaudeGit

- [ ] Web UI (port Claude's frontend)
- [ ] Rust job server (port Claude's backend)
- [ ] GitLab/Bitbucket support
- [ ] PR creation automation
- [ ] Branch protection checks
- [ ] Commit signing (GPG)
- [ ] GitHub Actions integration

### Potential Convergence

Long-term, ClaudeGit may merge into Claude as a plugin:

```python
# Future: Claude with GitHub plugin
from claude import Mod
c = Mod(plugins=['github'])

c.configure_plugin('github', {
    'token': '...',
    'repo': '...',
    'auto_push': True
})

c.generate_code("Add feature")
# Uses Claude's UI + ClaudeGit's auto-push
```

---

## Summary

**Claude** = Full-featured AI development platform
**ClaudeGit** = Lightweight GitHub automation layer

Choose based on your workflow and collaboration needs!
