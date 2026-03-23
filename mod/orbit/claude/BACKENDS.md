## Pluggable Backend Architecture

The claude module now supports multiple AI code backends, making it super modular and extensible. You can switch between Claude Code CLI, dev module tools, OpenAI Codex, or even add your own custom backends.

## Quick Start

```python
from claude import Mod

# Auto-select best available backend
mod = Mod()

# Or explicitly choose a backend
mod = Mod(backend='claude-code')  # Official Claude Code CLI
mod = Mod(backend='dev-tools')     # Dev module tools
mod = Mod(backend='codex', api_key='sk-...')  # OpenAI Codex

# Use it the same way regardless of backend
result = mod.analyze_code(focus="security")
```

## Available Backends

### 1. Claude Code CLI (`claude-code`)

**Default backend** - Official Claude Code CLI via Anthropic.

```python
mod = Mod(backend='claude-code', api_key='your_anthropic_key')
result = mod.forward("Refactor utils.py to use async")
```

**Features:**
- Full Claude Code CLI functionality
- Streams output in real-time
- Supports sonnet, opus, haiku models
- Auto-installs via Homebrew
- Uses your Claude Max subscription or API key

**When to use:**
- You have Claude Max subscription
- Need the most integrated Claude experience
- Want official Anthropic support

### 2. Dev Tools Backend (`dev-tools`)

**Mod framework native** - Uses dev module's tool ecosystem.

```python
mod = Mod(backend='dev-tools')
result = mod.forward("Find all TODO comments and create issues")
```

**Features:**
- Uses bash, grep, glob, read, write, edit tools
- AI orchestration via ask tool
- No external CLI required
- Fully integrated with mod framework

**When to use:**
- Working within mod framework
- Want tight integration with other mod modules
- Need access to dev tool primitives
- Don't want external dependencies

### 3. Codex Backend (`codex`)

**OpenAI powered** - Uses GPT-4 or GPT-3.5-turbo for code tasks.

```python
mod = Mod(backend='codex', api_key='sk-your_openai_key')
result = mod.forward("Explain this code and suggest improvements")
```

**Features:**
- GPT-4 code understanding
- Streaming support
- No CLI installation required
- Works anywhere with OpenAI access

**When to use:**
- You prefer OpenAI models
- Need GPT-4's reasoning capabilities
- Working in environments without Claude CLI
- Want to compare different models

## Backend Selection

### Auto-Selection (Recommended)

```python
# Automatically picks the best available backend
mod = Mod()  # Tries: claude-code → dev-tools → codex
```

Auto-selection order:
1. **Claude Code CLI** - Most integrated, default
2. **Dev Tools** - Mod framework native
3. **Codex** - OpenAI fallback

### Explicit Selection

```python
# Choose specific backend
mod = Mod(backend='dev-tools')

# Switch backends at runtime
mod.switch_backend('codex', api_key='sk-...')
```

### List Available Backends

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

## Unified Interface

All backends share the same interface, so your code works with any backend:

```python
# These work with ANY backend
mod.analyze_code(focus="security")
mod.generate_code("Create a REST API endpoint")
mod.refactor("Extract database logic to repository pattern")
mod.debug("NoneType error on line 42")
mod.edit_file("app.py", "Add error handling")
mod.batch_process(["Check security", "Add tests", "Update docs"])
```

## Creating Custom Backends

Extend the `Backend` abstract base class:

```python
from claude.backends import Backend, registry
import subprocess

class MyCustomBackend(Backend):
    @property
    def name(self) -> str:
        return "my-backend"

    @property
    def description(self) -> str:
        return "My custom AI code backend"

    def is_available(self) -> bool:
        # Check if your backend is ready
        return True

    def install(self) -> bool:
        # Install your backend
        return True

    def forward(self, query: str, path: str = None,
                model: str = "default", **kwargs):
        # Execute the query using your backend
        # Return results in any format
        return {"result": "...", "success": True}

# Register your backend
registry.register('my-backend', MyCustomBackend)

# Use it
mod = Mod(backend='my-backend')
```

## Backend Comparison

| Feature | claude-code | dev-tools | codex |
|---------|-------------|-----------|-------|
| Installation | Homebrew | Built-in | pip install |
| API Key | Optional | No | Required |
| Streaming | ✓ | ✓ | ✓ |
| Model Choice | sonnet/opus/haiku | configurable | gpt-4/gpt-3.5 |
| Tool Access | Full CLI | bash/read/write/etc | None (AI only) |
| Cost | Claude pricing | OpenRouter | OpenAI pricing |
| Offline Capable | No | Partially | No |

