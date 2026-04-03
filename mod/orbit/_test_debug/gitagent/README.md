# GitAgent 🚀

> *Multi-account GitHub interface that's better than GitHub itself*

## Overview

GitAgent is a comprehensive GitHub management tool that provides a cleaner, more powerful interface than the GitHub web UI. Manage multiple GitHub accounts, automate PR workflows, search and fork repos, and integrate seamlessly with AI assistants like Claude and Codex.

## ✨ Key Features

- **🔐 Multi-Account Management**: Easily switch between multiple GitHub accounts (work, personal, bot accounts)
- **🔍 Advanced Search**: Search repos across all of GitHub with powerful filters
- **🍴 Fork & Clone**: One-command fork and clone operations
- **🔀 Smart PR Management**: Auto-merge PRs from others, create PRs with ease
- **🤖 AI Integration Ready**: Prepare repos for Claude/Codex processing
- **⚡ Better UX**: Cleaner interface than GitHub web UI
- **🎯 Workflow Automation**: Auto-accept other people's PRs, batch operations

## 🚀 Quick Start

### Installation

```bash
cd /Users/broski/mod/mod/orbit/gitagent
pip install -r requirements.txt
```

### Basic Usage

```python
import mod.core.mod as m

# Initialize GitAgent
git = m.mod('gitagent')()

# Add your GitHub account(s)
git.add_account(
    name="personal",
    token="ghp_your_github_token_here",
    set_default=True
)

git.add_account(
    name="work",
    token="ghp_work_token_here"
)

# List your accounts
git.list_accounts()

# Switch accounts
git.use_account("work")
```

## 📚 Complete Feature Guide

### 1. Account Management

#### Add Account
```python
git.add_account(
    name="personal",           # Account identifier
    token="ghp_...",          # GitHub personal access token
    set_default=True          # Set as default account
)
```

#### List All Accounts
```python
result = git.list_accounts()
# Shows: username, email, which is default, which is active
```

#### Switch Account
```python
git.use_account("work")
```

#### Remove Account
```python
git.remove_account("old-account")
```

### 2. Repository Operations

#### Search Repositories
```python
# Search by language and stars
git.search_repos(
    query="language:python stars:>1000",
    sort="stars",
    order="desc",
    per_page=30
)

# Search by topic
git.search_repos("topic:machine-learning")

# Search your org's repos
git.search_repos("org:your-org")
```

#### Get Repository Details
```python
git.get_repo("owner/repo")
# Returns: stars, forks, language, description, topics, etc.
```

#### List Your Repositories
```python
git.list_my_repos(
    type="all",        # "all", "owner", "public", "private", "member"
    sort="updated",    # "created", "updated", "pushed", "full_name"
    per_page=100
)
```

#### Fork a Repository
```python
git.fork_repo("owner/repo")
# Optional: fork to organization
git.fork_repo("owner/repo", organization="your-org")
```

### 3. Pull Request Operations

#### List Pull Requests
```python
git.list_prs(
    repo="owner/repo",
    state="open",          # "open", "closed", "all"
    sort="created",        # "created", "updated", "popularity"
    direction="desc"
)
```

#### Get PR Details
```python
git.get_pr("owner/repo", pr_number=123)
# Returns: full PR info, mergeable status, commits, changes, etc.
```

#### Create Pull Request
```python
git.create_pr(
    repo="owner/repo",
    title="Add awesome feature",
    head="your-branch",              # or "username:branch" for forks
    base="main",
    body="Description of changes",
    draft=False,
    maintainer_can_modify=True
)
```

#### Merge a Pull Request
```python
git.merge_pr(
    repo="owner/repo",
    pr_number=123,
    merge_method="merge"     # "merge", "squash", or "rebase"
)
```

#### Auto-Merge All PRs from Others (🔥 Killer Feature)
```python
# Automatically merge all mergeable PRs (skips your own PRs and drafts)
git.auto_merge_prs(
    repo="owner/repo",
    merge_method="squash",
    max_prs=10
)

# Returns detailed report:
# - Which PRs were merged
# - Which failed (and why)
# - Which were skipped (own PRs, drafts, conflicts)
```

### 4. Branch Operations

#### List Branches
```python
git.list_branches("owner/repo")
```

#### Create Branch
```python
# From default branch
git.create_branch("owner/repo", "new-feature")

# From specific branch
git.create_branch("owner/repo", "new-feature", from_branch="develop")

# From specific SHA
git.create_branch("owner/repo", "new-feature", from_sha="abc123...")
```

### 5. File Operations

#### Get File Content
```python
git.get_file(
    repo="owner/repo",
    path="src/main.py",
    branch="main"    # optional
)
```

#### Update/Create File
```python
git.update_file(
    repo="owner/repo",
    path="README.md",
    content="# New content",
    message="Update README",
    branch="main",
    sha="abc123..."    # required for updates, get from get_file()
)
```

### 6. Issues

#### List Issues
```python
git.list_issues(
    repo="owner/repo",
    state="open",
    labels=["bug", "help wanted"]
)
```

#### Create Issue
```python
git.create_issue(
    repo="owner/repo",
    title="Bug: Something is broken",
    body="Detailed description...",
    labels=["bug"],
    assignees=["username"]
)
```

### 7. AI Integration

#### Prepare Repo for Claude/Codex
```python
# Fetch all files for AI processing
files = git.prepare_for_claude("owner/repo")

# Fetch specific files
files = git.prepare_for_claude(
    "owner/repo",
    files=["src/main.py", "README.md"]
)

# Files are ready to pass to Claude for analysis/modification
```

