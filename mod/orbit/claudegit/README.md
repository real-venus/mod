# ClaudeGit Mod

<div align="center">

**Claude Code + GitHub Integration**

Programmable AI developer interface with automatic GitHub sync

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)

```
╔══════════════════════════════════════════════════════════╗
║              █  CLAUDEGIT  v1  █                        ║
║         « AI Code Generation • Auto GitHub Sync »       ║
╚══════════════════════════════════════════════════════════╝
```

</div>

**ClaudeGit** extends the Claude Mod with **GitHub authentication** and **automatic force push** capabilities. Every code change made by Claude is automatically synced to your GitHub repository.

## Features

- 🐍 **Python SDK** — All Claude Code capabilities (code analysis, generation, refactoring, debugging)
- 🔐 **GitHub Authentication** — Built-in GitHub Personal Access Token support
- 🚀 **Auto Force Push** — Automatically force pushes changes to GitHub after every operation
- 📦 **Git Integration** — Seamless git remote configuration with authentication
- ⚙️ **Configurable** — Control auto-push behavior, branch, and repository settings
- 🔒 **Owner-Based Access Control** — Restrict code edits to specific wallet addresses
- 🤖 **Multi-Model Support** — Access 200+ models via OpenRouter (Claude, GPT, Llama, etc.)

## Quick Start

### Installation

```bash
# Clone or navigate to the module
cd ~/mod/mod/orbit/claudegit

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Set your GitHub credentials as environment variables:

```bash
export GITHUB_TOKEN=ghp_your_token_here
export GITHUB_REPO=username/repo-name
```

Or configure programmatically:

```python
from claudegit import Mod

c = Mod()
c.configure_github(
    token='ghp_your_token_here',
    repo='username/repo-name',
    branch='main',
    auto_push=True
)
```

**Get a GitHub Personal Access Token:**
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope (full control of private repositories)
3. Copy the token (starts with `ghp_`)

## Usage

### Basic Operations with Auto-Push

```python
from claudegit import Mod

c = Mod(
    github_token='ghp_your_token_here',
    github_repo='username/repo-name',
    github_branch='main',
    auto_push=True  # Automatically force push after every operation
)

# All operations automatically push to GitHub when auto_push=True
c.generate_code("Create a FastAPI endpoint", path="/my/project")
# → Generates code + force pushes to GitHub

c.refactor("Use async/await", path="/my/project")
# → Refactors code + force pushes to GitHub

c.edit_file("api.py", "Add error handling")
# → Edits file + force pushes to GitHub
```

### Manual GitHub Sync

```python
# Disable auto-push for manual control
c = Mod(auto_push=False)

# Make multiple changes
c.generate_code("Add user model")
c.generate_code("Add auth endpoints")
c.refactor("Extract validation")

# Then manually sync all changes at once
result = c.sync_to_github(message="Add user auth system")
print(result)
# → {'success': True, 'repo': 'username/repo', 'branch': 'main', ...}
```

### Force Push vs Regular Push

```python
# Force push (overwrites remote)
c.git_force_push(
    path="/my/project",
    branch="main",
    commit_message="ClaudeGit: refactored auth system"
)

# Regular push (non-force, will fail if remote has diverged)
c.git_push(path="/my/project", branch="main")
```

### Configure GitHub Settings

```python
# View current configuration
config = c.configure_github()
print(config)
# → {'token_set': True, 'repo': 'username/repo', 'branch': 'main', 'auto_push': True}

# Update settings
c.configure_github(
    branch='dev',
    auto_push=False
)
```

### All Claude Code Features

ClaudeGit inherits all Claude Mod capabilities:

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

# AI chat
c.ask("Explain this error: TypeError on line 42")
```

## Configuration Files

ClaudeGit stores configuration in `~/.mod/claudegit/`:

```
~/.mod/claudegit/
├── github.json         # GitHub token, repo, branch, auto_push (chmod 600)
├── owner.json          # Owner address for access control
└── cid_history.json    # IPFS CID history
```

### github.json

```json
{
  "token": "ghp_...",
  "repo": "username/repo-name",
  "branch": "main",
  "auto_push": true
}
```

**Security:** This file is automatically set to `chmod 600` (owner read/write only) since it contains your GitHub token.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes* |
| `GH_TOKEN` | Alternative to GITHUB_TOKEN | Yes* |
| `GITHUB_REPO` | Repository (username/repo or full URL) | Yes* |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional for Claude Max users) | No |
| `OPENROUTER_API_KEY` | OpenRouter key for 200+ models | No |

