# GitBot Usage Guide 📖

Complete reference for using GitBot to create PRs with your signature vibes.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Core Concepts](#core-concepts)
- [Basic Workflows](#basic-workflows)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Overview

GitBot allows you to:
1. **Sign in to GitHub** - Secure token-based authentication
2. **Create PRs to any repo** - Automated pull request creation
3. **Maintain your vibes** - Consistent signature style across all PRs

## Setup

### 1. Install

```bash
cd /Users/broski/mod/mod/orbit/gitbot
pip install -r requirements.txt
```

### 2. Authenticate

**Option A: Interactive Setup**
```python
from gitbot.mod import setup_github_token
bot = setup_github_token()
```

**Option B: Direct Auth**
```python
import mod as m

bot = m.mod('gitbot')()
bot.auth(token='ghp_your_github_token')
```

**Option C: Environment Variable**
```bash
export GITHUB_TOKEN=ghp_your_token
```
```python
import os
bot = m.mod('gitbot')(token=os.getenv('GITHUB_TOKEN'))
```

### 3. Configure Your Vibes

```python
my_vibes = {
    "commit_style": "short",      # or "conventional", "descriptive"
    "tone": "casual",             # or "professional", "technical"
    "emoji_preference": True,     # auto-add contextual emojis
    "sign_off": "✨ Made with mod framework"
}

bot.save_vibes(my_vibes)
```

## Core Concepts

### Vibes

Your "vibes" are your signature style:

- **commit_style**: How you write commit messages
- **tone**: Communication style
- **emoji_preference**: Auto-add emojis (🐛 for fixes, ✨ for features)
- **sign_off**: Your signature footer

Vibes are automatically applied to all commits and PRs.

### Workflow Pattern

Standard workflow for creating PRs:

```
1. Fork repo (if needed)
2. Create branch
3. Commit changes
4. Create PR
```

## Basic Workflows

### Workflow 1: PR to Your Own Repo

```python
import mod as m

bot = m.mod('gitbot')()

# Create branch
bot.create_branch(
    repo="yourusername/your-repo",
    branch_name="feature/new-feature",
    from_branch="main"
)

# Commit changes
bot.commit_file(
    repo="yourusername/your-repo",
    path="src/feature.js",
    content="// New feature code",
    message="Add new feature",
    branch="feature/new-feature"
)

# Create PR
pr = bot.create_pr(
    repo="yourusername/your-repo",
    title="✨ Add new feature",
    body="Implements the new feature",
    head="feature/new-feature",
    base="main"
)

print(pr['pr_url'])
```

### Workflow 2: PR to External Repo (Fork First)

```python
import mod as m

bot = m.mod('gitbot')()
target = "owner/repo"

# 1. Fork
fork = bot.fork_repo(target)
my_fork = fork['full_name']

# 2. Create branch in fork
bot.create_branch(
    repo=my_fork,
    branch_name="fix/bug-fix",
    from_branch="main"
)

# 3. Make changes
bot.commit_file(
    repo=my_fork,
    path="file.js",
    content="// Fixed code",
    message="Fix bug",
    branch="fix/bug-fix"
)

# 4. PR to original repo
my_username = my_fork.split('/')[0]
pr = bot.create_pr(
    repo=target,
    title="🐛 Fix critical bug",
    body="Fixes the bug",
    head=f"{my_username}:fix/bug-fix",
    base="main"
)

print(pr['pr_url'])
```

### Workflow 3: Update Existing File

```python
import mod as m
import json

bot = m.mod('gitbot')()

# Get current file
file = bot.get_file(
    repo="owner/repo",
    path="package.json"
)

# Modify
package = json.loads(file['content'])
package['version'] = '2.0.0'

# Create branch
bot.create_branch(
    repo="owner/repo",
    branch_name="chore/version-bump",
    from_branch="main"
)

# Commit update (need SHA!)
bot.commit_file(
    repo="owner/repo",
    path="package.json",
    content=json.dumps(package, indent=2),
    message="Bump version",
    branch="chore/version-bump",
    sha=file['sha']  # Important for updates
)

# Create PR
pr = bot.create_pr(
    repo="owner/repo",
    title="🔖 Version 2.0.0",
    body="Bump version for release",
    head="chore/version-bump",
    base="main"
)
```

## Advanced Usage

### Batch Operations

Update multiple repos at once:

```python
import mod as m

bot = m.mod('gitbot')()

repos = ["org/repo1", "org/repo2", "org/repo3"]

for repo in repos:
    # Create branch
    bot.create_branch(
        repo=repo,
        branch_name="docs/update",
        from_branch="main"
    )

    # Add file
    bot.commit_file(
        repo=repo,
        path="CONTRIBUTING.md",
        content="# Contributing\n...",
        message="Add contributing guide",
        branch="docs/update"
    )

    # Create PR
    pr = bot.create_pr(
        repo=repo,
        title="📝 Add contributing guide",
        body="Adds CONTRIBUTING.md",
        head="docs/update",
        base="main"
    )

    print(f"{repo}: {pr['pr_url']}")
```

### Dynamic Content

Generate PR content dynamically:

```python
import mod as m
from datetime import datetime

bot = m.mod('gitbot')()

# Generate changelog entry
version = "2.1.0"
date = datetime.now().strftime("%Y-%m-%d")

changelog = f"""# Changelog

## [{version}] - {date}

### Added
- New authentication system
- API rate limiting

### Fixed
- Memory leak in cache
- Timezone handling

### Changed
- Updated dependencies
"""

# Commit and create PR
bot.create_branch(
    repo="owner/repo",
    branch_name=f"docs/changelog-{version}",
    from_branch="main"
)

# Get existing changelog
file = bot.get_file(repo="owner/repo", path="CHANGELOG.md")

# Prepend new entry
updated = changelog + "\n" + file['content']

bot.commit_file(
    repo="owner/repo",
    path="CHANGELOG.md",
    content=updated,
    message=f"Update changelog for {version}",
    branch=f"docs/changelog-{version}",
    sha=file['sha']
)

pr = bot.create_pr(
    repo="owner/repo",
    title=f"📝 Changelog for v{version}",
    body=f"Updates CHANGELOG.md for version {version}",
    head=f"docs/changelog-{version}",
    base="main"
)
```

### Integration with Mod Framework

Use GitBot with other mod modules:

```python
import mod as m

# Use GitBot with mod's AI
bot = m.mod('gitbot')()

# Generate commit message with AI
diff = "Added new authentication method"
commit_msg = m.ask(f"Write a short commit message for: {diff}")

# Use in GitBot
bot.commit_file(
    repo="owner/repo",
    path="auth.js",
    content="// auth code",
    message=commit_msg,
    branch="feature/auth"
)
```

## Best Practices

### 1. Use Descriptive Branch Names

```python
# Good
"feature/user-authentication"
"fix/memory-leak-in-cache"
"docs/api-documentation"

# Bad
"branch1"
"test"
"fix"
```

### 2. Write Clear PR Titles

```python
# Good
"🔒 Add JWT authentication"
"🐛 Fix memory leak in cache module"
"📝 Update API documentation"

# Bad
"Update"
"Fix stuff"
"Changes"
```

### 3. Include Context in PR Body

```python
pr = bot.create_pr(
    repo="owner/repo",
    title="Add authentication",
    body="""
## Summary
Adds JWT-based authentication to the API.

## Changes
- New auth middleware
- JWT token generation
- Token validation

## Testing
- [x] Unit tests pass
- [x] Manual testing complete
- [x] Documentation updated

## Breaking Changes
None

## Related Issues
Closes #123
    """
)
```

### 4. Always Get SHA When Updating Files

```python
# CORRECT
file = bot.get_file(repo="owner/repo", path="file.txt")
bot.commit_file(
    repo="owner/repo",
    path="file.txt",
    content="updated",
    message="update",
    branch="main",
    sha=file['sha']  # Required!
)

# WRONG - Will fail
bot.commit_file(
    repo="owner/repo",
    path="file.txt",
    content="updated",
    message="update",
    branch="main"
    # Missing sha!
)
```

### 5. Handle Errors Gracefully

```python
result = bot.create_pr(...)

if result['status'] == 'success':
    print(f"PR created: {result['pr_url']}")
else:
    print(f"Error: {result.get('message')}")
    # Handle error appropriately
```

### 6. Use Draft PRs for WIP

```python
pr = bot.create_pr(
    repo="owner/repo",
    title="WIP: New feature",
    body="Work in progress",
    head="feature/wip",
    base="main",
    draft=True  # Mark as draft
)
```

## API Reference

### Authentication

#### `auth(token: str) -> Dict`
Authenticate with GitHub token.

**Returns:**
```python
{
    "status": "success",
    "user": "username",
    "name": "Full Name",
    "email": "email@example.com"
}
```

#### `get_user() -> Dict`
Get current user info.

### Repository Operations

#### `fork_repo(repo: str) -> Dict`
Fork a repository.

**Parameters:**
- `repo`: Repository in format "owner/repo"

**Returns:**
```python
{
    "status": "success",
    "fork_url": "https://github.com/youruser/repo",
    "full_name": "youruser/repo"
}
```

#### `create_branch(repo, branch_name, from_branch="main") -> Dict`
Create a new branch.

#### `list_prs(repo, state="open") -> Dict`
List pull requests.

**Parameters:**
- `state`: "open", "closed", or "all"

### File Operations

#### `commit_file(repo, path, content, message, branch, sha=None) -> Dict`
Create or update a file.

**Important:** When updating an existing file, you MUST provide the `sha` parameter. Get it via `get_file()`.

#### `get_file(repo, path, branch="main") -> Dict`
Get file content and metadata.

**Returns:**
```python
{
    "status": "success",
    "content": "file content",
    "sha": "abc123...",  # Use this when updating
    "path": "path/to/file"
}
```

### PR Operations

#### `create_pr(repo, title, body, head, base="main", draft=False) -> Dict`
Create a pull request.

**Parameters:**
- `head`: For your repo: `"branch-name"`, for forks: `"username:branch-name"`
- `draft`: Set to `True` for draft PR

**Returns:**
```python
{
    "status": "success",
    "pr_number": 123,
    "pr_url": "https://github.com/owner/repo/pull/123",
    "state": "open",
    "title": "PR title"
}
```

### Configuration

#### `save_vibes(vibes: Dict) -> Dict`
Save your signature style.

#### `load_vibes() -> Dict`
Load saved vibes.

## Troubleshooting

### "Invalid token"
- Check token starts with `ghp_`
- Verify token has `repo` scope
- Token may be expired

### "Reference already exists"
- Branch name already exists
- Use unique branch name or delete old branch

### "SHA mismatch"
- Always get latest SHA with `get_file()`
- Use that SHA when updating file

### "Permission denied"
- Token needs more scopes
- You may not have write access to repo

### "Rate limit exceeded"
- GitHub API has rate limits
- Add delays between operations
- Wait for limit to reset

## Examples

See [examples.py](examples.py) for complete working examples:

```bash
python examples.py
```

## Resources

- 📘 [README](README.md) - Full documentation
- 🎓 [TUTORIAL](TUTORIAL.md) - Step-by-step guide
- ⚡ [QUICKSTART](QUICKSTART.md) - Get started in 5 minutes
- 🔑 [GitHub Tokens](https://github.com/settings/tokens) - Create token

---

**Questions?** Check the [TUTORIAL.md](TUTORIAL.md) or [examples.py](examples.py)

**Ready to automate?** Start with [QUICKSTART.md](QUICKSTART.md)