## 🎯 Common Workflows

### 1. Fork, Modify, and Create PR
```python
# Fork the repo
fork_result = git.fork_repo("upstream/repo")

# Create a new branch
git.create_branch(
    f"{git.current_account}/repo",
    "my-feature"
)

# Make changes via file updates
git.update_file(
    f"{git.current_account}/repo",
    path="src/feature.py",
    content=new_code,
    message="Add awesome feature",
    branch="my-feature"
)

# Create PR back to upstream
git.create_pr(
    repo="upstream/repo",
    title="Add awesome feature",
    head=f"{git.current_account}:my-feature",
    base="main",
    body="This PR adds..."
)
```

### 2. Auto-Accept All External PRs
```python
# Switch to your repo's account
git.use_account("personal")

# Auto-merge all PRs from others
result = git.auto_merge_prs("personal/my-repo")

print(f"Merged: {result['summary']['total_merged']}")
print(f"Failed: {result['summary']['total_failed']}")
print(f"Skipped: {result['summary']['total_skipped']}")
```

### 3. Multi-Account Repo Management
```python
# Check work repos
git.use_account("work")
work_repos = git.list_my_repos()

# Check personal repos
git.use_account("personal")
personal_repos = git.list_my_repos()

# Search with personal account
results = git.search_repos("language:rust stars:>500")
```

### 4. Use with Claude Jobs Integration
```python
# Prepare repo files for Claude
files = git.prepare_for_claude("owner/repo")

# Pass to Claude for processing
# (Integration with claude module - extend as needed)
# claude.process_repo(files["files"])
```

## 🔑 Setting Up GitHub Token

1. Go to: https://github.com/settings/tokens/new
2. Generate a new **classic** token with these scopes:
   - ✅ `repo` (full repository access)
   - ✅ `workflow` (update GitHub Actions workflows)
   - ✅ `admin:org` (if managing org repos)
   - ✅ `delete_repo` (if you need to delete repos)
3. Copy the token (starts with `ghp_`)
4. Add to GitAgent: `git.add_account("name", "ghp_...")`

**Security**: Tokens are stored in `~/.mod/gitagent/accounts.json`. Keep this file secure!

## 📋 Forward Function Quick Reference

```python
git = m.mod('gitagent')()

# Show all available actions
git.forward("help")

# Quick actions via forward
git.forward("add_account", name="personal", token="ghp_...")
git.forward("use_account", name="work")
git.forward("search", query="language:python")
git.forward("my_repos")
git.forward("get_repo", repo="owner/repo")
git.forward("fork", repo="owner/repo")
git.forward("list_prs", repo="owner/repo")
git.forward("auto_merge", repo="owner/repo")
```

## 🏗️ Project Structure

```
gitagent/
├── gitagent/
│   └── mod.py              # GitAgent implementation
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Container orchestration
├── requirements.txt        # Python dependencies
├── README.md              # This file
└── TUTORIAL.md            # Detailed tutorial
```

## 🎨 Why GitAgent > GitHub Web UI?

1. **Multi-Account**: Switch between accounts instantly (GitHub requires logout/login)
2. **Automation**: Auto-merge PRs, batch operations, scripted workflows
3. **AI Integration**: Direct integration with Claude, Codex, and other AI tools
4. **Faster**: No page loads, instant responses, scriptable
5. **Programmatic**: Everything is code - automate your entire workflow
6. **Better Search**: More powerful filtering and search capabilities
7. **Cleaner**: No web UI clutter, just the data you need

## 🤖 AI Integration Examples

### With Claude (Future Integration)
```python
# Get repo files
files = git.prepare_for_claude("owner/repo")

# Use Claude to analyze
# response = claude.ask(f"Analyze this codebase: {files['files']}")

# Use Claude to fix issues
# fixed_code = claude.ask("Fix the bug in main.py", context=files)

# Update the repo
# git.update_file(repo, "main.py", fixed_code, "Fix bug via Claude")
```

### Workflow Ideas
- Auto-fix linting issues across all your repos
- Generate documentation automatically
- Review PRs with AI assistance
- Refactor code at scale
- Auto-respond to issues

## 🔐 Security Notes

- Tokens are stored locally in `~/.mod/gitagent/accounts.json`
- Never commit this file to git
- Use fine-grained tokens when possible
- Rotate tokens regularly
- Each account can have different permission levels

## 🚀 Advanced Features

### Rate Limiting
GitHub API has rate limits (5000 requests/hour for authenticated users). GitAgent automatically includes authentication headers to use your full quota.

### Error Handling
All methods return a consistent format:
```python
{
    "status": "success" | "error",
    "message": "...",  # on error
    # ... additional data
}
```

### Caching
Future versions will include smart caching for faster repeated operations.

## 📝 License

Open source and available for use under permissive licensing.

## 🌟 Philosophy

GitAgent is built to make GitHub interaction **faster, cleaner, and more powerful** than the web interface. It's designed for developers who:

- Manage multiple GitHub accounts
- Want to automate GitHub workflows
- Integrate GitHub with AI tools
- Prefer code over clicking
- Value speed and efficiency

---

**🚀 Ready to supercharge your GitHub workflow?**

See **[TUTORIAL.md](TUTORIAL.md)** for step-by-step examples and advanced patterns!

---

*Built with the mod framework. Made for developers who move fast.* ⚡