\* Can be set via environment variables OR `configure_github()` method

## How It Works

1. **Initialize:** ClaudeGit loads GitHub config from `~/.mod/claudegit/github.json` or environment variables
2. **Setup Remote:** Automatically configures git remote with authenticated URL (`https://TOKEN@github.com/user/repo.git`)
3. **Make Changes:** Claude Code operations modify files in your project
4. **Auto-Push:** If `auto_push=True`, automatically:
   - Stages all changes (`git add -A`)
   - Creates commit with timestamp
   - Force pushes to configured branch (`git push -f origin HEAD:branch`)
5. **Manual Push:** If `auto_push=False`, call `sync_to_github()` or `git_force_push()` manually

## Security Considerations

⚠️ **Force Push Warning:** ClaudeGit uses `git push -f` (force push) by default. This will **overwrite** the remote branch history. Use with caution, especially on shared branches.

**Best Practices:**
- Use a dedicated branch for ClaudeGit (not `main`)
- Review changes before enabling `auto_push`
- Keep your GitHub token secure (never commit it to repos)
- Use fine-grained tokens with minimal required permissions
- Consider using a separate GitHub account/organization for ClaudeGit repos

## Examples

### Example 1: Automated Development Workflow

```python
from claudegit import Mod

# Initialize with auto-push to dev branch
c = Mod(
    github_repo='myorg/my-app',
    github_branch='claudegit-dev',
    auto_push=True
)

# Build features - each operation auto-pushes
c.generate_code("Create User model with SQLAlchemy")
c.generate_code("Add CRUD endpoints for User")
c.generate_code("Add JWT authentication middleware")
c.refactor("Extract database session management")
c.run_task("Add docstrings and type hints")

# All changes are now on GitHub in the claudegit-dev branch
```

### Example 2: Batch Changes with Manual Push

```python
c = Mod(auto_push=False)

# Make multiple changes without pushing
tasks = [
    "Add logging to all API endpoints",
    "Add error handling for database operations",
    "Add input validation with Pydantic",
    "Add unit tests for auth endpoints"
]

for task in tasks:
    c.run_task(task, path="/my/project")

# Review changes locally
# git diff

# Then push all at once
c.sync_to_github(message="Add logging, error handling, validation, and tests")
```

### Example 3: Multi-Repo Development

```python
# Work on frontend repo
frontend = Mod(
    github_repo='myorg/frontend',
    github_branch='feature-dashboard',
    default_path='/projects/frontend'
)

frontend.generate_code("Create dashboard component with charts")

# Work on backend repo
backend = Mod(
    github_repo='myorg/backend',
    github_branch='feature-analytics',
    default_path='/projects/backend'
)

backend.generate_code("Add analytics endpoints")

# Both repos are automatically synced to their respective branches
```

## Troubleshooting

### ❌ "GitHub token and repo must be configured"

Set environment variables or use `configure_github()`:

```bash
export GITHUB_TOKEN=ghp_...
export GITHUB_REPO=username/repo
```

Or:

```python
c.configure_github(token='ghp_...', repo='username/repo')
```

### ❌ "Authentication failed"

Check your token:
- Token must have `repo` scope
- Token must not be expired
- Token must have access to the repository

### ❌ "Push rejected"

If regular push fails due to diverged history, use force push:

```python
c.git_force_push()  # This will overwrite remote
```

### ❌ "Claude CLI not found"

Install Claude CLI:

```bash
brew install anthropics/claude/claude
claude --version
```

## Comparison with Claude Mod

| Feature | Claude Mod | ClaudeGit Mod |
|---------|------------|---------------|
| AI Code Operations | ✅ | ✅ |
| Python SDK | ✅ | ✅ |
| Web UI | ✅ | ❌ (coming soon) |
| Rust Job Server | ✅ | ❌ (coming soon) |
| GitHub Auth | ❌ | ✅ |
| Auto Force Push | ❌ | ✅ |
| Git Integration | ❌ | ✅ |
| IPFS Storage | ✅ | ✅ |

## License

Part of the [Mod framework](https://github.com/modprotocol/mod) ecosystem.

---

<div align="center">

**Built for autonomous development with GitHub integration**

[Quick Start](#quick-start) • [Usage](#usage) • [Configuration](#configuration) • [Examples](#examples)

</div>
