# Claude Module Quick Reference - Unified Operations

## TL;DR

All operations use the same `forward()` method. The only difference:
- **Read operations**: `requires_owner=False` (no permission check)
- **Write operations**: `requires_owner=True` (owner key required)

## Basic Usage

### Setup

```python
from claude import Mod

# Local development (no owner)
mod = Mod()

# Production (with owner)
mod = Mod(owner="0xYourAddress")
```

### Read Operations (No Permission Required)

```python
# Analyze code
result = mod.analyze_code(
    path="./src",
    focus="security"  # optional
)

# Debug issues
result = mod.debug(
    path="./src",
    issue_description="Login fails with 500 error",
    file_path="auth.py"  # optional
)

# General queries
response = mod.ask("What does this code do?")

# Direct forward call
result = mod.forward(
    query="Explain the architecture",
    requires_owner=False  # explicit
)
```

### Write Operations (Owner Required)

```python
import mod as m

# Get owner key
owner_key = m.key()

# Edit a file
result = mod.edit_file(
    file_path="utils.py",
    instructions="Add error handling",
    key=owner_key,
    store_ipfs=True  # default
)

# Generate code
result = mod.generate_code(
    description="Create a REST API endpoint",
    path="./api",
    key=owner_key
)

# Refactor code
result = mod.refactor(
    path="./src",
    instructions="Extract helper functions",
    target_files=["main.py", "utils.py"],  # optional
    key=owner_key
)
```

## See Full Documentation

- `UNIFIED_OPERATIONS.md` - Complete architecture
- `ARCHITECTURE_DIAGRAM.md` - Visual diagrams
- `examples/` - Working examples
- `README.md` - Full docs
