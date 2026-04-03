# Getting Started with GitAgent 🚀

**Welcome!** This guide will get you up and running with GitAgent in under 10 minutes.

## What is GitAgent?

GitAgent is a **multi-account GitHub interface** that gives you superpowers:

- 🔐 Manage multiple GitHub accounts (work, personal, bots)
- 🔍 Search and discover repositories across all of GitHub
- 🍴 Fork, clone, and manage repos with ease
- 🔀 Auto-merge PRs from others (set it and forget it!)
- 🤖 AI integration ready (Claude, Codex)
- ⚡ Faster and cleaner than GitHub web UI

## Quick Install

```bash
cd /Users/broski/mod/mod/orbit/gitagent
pip install -r requirements.txt
python3 test_setup.py
```

If you see "All tests passed!" - you're ready! 🎉

## Step 1: Get a GitHub Token

1. Go to: https://github.com/settings/tokens/new
2. Name it: `GitAgent`
3. Select these scopes:
   - ✅ `repo` - Full repository access
   - ✅ `workflow` - Update workflows
4. Click "Generate token"
5. **Copy the token** (starts with `ghp_`)

⚠️ **Save it somewhere safe** - you can't see it again!

## Step 2: Add Your First Account

```python
import mod.core.mod as m

# Initialize GitAgent
git = m.mod('gitagent')()

# Add your account
git.add_account(
    name="personal",                    # Any name you want
    token="ghp_your_token_here",        # Paste your token
    set_default=True                    # Make it the default
)
```

You should see:
```json
{
    "status": "success",
    "account": "personal",
    "username": "your-github-username",
    "message": "Account 'personal' added successfully"
}
```

## Step 3: Try Your First Commands

### Search for repos
```python
results = git.search_repos("language:python stars:>1000")

print(f"Found {results['total_count']} repositories")
for repo in results['repos'][:5]:
    print(f"⭐ {repo['stars']} - {repo['full_name']}")
```

### List your repos
```python
repos = git.list_my_repos()

print(f"You have {repos['count']} repositories")
for repo in repos['repos'][:5]:
    print(f"- {repo['full_name']}")
```

### Check your PRs
```python
# Replace with your repo
prs = git.list_prs("your-username/your-repo")

print(f"Open PRs: {prs['count']}")
for pr in prs['prs']:
    print(f"#{pr['number']}: {pr['title']}")
```

## Step 4: Try the Killer Feature - Auto-Merge 🔥

This automatically merges all PRs from others (not your own):

```python
result = git.auto_merge_prs("your-username/your-repo")

print(f"Merged: {result['summary']['total_merged']}")
print(f"Failed: {result['summary']['total_failed']}")
print(f"Skipped: {result['summary']['total_skipped']}")
```

It skips:
- ⏭️  Your own PRs
- ⏭️  Draft PRs
- ⏭️  PRs with merge conflicts

## Step 5: Add More Accounts (Optional)

```python
# Add work account
git.add_account("work", "ghp_work_token_here")

# Add bot account
git.add_account("bot", "ghp_bot_token_here")

# Switch between them
git.use_account("work")
git.use_account("personal")

# See all accounts
git.list_accounts()
```

## Common Workflows

### Fork and Contribute
```python
# 1. Fork a repo
fork = git.fork_repo("awesome/project")
print(f"Forked to: {fork['full_name']}")

# 2. Create a branch
git.create_branch(fork['full_name'], "my-feature")

# 3. Make changes
file = git.get_file(fork['full_name'], "README.md")

git.update_file(
    repo=fork['full_name'],
    path="README.md",
    content=file['content'] + "\nNew line!",
    message="Update README",
    branch="my-feature",
    sha=file['sha']
)

# 4. Create PR
pr = git.create_pr(
    repo="awesome/project",
    title="Improve README",
    head=f"{git.current_account}:my-feature",
    base="main",
    body="This improves the README"
)

print(f"PR created: {pr['url']}")
```

### Batch Operations
```python
# Get all your repos and check for open PRs
my_repos = git.list_my_repos()

for repo in my_repos['repos']:
    prs = git.list_prs(repo['full_name'])
    if prs['count'] > 0:
        print(f"{repo['full_name']}: {prs['count']} open PRs")
```

## Using the Forward Function

Quick actions without remembering method names:

