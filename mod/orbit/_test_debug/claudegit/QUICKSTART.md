# ClaudeGit Quick Start

Get started with ClaudeGit in 5 minutes.

## 1. Install

```bash
cd ~/mod/mod/orbit/claudegit
pip install -r requirements.txt
```

## 2. Get GitHub Token

1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scope: `repo` (Full control of private repositories)
4. Copy the token (starts with `ghp_`)

## 3. Configure

**Option A: Environment Variables (Recommended)**

```bash
export GITHUB_TOKEN=ghp_your_token_here
export GITHUB_REPO=username/repo-name
```

**Option B: Programmatic**

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

## 4. Use It

```python
from claudegit import Mod

# Initialize with auto-push enabled
c = Mod(auto_push=True)

# Make changes - automatically pushed to GitHub
c.generate_code("Create a FastAPI hello world endpoint", path="/my/project")
c.refactor("Add error handling", path="/my/project")
c.edit_file("main.py", "Add docstrings")

# All changes are now on GitHub!
```

## 5. Manual Push Mode

```python
# Disable auto-push for manual control
c = Mod(auto_push=False)

# Make multiple changes
c.generate_code("Add user model")
c.generate_code("Add auth endpoints")

# Push all at once
c.sync_to_github(message="Add user auth system")
```

## Key Concepts

### Auto-Push

- `auto_push=True` → Every operation pushes to GitHub immediately
- `auto_push=False` → Call `sync_to_github()` manually

### Force Push

ClaudeGit uses `git push -f` (force push) by default:

```python
c.git_force_push()  # Overwrites remote branch
c.git_push()        # Regular push (fails if diverged)
```

⚠️ **Warning:** Force push overwrites remote history. Use a dedicated branch!

### Configuration

Config is stored in `~/.mod/claudegit/github.json`:

```json
{
  "token": "ghp_...",
  "repo": "username/repo",
  "branch": "main",
  "auto_push": true
}
```

## Best Practices

1. **Use a dedicated branch** for ClaudeGit (not `main`)
2. **Review changes** before enabling auto-push
3. **Keep token secure** - never commit it
4. **Test on a test repo** first

## Example: Automated Workflow

```python
from claudegit import Mod

# Use a dedicated branch
c = Mod(
    github_repo='myorg/my-app',
    github_branch='claudegit-dev',
    auto_push=True
)

# Build features - auto-pushed to claudegit-dev branch
c.generate_code("Create User model")
c.generate_code("Add CRUD endpoints")
c.run_task("Add tests")

# Changes are on GitHub in claudegit-dev branch
# Review and merge via PR on GitHub
```

## Troubleshooting

### Token not working?

- Check token has `repo` scope
- Check token is not expired
- Check repo name is correct (`username/repo-name`)

### Push failing?

```python
# Use force push if regular push fails
c.git_force_push()
```

### Want to see git output?

```python
Mod.set_log_level('DEBUG')
c = Mod()
# Now you'll see detailed git command output
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [examples/basic_usage.py](examples/basic_usage.py) for more examples
- Run tests: `python tests/test_claudegit.py`

---

**Need help?** Open an issue at https://github.com/modprotocol/mod/issues