## Advanced Usage

### Backend-Specific Options

Pass backend-specific options through kwargs:

```python
# Claude Code specific
mod = Mod(backend='claude-code')
result = mod.forward(
    "Analyze code",
    bypass_permissions=True,
    output_format="json",
    additional_options={'memory': '8GB'}
)

# Codex specific
mod = Mod(backend='codex')
result = mod.forward(
    "Explain this function",
    temperature=0.3,
    max_tokens=2000
)
```

### Multiple Backends in One Script

```python
# Use different backends for different tasks
claude = Mod(backend='claude-code')
dev = Mod(backend='dev-tools')
codex = Mod(backend='codex', api_key='sk-...')

# Fast file operations with dev tools
files = dev.forward("List all Python files with TODOs")

# Deep analysis with Claude
analysis = claude.analyze_code(focus="architecture")

# Code explanation with GPT-4
explanation = codex.forward("Explain the authentication flow")
```

### Fallback Chain

```python
def execute_with_fallback(query: str):
    """Try multiple backends until one succeeds"""
    backends = ['claude-code', 'dev-tools', 'codex']

    for backend_name in backends:
        try:
            mod = Mod(backend=backend_name)
            return mod.forward(query)
        except Exception as e:
            print(f"Backend {backend_name} failed: {e}")
            continue

    raise RuntimeError("All backends failed")
```

## Environment Variables

Configure backends via environment:

```bash
# Claude Code
export ANTHROPIC_API_KEY=your_key
export ANTHROPIC_AUTH_TOKEN=your_token

# Codex
export OPENAI_API_KEY=sk-your_key

# Dev Tools (uses OpenRouter for ask tool)
export OPENROUTER_API_KEY=your_key
```

## Troubleshooting

### Backend Not Available

```python
mod = Mod(backend='claude-code')
if not mod.backend.is_available():
    mod.backend.install()  # Try to install
```

### Switch If Unavailable

```python
try:
    mod = Mod(backend='claude-code')
except RuntimeError:
    print("Claude Code not available, using dev-tools")
    mod = Mod(backend='dev-tools')
```

### Check All Backends

```python
backends = Mod.list_backends()
available = [b for b in backends if b['available']]
print(f"Available backends: {[b['name'] for b in available]}")
```

## Best Practices

1. **Use auto-selection for portability**: `Mod()` works everywhere
2. **Pin backend for consistency**: `Mod(backend='dev-tools')` for reproducible results
3. **Handle unavailability gracefully**: Check status and provide fallbacks
4. **Match backend to task**:
   - `claude-code`: Complex refactoring, deep analysis
   - `dev-tools`: File operations, quick searches
   - `codex`: Code explanation, documentation
5. **Cache backend instances**: Reuse `Mod()` objects instead of recreating

## Examples

### Security Audit with Multiple Backends

```python
from claude import Mod

def comprehensive_audit(repo_path: str):
    """Run security audit using multiple backends for thorough coverage"""

    # Use Claude Code for deep analysis
    claude = Mod(backend='claude-code')
    deep_analysis = claude.analyze_code(path=repo_path, focus="security")

    # Use dev tools for pattern matching
    dev = Mod(backend='dev-tools')
    pattern_scan = dev.forward(
        "Search for hardcoded secrets, SQL injection, XSS vulnerabilities",
        path=repo_path
    )

    # Use Codex for explanation
    codex = Mod(backend='codex')
    explanation = codex.forward(
        f"Explain these findings and prioritize by severity:\n{deep_analysis}",
        path=repo_path
    )

    return {
        'deep_analysis': deep_analysis,
        'pattern_scan': pattern_scan,
        'explanation': explanation
    }
```

### Portable Script

```python
from claude import Mod

def portable_refactor(repo_path: str):
    """This works with any available backend"""
    mod = Mod()  # Auto-selects best backend

    print(f"Using backend: {mod.backend.name}")

    result = mod.refactor(
        instructions="Extract repeated logic into helper functions",
        path=repo_path
    )

    return result
```

## Future Backends

Planned backend integrations:
- **GitHub Copilot**: Use Copilot programmatically
- **Cursor**: Integrate with Cursor's AI
- **Local models**: Run Llama/Mistral locally
- **Gemini**: Google's code models
- **Custom agents**: Your own AI agents

## Contributing Backends

To contribute a new backend:

1. Create a class extending `Backend`
2. Implement all abstract methods
3. Add tests
4. Submit PR with docs

See `claude/backends.py` for examples.
