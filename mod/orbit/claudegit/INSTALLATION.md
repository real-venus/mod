# ClaudeGit Installation Guide

Complete installation guide for the ClaudeGit module.

## Prerequisites

- **Python 3.11+** - Check with `python3 --version`
- **Claude CLI** - Install with `brew install anthropics/claude/claude`
- **Git** - Should be pre-installed on macOS/Linux
- **GitHub Account** - For GitHub integration
- **GitHub Personal Access Token** - Generate at https://github.com/settings/tokens

## Installation Methods

### Method 1: Via Mod Framework (Recommended)

If you already have the Mod framework installed:

```bash
cd ~/mod/mod/orbit/claudegit
pip install -r requirements.txt
```

### Method 2: Standalone Installation

```bash
# Clone the repository
git clone https://github.com/modprotocol/mod.git
cd mod/mod/orbit/claudegit

# Install dependencies
pip install -r requirements.txt

# Or install in development mode
pip install -e .
```

### Method 3: Using install script

```bash
cd ~/mod/mod/orbit/claudegit
./scripts/install.sh
```

## Configuration

### 1. Generate GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "ClaudeGit Token")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Set expiration (30 days, 90 days, or custom)
6. Click "Generate token"
7. **Copy the token** (starts with `ghp_`) - you won't see it again!

### 2. Set Environment Variables

**For bash/zsh (Linux/macOS):**

```bash
# Add to ~/.bashrc or ~/.zshrc for persistence
export GITHUB_TOKEN=ghp_your_token_here
export GITHUB_REPO=username/repo-name
```

**For current session only:**

```bash
export GITHUB_TOKEN=ghp_your_token_here
export GITHUB_REPO=username/repo-name
```

**Verify:**

```bash
echo $GITHUB_TOKEN  # Should show your token
echo $GITHUB_REPO   # Should show your repo
```

### 3. Verify Installation

```bash
# Test import
python3 -c "from claudegit import Mod; print('✓ ClaudeGit installed successfully')"

# Run demo
python3 demo.py

# Run tests
python3 tests/test_claudegit.py
```

## Post-Installation

### Create Test Repository

Create a test repo on GitHub to experiment:

```bash
# Using GitHub CLI
gh repo create test-claudegit --private --description "ClaudeGit test repo"

# Set as GITHUB_REPO
export GITHUB_REPO=your-username/test-claudegit
```

### First Test

```python
from claudegit import Mod

# Initialize (manual mode for safety)
c = Mod(auto_push=False)

# Check configuration
config = c.configure_github()
print(config)

# Test git operations (will create commit but not push)
# c.git_force_push()  # Uncomment to actually push
```

## Troubleshooting

### ❌ "ModuleNotFoundError: No module named 'mod'"

**Solution:** Install the Mod framework or add to PYTHONPATH:

```bash
export PYTHONPATH=$PYTHONPATH:~/mod/mod/orbit
```

### ❌ "Claude CLI not found"

**Solution:** Install Claude CLI:

```bash
brew install anthropics/claude/claude
claude --version
```

### ❌ "Failed to install requirements"

**Solution:** Update pip and retry:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### ❌ "Permission denied" when running scripts

**Solution:** Make scripts executable:

```bash
chmod +x scripts/install.sh
chmod +x demo.py
chmod +x examples/basic_usage.py
chmod +x tests/test_claudegit.py
```

### ❌ "GitHub token invalid"

**Solution:** Check token:

1. Token should start with `ghp_`
2. Token should have `repo` scope
3. Token should not be expired
4. Regenerate if necessary

### ❌ "Repository not found"

**Solution:** Verify repo format:

```bash
# Correct formats
export GITHUB_REPO=username/repo-name
export GITHUB_REPO=https://github.com/username/repo-name.git

# Incorrect formats
export GITHUB_REPO=repo-name  # Missing username
export GITHUB_REPO=username/  # Missing repo
```

## Uninstallation

### Remove ClaudeGit

```bash
pip uninstall claudegit

# Or if installed in development mode
pip uninstall -e .
```

### Remove configuration

```bash
rm -rf ~/.mod/claudegit
```

### Remove module directory

```bash
rm -rf ~/mod/mod/orbit/claudegit
```

## Updating

### Update from git

```bash
cd ~/mod/mod/orbit/claudegit
git pull origin main
pip install -r requirements.txt --upgrade
```

### Update dependencies only

```bash
pip install -r requirements.txt --upgrade
```

## Alternative Configurations

### Using a .env file

Create `.env` file in your project:

```bash
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=username/repo-name
ANTHROPIC_API_KEY=sk-ant-...
```

Load in Python:

```python
from dotenv import load_dotenv
load_dotenv()

from claudegit import Mod
c = Mod()  # Automatically loads from environment
```

### Using config files

ClaudeGit stores config in `~/.mod/claudegit/github.json`:

```json
{
  "token": "ghp_...",
  "repo": "username/repo",
  "branch": "main",
  "auto_push": false
}
```

You can edit this file directly, but it's better to use `configure_github()`:

```python
c = Mod()
c.configure_github(
    token='ghp_new_token',
    repo='new/repo',
    branch='dev'
)
```

## Next Steps

After installation:

1. ✅ Read [QUICKSTART.md](QUICKSTART.md) - Get started in 5 minutes
2. ✅ Read [README.md](README.md) - Full documentation
3. ✅ Read [SECURITY.md](SECURITY.md) - Security best practices
4. ✅ Run `python3 demo.py` - Interactive demo
5. ✅ Run `python3 examples/basic_usage.py` - Usage examples
6. ✅ Read [COMPARISON.md](COMPARISON.md) - Compare with Claude Mod

## Support

- **Issues:** https://github.com/modprotocol/mod/issues
- **Documentation:** See all `.md` files in this directory
- **Examples:** See `examples/` directory
- **Tests:** See `tests/` directory

---

**Installation complete!** You're ready to use ClaudeGit.
