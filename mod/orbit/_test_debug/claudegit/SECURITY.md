# ClaudeGit Security Guide

## ⚠️ Important Security Considerations

ClaudeGit provides powerful automation with GitHub integration. Please review these security guidelines before use.

## Force Push Warnings

### What is Force Push?

ClaudeGit uses `git push -f` (force push) by default. This means:

- **Overwrites remote branch history** completely
- **Discards commits** that exist on remote but not locally
- **Cannot be undone** (remote commits are lost)
- **Affects collaborators** if they have the branch checked out

### When Force Push is Safe

✅ **Safe scenarios:**
- Personal/solo projects
- Dedicated ClaudeGit branches (not shared)
- Experimental/throwaway branches
- When you intentionally want to overwrite remote

### When Force Push is Dangerous

❌ **Dangerous scenarios:**
- Shared branches (main, develop)
- Team collaboration branches
- Protected branches
- Production deployments
- When others are working on the branch

## Best Practices

### 1. Use Dedicated Branches

**Always use a separate branch for ClaudeGit:**

```python
c = Mod(
    github_repo='myorg/myapp',
    github_branch='claudegit-auto',  # NOT 'main' or 'develop'
    auto_push=True
)
```

### 2. GitHub Token Security

**Never commit your GitHub token:**

```bash
# ✅ Good: Use environment variables
export GITHUB_TOKEN=ghp_...

# ❌ Bad: Hardcode in scripts
github_token = "ghp_..."  # DON'T DO THIS
```

**Token permissions:**
- Use fine-grained tokens (not classic) when possible
- Limit scope to specific repositories
- Set expiration dates
- Rotate tokens regularly

**Storage:**
- ClaudeGit stores token in `~/.mod/claudegit/github.json`
- File is automatically `chmod 600` (owner-only)
- Never commit this file (it's in .gitignore)
- Backup this file securely if needed

### 3. Review Before Auto-Push

**Start with manual mode:**

```python
# First run: manual mode to review
c = Mod(auto_push=False)

c.generate_code("Add feature X")
# Review changes locally with: git diff

# Push manually when satisfied
c.sync_to_github(message="Add feature X")

# Later: enable auto-push when confident
c.configure_github(auto_push=True)
```

### 4. Use Protected Branches

**Configure GitHub branch protection:**

1. Go to repo → Settings → Branches
2. Add protection rule for `main`, `develop`
3. Require pull request reviews
4. Prevent force pushes

This prevents accidental force push to critical branches.

### 5. Separate GitHub Account

**Consider using a dedicated GitHub account:**

- Create `myname-claudegit` GitHub account
- Give it access only to ClaudeGit repos
- Easier to audit/revoke access
- Limits blast radius of token compromise

### 6. Test on Throwaway Repos

**Before using on real projects:**

```bash
# Create test repo
gh repo create test-claudegit --private

# Test ClaudeGit
export GITHUB_REPO=username/test-claudegit
python examples/basic_usage.py

# Verify behavior
gh repo view test-claudegit

# Delete when done
gh repo delete test-claudegit
```

## Token Compromise Response

**If your GitHub token is compromised:**

1. **Revoke immediately:** https://github.com/settings/tokens
2. **Generate new token** with minimal required scope
3. **Update ClaudeGit config:**
   ```python
   c = Mod()
   c.configure_github(token='new_token_here')
   ```
4. **Audit repo access:** Check for unauthorized commits
5. **Rotate other credentials** if shared

## Owner-Based Access Control

ClaudeGit inherits Claude Mod's owner-based access control:

```python
# Set owner address
c = Mod(owner='0x1234...')

# Only the owner can:
# - generate_code()
# - refactor()
# - edit_file()
# - git_force_push()

# Anyone can:
# - analyze_code()
# - debug()
# - ask()
```

## Audit Trail

### Local Audit

```bash
# View git history
git log --oneline -20

# View specific changes
git show <commit-hash>

# Find ClaudeGit commits
git log --grep="ClaudeGit"
```

### GitHub Audit

```bash
# View commits via GitHub CLI
gh api repos/{owner}/{repo}/commits | jq '.[] | {sha, message, date}'

# View specific commit
gh api repos/{owner}/{repo}/commits/{sha}
```

### IPFS Version History

ClaudeGit stores code to IPFS:

```python
c = Mod()

# View history
c.show_history(limit=20)

# Get specific version
cid = c.get_latest_cid()
content = c.ipfs.cat(cid)
```

## Network Security

### HTTPS Authentication

ClaudeGit uses HTTPS with token authentication:

```
https://{TOKEN}@github.com/user/repo.git
```

**Security notes:**
- Token visible in git remote URL
- Not stored in git history
- Stored in `.git/config` (local only)
- Use SSH keys as alternative (manual setup)

### SSH Alternative

**For higher security, use SSH:**

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "claudegit@myemail.com"

# Add to GitHub
gh ssh-key add ~/.ssh/id_ed25519.pub

# Configure repo to use SSH
cd /path/to/repo
git remote set-url origin git@github.com:user/repo.git

# ClaudeGit will use SSH instead of HTTPS
```

## Recommended Workflow

**Secure ClaudeGit workflow:**

1. **Create dedicated branch**
   ```bash
   git checkout -b claudegit-dev
   ```

2. **Initialize ClaudeGit with manual push**
   ```python
   c = Mod(
       github_repo='myorg/myapp',
       github_branch='claudegit-dev',
       auto_push=False
   )
   ```

3. **Make changes and review**
   ```python
   c.generate_code("Add feature")
   # Review with: git diff
   ```

4. **Push manually**
   ```python
   c.sync_to_github(message="Add feature via ClaudeGit")
   ```

5. **Create PR on GitHub**
   ```bash
   gh pr create --base main --head claudegit-dev
   ```

6. **Review and merge** via GitHub web UI

7. **Enable auto-push** once confident
   ```python
   c.configure_github(auto_push=True)
   ```

## Environment Isolation

**Use virtual environments:**

```bash
# Create venv
python3 -m venv venv

# Activate
source venv/bin/activate

# Install ClaudeGit
pip install -r requirements.txt

# Use isolated environment
python my_script.py

# Deactivate
deactivate
```

## Monitoring

**Monitor ClaudeGit activity:**

```bash
# Watch git log in real-time
watch -n 5 git log --oneline -10

# Monitor GitHub pushes
gh api -X GET /repos/{owner}/{repo}/events | jq '.[] | select(.type=="PushEvent")'

# Set up GitHub webhooks for notifications
# (configure in repo → Settings → Webhooks)
```

## Summary Checklist

Before using ClaudeGit in production:

- [ ] Created dedicated branch for ClaudeGit
- [ ] Generated GitHub token with minimal required scope
- [ ] Set token expiration date
- [ ] Stored token securely (environment variable or config file)
- [ ] Added `.mod/claudegit/github.json` to .gitignore
- [ ] Tested on throwaway repo first
- [ ] Reviewed force push behavior
- [ ] Configured GitHub branch protection for main/develop
- [ ] Set up owner-based access control
- [ ] Understand how to review changes (git diff, git log)
- [ ] Know how to revoke token if compromised
- [ ] Documented workflow for team (if applicable)

---

**Questions or concerns?**

Open an issue: https://github.com/modprotocol/mod/issues
