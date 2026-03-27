# Pluggable Backends - Quick Start

The claude module now supports multiple AI code backends! Use Claude Code CLI, dev module tools, OpenAI Codex, or create your own.

## 🚀 30-Second Quick Start

```python
from claude import Mod

# Auto-select best backend
mod = Mod()

# Use it like before - works with ANY backend
mod.analyze_code(focus="security")
mod.refactor("Extract helpers to utils.py")
mod.debug("Fix the authentication error")
```

## 🎯 Choose Your Backend

```python
# Claude Code CLI (default)
mod = Mod(backend='claude-code')

# Dev module tools
mod = Mod(backend='dev-tools')

# OpenAI Codex
mod = Mod(backend='codex', api_key='sk-...')

# Auto-select (tries claude-code → dev-tools → codex)
mod = Mod()
```

## 📋 List Available Backends

```python
backends = Mod.list_backends()
for b in backends:
    status = "✓" if b['available'] else "✗"
    print(f"{status} {b['name']}: {b['description']}")
```

Output:
```
✓ claude-code: Official Claude Code CLI (via Anthropic)
✓ dev-tools: Dev module tool ecosystem with AI orchestration
✗ codex: OpenAI Codex / GPT-4 Code Models
```

## 🔄 Switch Backends at Runtime

```python
mod = Mod()  # Starts with best available
print(f"Using: {mod.backend.name}")

mod.switch_backend('dev-tools')  # Switch to dev tools
print(f"Now using: {mod.backend.name}")
```

## 🎨 Backend Features

| Backend | Best For | Requires |
|---------|----------|----------|
| **claude-code** | Full Claude experience | Claude CLI |
| **dev-tools** | Mod framework integration | mod framework |
| **codex** | OpenAI models | OpenAI API key |

## 💡 Why Multiple Backends?

1. **Portability** - Your code works in any environment
2. **Flexibility** - Choose the best tool for each task
3. **Fallback** - Automatic fallback if one backend unavailable
4. **Comparison** - Compare results from different AI models
5. **Extensibility** - Add your own custom backends

## 📚 Examples

### Multi-Backend Workflow

```python
# Use dev-tools for quick file ops
dev = Mod(backend='dev-tools')
files = dev.forward("List all TODO comments")

# Use Claude Code for deep analysis
claude = Mod(backend='claude-code')
analysis = claude.analyze_code(focus="architecture")

# Use Codex for explanations
codex = Mod(backend='codex', api_key='sk-...')
explanation = codex.forward("Explain the authentication flow")
```

### Automatic Fallback

```python
def execute_with_fallback(query):
    """Try multiple backends until one works"""
    for backend in ['claude-code', 'dev-tools', 'codex']:
        try:
            mod = Mod(backend=backend)
            return mod.forward(query)
        except:
            continue
    raise RuntimeError("All backends failed")
```

### Portable Code

```python
# This works EVERYWHERE - automatically uses best backend
mod = Mod()
result = mod.forward("Refactor to use async/await")
```

## 🛠️ Create Your Own Backend

```python
from claude.backends import Backend, registry

class MyBackend(Backend):
    @property
    def name(self):
        return "my-backend"

    @property
    def description(self):
        return "My custom AI backend"

    def is_available(self):
        return True  # Check if ready

    def install(self):
        return True  # Setup backend

    def forward(self, query, path=None, model="default", **kwargs):
        # Execute query with your AI
        return {"response": "..."}

# Register it
registry.register('my-backend', MyBackend)

# Use it
mod = Mod(backend='my-backend')
```

## 📖 Full Documentation

- **[BACKENDS.md](BACKENDS.md)** - Complete backend guide
- **[examples/multi_backend_example.py](examples/multi_backend_example.py)** - Working examples
- **[examples/custom_backend_example.py](examples/custom_backend_example.py)** - Custom backend templates

## 🎯 Quick Tips

1. **Use auto-selection for simplicity**: `Mod()` just works
2. **Pin backend for consistency**: `Mod(backend='dev-tools')`
3. **Handle failures gracefully**: Check `is_available()` first
4. **Match backend to task**: dev-tools for files, claude-code for analysis
5. **Reuse instances**: Create once, use many times

## 🔗 Backend-Specific Docs

### Claude Code CLI
- Requires: `brew install anthropics/claude/claude`
- API Key: Optional (uses Claude Max)
- Models: sonnet, opus, haiku

### Dev Tools
- Requires: mod framework (built-in)
- API Key: Not required
- Tools: bash, read, write, edit, grep, glob, etc.

### Codex
- Requires: `pip install openai`
- API Key: Required (OPENAI_API_KEY)
- Models: gpt-4, gpt-3.5-turbo

## 🚦 Migration Guide

### Before (single backend)
```python
from claude import Mod
mod = Mod()  # Always used Claude Code CLI
```

### After (multi-backend)
```python
from claude import Mod

# Still works exactly the same!
mod = Mod()  # Auto-selects best backend

# But now you can also:
mod = Mod(backend='dev-tools')  # Explicit selection
mod.switch_backend('codex')     # Runtime switching
```

**Your existing code continues to work!** The interface is identical.

## ❓ FAQ

**Q: Which backend should I use?**
A: Use `Mod()` without arguments - it auto-selects the best one.

**Q: Can I use multiple backends in one script?**
A: Yes! Create separate instances: `claude = Mod(backend='claude-code')`, `dev = Mod(backend='dev-tools')`

**Q: What if my backend isn't available?**
A: Use `auto_install=False` to prevent installation, or catch `RuntimeError` and switch backends.

**Q: How do I add support for X?**
A: Extend the `Backend` class and register it. See [custom_backend_example.py](examples/custom_backend_example.py).

**Q: Does this break existing code?**
A: No! The interface is identical. Existing code works without changes.

## 🎉 Benefits

✅ **Works everywhere** - No more "Claude CLI not installed" errors
✅ **Flexible** - Use the right tool for each task
✅ **Portable** - Your code runs in any environment
✅ **Extensible** - Add new backends easily
✅ **Resilient** - Automatic fallback if one backend fails

---

**Next Steps:**
1. Try the auto-selection: `mod = Mod()`
2. List available backends: `Mod.list_backends()`
3. Run examples: `python examples/multi_backend_example.py`
4. Read full docs: [BACKENDS.md](BACKENDS.md)
