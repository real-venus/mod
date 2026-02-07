# Changelog - Auto-Installation & API Key Features

## New Features Added

### 1. Automatic Claude CLI Installation

**Location:** `claude/mod.py` - `_find_or_install_claude()` and `_install_claude()` methods

**What it does:**
- Automatically checks if Claude CLI is installed
- If not found, attempts to install via Homebrew
- Provides clear error messages if installation fails
- No manual installation needed for users with Homebrew

**User benefit:** Zero-configuration setup - users can start using the module immediately without installing Claude CLI first.

### 2. Automatic API Key Detection

**Location:** `claude/mod.py` - `_get_api_key()` method

**What it does:**
- Searches multiple locations for API keys in priority order:
  1. Explicit `api_key` parameter
  2. `ANTHROPIC_API_KEY` environment variable
  3. `CLAUDE_API_KEY` environment variable
  4. `~/.anthropic/api_key` file
  5. `~/.anthropic/api_keys` file
  6. `~/.claude/api_key` file
  7. `~/.config/anthropic/api_key` file

**User benefit:** No authentication prompts during execution - the module automatically uses available credentials.

### 3. API Key Integration in Execution

**Location:** `claude/mod.py` - `forward()` method

**What it does:**
- Passes API key via `--api-key` flag to Claude CLI
- Sets `ANTHROPIC_API_KEY` environment variable
- Ensures authenticated execution without prompts

**User benefit:** Seamless, uninterrupted programmatic execution.

## Modified Files

### claude/mod.py
- Added `api_key` parameter to `__init__()`
- Added `_get_api_key()` method for automatic API key detection
- Added `_install_claude()` method for automatic installation
- Modified `_find_claude_binary()` to `_find_or_install_claude()`
- Updated `forward()` to use API key in command and environment
- Updated `run_claude()` convenience function to accept `api_key` parameter
- Added `sys` import for stderr output during installation

### README.md
- Updated Installation section to highlight auto-features
- Added API key setup instructions
- Updated Quick Start examples
- Updated API Reference with new parameters
- Enhanced Troubleshooting section with authentication issues
- Added references to new documentation

### New Files Created

1. **SETUP_GUIDE.md**
   - Comprehensive setup instructions
   - API key configuration methods
   - Verification steps
   - Troubleshooting guide
   - Security best practices

2. **test_auto_install.py**
   - Test suite for auto-installation
   - Test suite for API key detection
   - Verifies priority order of API key sources

3. **example_usage.py**
   - Example code demonstrating new features
   - Shows different initialization methods
   - Documents API key detection sources

4. **CHANGELOG_AUTO_FEATURES.md** (this file)
   - Documents all changes made
   - Explains new features
   - Lists modified and new files

## API Changes

### Constructor

**Before:**
```python
Mod(default_path: Optional[str] = None)
```

**After:**
```python
Mod(default_path: Optional[str] = None, api_key: Optional[str] = None)
```

### Convenience Function

**Before:**
```python
run_claude(query: str, path: Optional[str] = None, **kwargs)
```

**After:**
```python
run_claude(query: str, path: Optional[str] = None, api_key: Optional[str] = None, **kwargs)
```

## Backward Compatibility

✅ **Fully backward compatible** - all existing code will continue to work without modifications.

- Existing `Mod()` calls work unchanged
- New `api_key` parameter is optional
- Auto-installation only triggers if Claude CLI is not found
- API key detection happens automatically but doesn't break existing setups

## Usage Examples

### Before (manual setup required):
```bash
# User had to do this manually first
brew install anthropics/claude/claude

# And might face auth prompts
```

```python
from claude.mod import Mod
mod = Mod()
result = mod.forward("Analyze code")  # Might prompt for authentication
```

### After (automatic):
```python
from claude.mod import Mod

# Auto-installs Claude CLI if needed
# Auto-detects API key from environment/config
mod = Mod()
result = mod.forward("Analyze code")  # No prompts!
```

### Explicit API Key (new capability):
```python
from claude.mod import Mod

# Pass API key directly (great for CI/CD)
mod = Mod(api_key="sk-ant-your-key")
result = mod.forward("Analyze code")
```

## Testing

Run the new test suite to verify features:

```bash
# Test auto-installation and API key detection
python3 test_auto_install.py

# Run usage examples
python3 example_usage.py

# Existing tests still work
python test_simple.py
```

## Benefits

1. **Zero-Configuration Setup**: Users can start immediately without manual installation
2. **No Authentication Interruptions**: Automatic API key detection prevents prompts
3. **Flexible Configuration**: Multiple ways to provide API keys (environment, file, parameter)
4. **CI/CD Friendly**: Easy to integrate in automated pipelines
5. **Backward Compatible**: Existing code works without changes
6. **Better Error Messages**: Clear feedback when installation or authentication fails
7. **Security**: Follows best practices for API key handling

## Error Handling

The implementation includes robust error handling:

- Installation failures provide clear error messages
- Missing Homebrew is detected and reported
- API key detection failures don't break initialization
- Timeouts prevent hanging during installation
- All errors are properly propagated with context

## Future Enhancements

Possible future improvements:

1. Support for other package managers (apt, yum, chocolatey)
2. Automatic API key validation before execution
3. Caching of API key location for faster subsequent lookups
4. Support for multiple API keys (team accounts)
5. Automatic key rotation reminders
6. Integration with secrets managers (AWS Secrets Manager, Azure Key Vault, etc.)

## Migration Guide

No migration needed! The changes are fully backward compatible.

However, to take advantage of new features:

1. **Set up API key** (choose one method):
   ```bash
   # Option 1: Environment variable
   export ANTHROPIC_API_KEY="your-key"

   # Option 2: Config file
   echo "your-key" > ~/.anthropic/api_key

   # Option 3: Pass to constructor
   mod = Mod(api_key="your-key")
   ```

2. **Remove manual installation** (optional):
   - You can remove manual `brew install` steps from setup scripts
   - The module now handles this automatically

3. **Verify** (optional):
   ```bash
   python3 test_auto_install.py
   ```

That's it! Your existing code continues to work while gaining new capabilities.
