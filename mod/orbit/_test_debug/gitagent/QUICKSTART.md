# GitAgent Quickstart ⚡

Get started with GitAgent in 5 minutes.

## Install

```bash
cd /Users/broski/mod/mod/orbit/gitagent
pip install -r requirements.txt
```

## Setup

```python
import mod.core.mod as m

git = m.mod('gitagent')()

# Add your GitHub account
git.add_account(
    name="personal",
    token="ghp_your_github_token_here",
    set_default=True
)
```

## Get GitHub Token

1. Go to: https://github.com/settings/tokens/new
2. Select scopes: `repo`, `workflow`
3. Generate and copy token (starts with `ghp_`)

## Essential Commands

### Search Repos
```python
git.search_repos("language:python stars:>1000")
```

### List Your Repos
```python
git.list_my_repos()
```

### Fork a Repo
```python
git.fork_repo("owner/repo")
```

### Auto-Merge PRs from Others 🔥
```python
git.auto_merge_prs("owner/repo")
```

### List PRs
```python
git.list_prs("owner/repo")
```

### Create PR
```python
git.create_pr(
    repo="owner/repo",
    title="Add feature",
    head="your-branch",
    base="main",
    body="Description"
)
```

### Merge PR
```python
git.merge_pr("owner/repo", pr_number=123)
```

### Get File
```python
git.get_file("owner/repo", "README.md")
```

### Update File
```python
file = git.get_file("owner/repo", "README.md")

git.update_file(
    repo="owner/repo",
    path="README.md",
    content=file['content'] + "\nNew line",
    message="Update README",
    branch="main",
    sha=file['sha']
)
```

## Multi-Account

```python
# Add accounts
git.add_account("work", "ghp_work_token")
git.add_account("personal", "ghp_personal_token")

# Switch accounts
git.use_account("work")

# List accounts
git.list_accounts()
```

## Forward Function

```python
# Show all actions
git.forward("help")

# Quick actions
git.forward("search", query="language:rust")
git.forward("my_repos")
git.forward("auto_merge", repo="owner/repo")
```

## Next Steps

- Read [README.md](README.md) for full features
- See [TUTORIAL.md](TUTORIAL.md) for detailed examples
- Start automating your GitHub workflows!

---

**That's it!** You're now ready to use GitAgent. 🚀
