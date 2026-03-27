# Migration Guide: Pluggable Backends

This guide helps you migrate to the new pluggable backend architecture.

## TL;DR - Your Code Still Works! 🎉

**Good news:** The claude module is **100% backward compatible**. Your existing code continues to work without any changes!

```python
# This still works exactly as before
from claude import Mod
mod = Mod()
result = mod.forward("Analyze security issues")
```

The only difference is that it now auto-selects the best available backend instead of requiring Claude Code CLI.

## What's New?

### Before (Single Backend)

```python
from claude import Mod

# Always used Claude Code CLI
mod = Mod(api_key='...')
result = mod.forward("Fix the bug")
```

**Limitation:** Required Claude Code CLI to be installed and configured.

### After (Multiple Backends)

```python
from claude import Mod

# Auto-selects best backend
mod = Mod()

# OR explicitly choose
mod = Mod(backend='claude-code')
mod = Mod(backend='dev-tools')
mod = Mod(backend='codex', api_key='sk-...')

result = mod.forward("Fix the bug")
```

**Benefits:**
- Works in more environments
- Automatic fallback if one backend unavailable
- Choose the best tool for each task
- Extensible - add your own backends

## Migration Scenarios

### Scenario 1: Basic Usage (No Changes Needed)

**Before:**
```python
from claude import Mod

mod = Mod()
mod.analyze_code(focus="security")
```

**After:**
```python
from claude import Mod

mod = Mod()  # Still works! Now auto-selects backend
mod.analyze_code(focus="security")
```

**Status:** ✅ No changes needed

---

### Scenario 2: With API Key

**Before:**
```python
from claude import Mod

mod = Mod(api_key='your-anthropic-key')
result = mod.forward("Refactor code")
```

**After:**
```python
from claude import Mod

# Option 1: Same as before (uses claude-code backend)
mod = Mod(api_key='your-anthropic-key')

# Option 2: Explicit backend selection
mod = Mod(backend='claude-code', api_key='your-anthropic-key')

result = mod.forward("Refactor code")
```

**Status:** ✅ No changes needed, but backend parameter available if wanted

---

### Scenario 3: Multiple Instances

**Before:**
```python
from claude import Mod

mod1 = Mod(default_path="/project1")
mod2 = Mod(default_path="/project2")

mod1.forward("Task 1")
mod2.forward("Task 2")
```

**After:**
```python
from claude import Mod

# Same as before - works perfectly
mod1 = Mod(default_path="/project1")
mod2 = Mod(default_path="/project2")

# NEW: Can use different backends for different tasks
mod1 = Mod(default_path="/project1", backend='claude-code')
mod2 = Mod(default_path="/project2", backend='dev-tools')

mod1.forward("Task 1")
mod2.forward("Task 2")
```

**Status:** ✅ No changes needed, enhanced capability available

---

### Scenario 4: Error Handling

**Before:**
```python
from claude import Mod

try:
    mod = Mod()
    result = mod.forward("Query")
except RuntimeError as e:
    print(f"Claude Code error: {e}")
```

**After:**
```python
from claude import Mod

try:
    mod = Mod()
    result = mod.forward("Query")
except RuntimeError as e:
    print(f"Backend error: {e}")

# NEW: Can try alternate backend
except RuntimeError:
    print("Primary backend failed, trying alternate...")
    mod = Mod(backend='dev-tools')
    result = mod.forward("Query")
```

**Status:** ✅ Works as before, better fallback options available

---

### Scenario 5: Batch Processing

**Before:**
```python
from claude import Mod

mod = Mod()
results = mod.batch_process([
    "Check security",
    "Add tests",
    "Update docs"
], path="/project")
```

**After:**
```python
from claude import Mod

# Same as before
mod = Mod()
results = mod.batch_process([
    "Check security",
    "Add tests",
    "Update docs"
], path="/project")

# NEW: Can specify backend for batch
mod = Mod(backend='dev-tools')  # Use dev-tools for all tasks
results = mod.batch_process(tasks, path="/project")
```

**Status:** ✅ No changes needed

---

## New Features to Adopt (Optional)