```python
# See all available actions
git.forward("help")

# Quick search
git.forward("search", query="language:rust")

# Quick fork
git.forward("fork", repo="owner/repo")

# Auto-merge
git.forward("auto_merge", repo="owner/repo")
```

## Next Steps

Now that you're set up:

1. **Learn More**:
   - [QUICKSTART.md](QUICKSTART.md) - Quick reference
   - [TUTORIAL.md](TUTORIAL.md) - Detailed examples
   - [README.md](README.md) - Full documentation

2. **See Examples**:
   - Run `python3 examples.py` and uncomment examples

3. **AI Integration**:
   - Read [CLAUDE_INTEGRATION.md](CLAUDE_INTEGRATION.md)
   - Use `git.prepare_for_claude()` to fetch files for AI processing

4. **Automate**:
   - Auto-merge PRs across all repos
   - Batch update files
   - Create issues from templates
   - Fork and contribute at scale

## Tips & Tricks

### Save Common Searches
```python
def find_ml_repos():
    return git.search_repos("topic:machine-learning stars:>500")

def find_rust_projects():
    return git.search_repos("language:rust stars:>1000")

ml_repos = find_ml_repos()
```

### Multi-Account Workflow
```python
# Check stats across all accounts
accounts = git.list_accounts()['accounts']

for account_name in accounts.keys():
    git.use_account(account_name)
    repos = git.list_my_repos()

    total_stars = sum(r['stars'] for r in repos['repos'])

    print(f"{account_name}: {repos['count']} repos, {total_stars} stars")
```

### Error Handling
```python
result = git.merge_pr("owner/repo", pr_number=123)

if result['status'] == 'success':
    print(f"Merged! SHA: {result['sha']}")
else:
    print(f"Failed: {result['message']}")
```

## Troubleshooting

### "Not authenticated" error
```python
# Check your accounts
accounts = git.list_accounts()
print(accounts)

# Make sure you're using one
git.use_account("personal")
```

### "Token invalid" error
- Your token might have expired
- Generate a new one and update:
  ```python
  git.add_account("personal", "ghp_new_token", set_default=True)
  ```

### Rate limiting
- GitHub allows 5000 requests/hour
- Switch accounts if you hit the limit:
  ```python
  git.use_account("other-account")
  ```

## Where Files Are Stored

GitAgent stores config in:
```
~/.mod/gitagent/
├── accounts.json   # Your accounts and tokens
├── config.json     # Settings
└── repos_cache.json  # Cache (future feature)
```

⚠️ **Keep these files secure!** They contain your GitHub tokens.

## Getting Help

- **Quick Reference**: [QUICKSTART.md](QUICKSTART.md)
- **Tutorial**: [TUTORIAL.md](TUTORIAL.md)
- **Full Docs**: [README.md](README.md)
- **Examples**: [examples.py](examples.py)
- **Status**: [STATUS.md](STATUS.md)

## What Makes GitAgent Better?

| Feature | GitHub Web UI | GitAgent |
|---------|---------------|----------|
| Multi-Account | ❌ Manual logout/login | ✅ Instant switching |
| Search | ⚠️ Basic | ✅ Advanced filters |
| Automation | ❌ Manual clicks | ✅ Full automation |
| AI Integration | ❌ Not available | ✅ Built-in |
| Speed | ⚠️ Page loads | ✅ Instant API |
| Batch Ops | ❌ One at a time | ✅ Script anything |
| Auto-merge | ❌ Manual | ✅ One command |

## You're Ready! 🎉

You now have:
- ✅ GitAgent installed and tested
- ✅ Account(s) added
- ✅ Basic commands working
- ✅ Knowledge of key features

**Start automating your GitHub workflow!**

Try this:
```python
# Search for interesting repos
results = git.search_repos("topic:ai language:python stars:>1000")

# Fork one you like
git.fork_repo(results['repos'][0]['full_name'])

# Auto-merge PRs on your repos
for repo in git.list_my_repos()['repos'][:5]:
    result = git.auto_merge_prs(repo['full_name'])
    print(f"{repo['full_name']}: merged {result['summary']['total_merged']}")
```

---

**Welcome to GitAgent!** You're now part of the GitHub power user club. 🚀

*Questions? Check the docs or dive into examples.py for more patterns.*
