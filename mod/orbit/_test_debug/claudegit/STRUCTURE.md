# ClaudeGit Module Structure

Complete directory structure and file descriptions for the ClaudeGit module.

## Directory Tree

```
claudegit/
├── claudegit/                  # Main Python package
│   ├── __init__.py            # Package exports
│   └── claudegit.py           # Core ClaudeGit class (~700 lines)
├── examples/                   # Usage examples
│   └── basic_usage.py         # Basic usage demonstrations
├── scripts/                    # Helper scripts
│   └── install.sh             # Installation script
├── tests/                      # Test suite
│   └── test_claudegit.py      # Unit tests
├── .gitignore                  # Git ignore patterns
├── COMPARISON.md               # Claude vs ClaudeGit comparison
├── config.json                 # Module metadata (commune registration)
├── demo.py                     # Interactive demo script
├── INSTALLATION.md             # Installation guide
├── QUICKSTART.md               # 5-minute quick start
├── README.md                   # Main documentation (580+ lines)
├── requirements.txt            # Python dependencies
├── SECURITY.md                 # Security guidelines
├── setup.py                    # Python package setup
└── STRUCTURE.md                # This file
```

## File Descriptions

### Core Module

#### `claudegit/claudegit.py`
**Lines:** ~700  
**Description:** Main ClaudeGit class with GitHub integration  
**Key Features:**
- Extends Claude Code with GitHub authentication
- Automatic force push after operations
- Git remote configuration with token auth
- Multi-repo support via multiple instances
- Owner-based access control
- IPFS storage integration

**Main Methods:**
```python
# GitHub Integration
configure_github(token, repo, branch, auto_push)
git_force_push(path, branch, commit_message)
git_push(path, branch)
sync_to_github(path, message)

# Claude Code Methods (inherited)
analyze_code(path, focus)
generate_code(description, path)
refactor(instructions, path)
debug(issue_description, path)
edit_file(file_path, instructions)
run_task(task, path)
ask(question)
forward(query, path, model)
```

#### `claudegit/__init__.py`
**Lines:** 9  
**Description:** Package initialization and exports  
**Exports:** `Mod` class and version

### Documentation

#### `README.md`
**Lines:** 580+  
**Description:** Comprehensive documentation  
**Sections:**
- Features overview
- Quick start guide
- Installation instructions
- Usage examples
- Configuration guide
- API reference
- Troubleshooting
- Comparison with Claude Mod

#### `QUICKSTART.md`
**Lines:** 150+  
**Description:** Get started in 5 minutes  
**Covers:**
- Installation steps
- GitHub token generation
- Basic configuration
- First usage example
- Key concepts

#### `SECURITY.md`
**Lines:** 350+  
**Description:** Security best practices  
**Topics:**
- Force push warnings
- Token security
- Best practices checklist
- Audit trails
- Network security
- Recommended workflows

#### `INSTALLATION.md`
**Lines:** 250+  
**Description:** Detailed installation guide  
**Covers:**
- Prerequisites
- Installation methods
- Configuration steps
- Troubleshooting
- Uninstallation
- Updates

#### `COMPARISON.md`
**Lines:** 400+  
**Description:** Claude vs ClaudeGit comparison  
**Compares:**
- Feature sets
- Architecture
- API methods
- Use cases
- Performance
- Workflows
- Pros and cons

#### `STRUCTURE.md`
**Lines:** This file  
**Description:** Module structure documentation

### Configuration

#### `config.json`
**Lines:** 40+  
**Description:** Module metadata for commune registration  
**Contains:**
- Module name and version
- App and API URLs
- Available functions
- REST endpoints
- Description

#### `requirements.txt`
**Lines:** 10  
**Description:** Python dependencies  
**Dependencies:**
- graphene (GraphQL)
- graphql-core
- graphql-relay
- gql
- requests_toolbelt
- PyGithub (GitHub API)
- gitpython (Git operations)

#### `setup.py`
**Lines:** 60  
**Description:** Python package setup configuration  
**Defines:**
- Package metadata
- Dependencies
- Entry points
- Classifiers

#### `.gitignore`
**Lines:** 50+  
**Description:** Git ignore patterns  
**Ignores:**
- Python cache files
- Virtual environments
- Config files with tokens
- IDE files
- OS files

### Scripts

#### `demo.py`
**Lines:** 300+  
**Description:** Interactive demo script  
**Demonstrates:**
- Initialization
- GitHub configuration
- Owner control
- Available methods
- Auto-push behavior
- Recommended workflow
- Security tips

#### `scripts/install.sh`
**Lines:** 80  
**Description:** Automated installation script  
**Features:**
- Prerequisite checks
- Dependency installation
- Configuration guidance
- Pretty output with colors

#### `examples/basic_usage.py`
**Lines:** 200+  
**Description:** Basic usage examples  
**Examples:**
- GitHub configuration
- Auto-push mode
- Manual push mode
- Force push operations
- Multi-repo development

### Tests

#### `tests/test_claudegit.py`
**Lines:** 150+  
**Description:** Unit test suite  
**Test Classes:**
- TestClaudeGitInit: Initialization tests
- TestGitHubConfiguration: Configuration tests
- TestOwnerManagement: Owner control tests
- TestGitHubPush: Push operation tests

## Configuration Files