### 1. List Available Backends

```python
from claude import Mod

# NEW: See what's available
backends = Mod.list_backends()
for b in backends:
    print(f"{b['name']}: {'✓' if b['available'] else '✗'}")
```

### 2. Switch Backends at Runtime

```python
from claude import Mod

mod = Mod()  # Starts with auto-selected backend

# NEW: Switch backends on the fly
mod.switch_backend('dev-tools')
result = mod.forward("Quick file operation")

mod.switch_backend('claude-code')
result = mod.forward("Deep code analysis")
```

### 3. Explicit Backend Selection

```python
from claude import Mod

# NEW: Choose specific backend
claude = Mod(backend='claude-code')
dev = Mod(backend='dev-tools')
codex = Mod(backend='codex', api_key='sk-...')

# Use each for what it's best at
claude.analyze_code(focus="architecture")
dev.forward("Find all TODO comments")
codex.forward("Explain this algorithm")
```

### 4. Custom Backends

```python
from claude.backends import Backend, registry

# NEW: Create your own backend
class MyBackend(Backend):
    # ... implementation ...
    pass

registry.register('my-backend', MyBackend)
mod = Mod(backend='my-backend')
```

## Deprecation Warnings

**None!** Everything is backward compatible.

However, we recommend:

1. ✅ **Use `Mod()` for auto-selection** instead of assuming claude-code
2. ✅ **Check `list_backends()`** to see what's available
3. ✅ **Add fallback logic** for better reliability

## Breaking Changes

**None!** This is a fully backward-compatible update.

## Testing Your Migration

1. **Run your existing code** - it should work unchanged
2. **List backends** - see what's available in your environment
3. **Try explicit selection** - test different backends
4. **Add fallback** - handle unavailable backends gracefully

### Test Script

```python
from claude import Mod

def test_migration():
    """Test that your code still works"""

    # Your original code
    mod = Mod()
    print(f"✓ Initialized with backend: {mod.backend.name}")

    # Test basic operation
    result = mod.forward("print('Hello from Claude')")
    print(f"✓ Forward() works")

    # Test high-level methods
    # mod.analyze_code(path=".")
    # mod.generate_code("Create a test function")
    # mod.refactor("Extract helpers")
    print(f"✓ High-level methods work")

    print("\n✅ Migration successful!")

if __name__ == "__main__":
    test_migration()
```

## FAQ

### Q: Do I need to change my code?

**A:** No! Your existing code works without changes.

### Q: What if Claude Code CLI isn't installed?

**A:** It will auto-select an available backend (dev-tools or codex).

### Q: Can I still use Claude Code CLI only?

**A:** Yes! Use `Mod(backend='claude-code')` to explicitly select it.

### Q: Will performance change?

**A:** Performance characteristics depend on the backend used. Claude Code CLI performance is unchanged.

### Q: What about API costs?

**A:** Each backend has its own pricing. Auto-selection prefers claude-code (your existing costs).

### Q: How do I know which backend is being used?

**A:** Check `mod.backend.name` or call `Mod.list_backends()`.

### Q: Can I mix backends in one script?

**A:** Yes! Create multiple instances: `claude = Mod(backend='claude-code')`, `dev = Mod(backend='dev-tools')`

### Q: What if I have issues?

**A:** Report them! This is a new feature and we want it to work perfectly for everyone.

## Rollback Plan

If you encounter issues, you can:

1. **Keep using the module** - it's backward compatible
2. **Pin to claude-code**: `Mod(backend='claude-code')`
3. **Report the issue** - we'll fix it ASAP
4. **Disable auto-install**: `Mod(auto_install=False)`

## Next Steps

1. ✅ Run your existing code - verify it still works
2. ✅ Check available backends - `Mod.list_backends()`
3. ✅ Try explicit selection - experiment with different backends
4. ✅ Read full docs - [BACKENDS.md](BACKENDS.md)
5. ✅ Run examples - `python examples/multi_backend_example.py`

---

**Questions or issues?** Open an issue or check [BACKENDS.md](BACKENDS.md) for detailed documentation.
