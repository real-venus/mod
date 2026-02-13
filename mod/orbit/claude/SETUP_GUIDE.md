# Setup Guide - Auto-Installation & API Key Configuration

This guide covers the automatic installation and API key configuration features of Claude Code Mod.

## Automatic Features

### 1. Auto-Installation of Claude CLI

The module automatically detects if Claude CLI is installed and attempts to install it via Homebrew if not found.

**No manual installation needed!** Just start using the module:

```python
from claude.mod import Mod

# This will automatically install Claude CLI if not found
mod = Mod()
```

**Installation Process:**
1. Checks if `claude` command exists
2. If not found, checks if Homebrew is available
3. Runs `brew install anthropics/claude/claude`
4. Verifies installation was successful

**Manual Installation (if auto-install fails):**
```bash
# Install Homebrew first (if needed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Claude CLI
brew install anthropics/claude/claude
```

### 2. Automatic API Key Detection

The module automatically searches for API keys in multiple locations to avoid authentication prompts.

**Detection Order (highest to lowest priority):**

1. **Explicit Parameter** (highest priority)
   ```python
   mod = Mod(api_key="sk-ant-...")
   ```

2. **Environment Variables**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   # or
   export CLAUDE_API_KEY="sk-ant-..."
   ```

3. **Config Files** (checked in order)
   - `~/.anthropic/api_key`
   - `~/.anthropic/api_keys`
   - `~/.claude/api_key`
   - `~/.config/anthropic/api_key`

## Setup Methods

### Method 1: Environment Variable (Recommended for Development)

**Linux/macOS:**
```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.bash_profile
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Apply immediately
source ~/.bashrc  # or ~/.zshrc
```

**Windows:**
```powershell
# PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-your-key-here"

# Or permanently via System Properties > Environment Variables
```

### Method 2: Config File (Recommended for Production)

```bash
# Create directory
mkdir -p ~/.anthropic

# Save API key
echo "sk-ant-your-key-here" > ~/.anthropic/api_key

# Secure the file
chmod 600 ~/.anthropic/api_key
```

### Method 3: Explicit Parameter (Recommended for CI/CD)

```python
import os
from claude.mod import Mod

# Read from secrets manager or environment
api_key = os.environ.get('ANTHROPIC_API_KEY')

# Pass explicitly
mod = Mod(
    default_path="/path/to/project",
    api_key=api_key
)
```

## Verification

### Test Installation and API Key Detection

```bash
# Run the test suite
python3 test_auto_install.py
```

Expected output:
```
============================================================
Claude Code Mod - Auto-Installation & API Key Tests
============================================================
Testing Mod initialization...
✓ Mod initialized successfully
  Claude binary: /opt/homebrew/bin/claude
✓ API key detected (length: 108 chars)

Testing API key detection priority...
✓ Explicit API key parameter works
✓ Environment variable API key detection works

============================================================
Test Summary:
============================================================
✓ Initialization: PASSED
✓ API Key Priority: PASSED
============================================================

✓ All tests passed!
```

### Verify API Key Detection

```python
from claude.mod import Mod

mod = Mod()

if mod.api_key:
    print(f"✓ API key detected ({len(mod.api_key)} chars)")
else:
    print("⚠ No API key found - will prompt during execution")
```

## Usage Examples

### Example 1: Zero Configuration

```python
from claude.mod import Mod

# Everything is automatic!
# - Claude CLI installs if needed
# - API key detected from environment/config
mod = Mod(default_path="/path/to/project")

# Use it
result = mod.forward("Analyze the code")
```

### Example 2: CI/CD Pipeline

```python
import os
from claude.mod import Mod

def analyze_pr():
    """Automated code review in CI/CD"""
    api_key = os.environ.get('ANTHROPIC_API_KEY')

    mod = Mod(
        default_path=os.getcwd(),
        api_key=api_key
    )

    results = mod.batch_process([
        "Check for security vulnerabilities",
        "Verify code style compliance",
        "Check for unused imports"
    ], os.getcwd())

    return results
```

### Example 3: Docker Container

```dockerfile
FROM python:3.11

# Install system dependencies
RUN apt-get update && apt-get install -y curl

# Install Homebrew
RUN /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Claude CLI
RUN brew install anthropics/claude/claude

# Set API key via environment
ENV ANTHROPIC_API_KEY=sk-ant-your-key-here

# Copy and install your application
COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt

# Run your application
CMD ["python", "your_script.py"]
```

## Troubleshooting

### Issue: "Claude CLI not found and could not be installed"

**Cause:** Homebrew is not installed

**Solution:**
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then retry
python3 your_script.py
```

### Issue: "Installation timed out after 5 minutes"

**Cause:** Slow network or Homebrew update taking too long

**Solution:**
```bash
# Update Homebrew manually first
brew update

# Install Claude manually
brew install anthropics/claude/claude

# Then use the module normally
```

### Issue: Authentication prompts still appearing

**Cause:** API key not detected

**Solution:**
1. Verify API key is set:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

2. Or check config file exists:
   ```bash
   cat ~/.anthropic/api_key
   ```

3. Test detection:
   ```python
   from claude.mod import Mod
   mod = Mod()
   print("API key found:" if mod.api_key else "No API key")
   ```

### Issue: "Permission denied" when writing config file

**Solution:**
```bash
# Create directory with correct permissions
mkdir -p ~/.anthropic
chmod 700 ~/.anthropic

# Write key with restricted permissions
echo "your-key" > ~/.anthropic/api_key
chmod 600 ~/.anthropic/api_key
```

## Security Best Practices

1. **Never commit API keys to version control**
   ```bash
   # Add to .gitignore
   echo "*.key" >> .gitignore
   echo ".env" >> .gitignore
   ```

2. **Use environment variables in CI/CD**
   - GitHub Actions: Use secrets
   - GitLab CI: Use masked variables
   - Jenkins: Use credentials plugin

3. **Restrict file permissions**
   ```bash
   chmod 600 ~/.anthropic/api_key
   ```

4. **Rotate keys regularly**
   - Generate new keys at https://console.anthropic.com
   - Update all deployment environments

5. **Use separate keys for different environments**
   - Development: Personal key
   - Production: Organization key
   - CI/CD: Dedicated automation key

## Additional Resources

- [Anthropic API Keys](https://console.anthropic.com/settings/keys)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Homebrew Installation](https://brew.sh)

## Support

If you encounter issues not covered in this guide:

1. Check existing issues: GitHub repository
2. Run diagnostics: `python3 test_auto_install.py`
3. Check logs: Enable verbose mode in your script
4. Report bugs: Create an issue with logs and error messages