ClaudeGit stores runtime configuration in `~/.mod/claudegit/`:

```
~/.mod/claudegit/
├── github.json         # GitHub token, repo, branch, auto_push (chmod 600)
├── owner.json          # Owner wallet address
└── cid_history.json    # IPFS CID version history
```

### `github.json`
**Security:** `chmod 600` (owner read/write only)  
**Contents:**
```json
{
  "token": "ghp_...",
  "repo": "username/repo",
  "branch": "main",
  "auto_push": true
}
```

### `owner.json`
**Contents:**
```json
{
  "owner": "0x1234567890abcdef..."
}
```

### `cid_history.json`
**Contents:**
```json
[
  {
    "cid": "Qm...",
    "timestamp": 1234567890,
    "description": "..."
  }
]
```

## Module Size

| Component | Files | Lines | Size |
|-----------|-------|-------|------|
| Core Code | 2 | ~710 | ~25KB |
| Documentation | 6 | ~2000 | ~65KB |
| Examples | 1 | ~200 | ~7KB |
| Tests | 1 | ~150 | ~5KB |
| Scripts | 1 | ~80 | ~3KB |
| Config | 4 | ~150 | ~5KB |
| **Total** | **15** | **~3300** | **~110KB** |

## Dependencies

### Direct Dependencies
- `graphene` - GraphQL framework
- `graphql-core` - GraphQL implementation
- `graphql-relay` - Relay support
- `gql` - GraphQL client
- `requests_toolbelt` - HTTP utilities
- `PyGithub` - GitHub API wrapper
- `gitpython` - Git operations

### Indirect Dependencies
- `mod` - Mod framework (parent)
- `claude` - Claude module (functions)
- `ipfs` - IPFS storage
- Standard library (subprocess, json, os, logging, pathlib, typing)

## API Surface

### Public Classes
- `Mod` - Main ClaudeGit class

### Public Methods (18)
- `configure_github()` - Configure GitHub settings
- `git_force_push()` - Force push to GitHub
- `git_push()` - Regular push to GitHub
- `sync_to_github()` - Sync to GitHub (alias)
- `set_owner()` - Set owner address
- `analyze_code()` - Analyze code
- `generate_code()` - Generate code
- `refactor()` - Refactor code
- `debug()` - Debug code
- `edit_file()` - Edit file
- `run_task()` - Run custom task
- `ask()` - Ask Claude
- `forward()` - Forward query
- `batch_process()` - Batch processing
- `create_module()` - Create module
- `fork_module()` - Fork module
- `set_log_level()` - Set logging level (static)

### Configuration Properties
- `github_token` - GitHub token
- `github_repo` - Repository name
- `github_branch` - Target branch
- `auto_push` - Auto-push flag
- `owner` - Owner address
- `default_path` - Default working directory
- `model` - AI model name

## File Permissions

| File/Directory | Permissions | Owner | Notes |
|----------------|-------------|-------|-------|
| `*.py` | 755 (rwxr-xr-x) | user | Executable scripts |
| `*.md` | 644 (rw-r--r--) | user | Documentation |
| `*.json` | 644 (rw-r--r--) | user | Config files |
| `*.sh` | 755 (rwxr-xr-x) | user | Shell scripts |
| `~/.mod/claudegit/github.json` | 600 (rw-------) | user | Contains token! |
| `~/.mod/claudegit/owner.json` | 644 (rw-r--r--) | user | Owner address |

## Version Control

### Tracked Files
- All source code (`.py`)
- All documentation (`.md`)
- Configuration templates (`config.json`, `requirements.txt`, `setup.py`)
- Scripts (`.sh`)

### Ignored Files (via .gitignore)
- `__pycache__/` - Python cache
- `*.pyc` - Compiled Python
- `venv/`, `env/` - Virtual environments
- `.DS_Store` - macOS metadata
- `github.json`, `owner.json` - User config with secrets
- `cid_history.json` - IPFS history

## Entry Points

### Command Line
```bash
# Via script
python3 demo.py

# Via module
python3 -m claudegit

# Via installed package
claudegit  # (after pip install)
```

### Python Import
```python
# Import module
from claudegit import Mod

# Initialize
c = Mod()

# Use methods
c.configure_github(...)
c.generate_code(...)
```

## Module Integration

### Mod Framework Integration
```python
# Via mod framework
import mod as m

# Load claudegit module
claudegit = m.mod('claudegit')

# Use via function routing
result = m.fn('claudegit/generate_code')('Add feature', '/path')
```

### Standalone Usage
```python
# Standalone (no mod framework required)
from claudegit import Mod

c = Mod()
c.generate_code('Add feature')
```

## Future Structure (Planned)

```
claudegit/
├── claudegit/
│   ├── __init__.py
│   ├── claudegit.py
│   └── backends/           # Future: Backend integrations
│       ├── github.py       # GitHub (current)
│       ├── gitlab.py       # GitLab support
│       └── bitbucket.py    # Bitbucket support
├── server/                 # Future: Rust job server
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── api.rs
│       └── jobs.rs
├── app/                    # Future: Next.js UI
│   ├── package.json
│   └── src/
│       └── app/
└── ...
```

---

**Last Updated:** 2026-03-22  
**Version:** 1.0.0  
**Total Files:** 15  
**Total Lines:** ~3,300  
**Total Size:** ~110KB
