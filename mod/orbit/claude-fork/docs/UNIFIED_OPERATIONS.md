# Unified Operations Architecture

## Overview

The Claude module uses a **unified operation model** where all operations (read-only analysis and write operations) flow through the same `forward()` method. There is no separate "standard" vs "edit" backend - instead, permission requirements are determined by the operation type.

## Architecture

### Single Backend System

All operations use the same Claude Code CLI backend via the `forward()` method:

```python
def forward(
    query: str,
    requires_owner: bool = None,  # Auto-detect or explicit
    key = None,                   # For permission checks
    store_ipfs: bool = False,     # Auto-store to IPFS
    **kwargs
) -> Union[str, Dict[str, Any]]:
```

### Permission Model

Operations are classified into two categories:

#### 1. Read-Only Operations (No Permission Required)
- `analyze_code()` - Code analysis
- `debug()` - Issue investigation
- `ask()` - General queries

These operations set `requires_owner=False` explicitly.

#### 2. Write Operations (Requires Owner)
- `edit_file()` - File modifications
- `generate_code()` - Code generation
- `refactor()` - Code refactoring
- Any operation with keywords: edit, modify, change, update, fix, add, remove, delete

These operations set `requires_owner=True` explicitly.

### Auto-Detection

If `requires_owner` is not explicitly set, the system auto-detects based on query keywords:

```python
if requires_owner is None:
    # Auto-detect based on query keywords
    requires_owner = any(keyword in query.lower() for keyword in [
        'edit', 'modify', 'change', 'update', 'refactor',
        'fix', 'add', 'remove', 'delete'
    ])
```

## Benefits of Unified Architecture

1. **Single Code Path**: All operations share the same execution logic, making the codebase simpler and easier to maintain

2. **Consistent Behavior**: Stream output, IPFS storage, and error handling work the same way for all operations

3. **Flexible Permissions**: Operations can explicitly declare permission requirements or let the system auto-detect

4. **Automatic IPFS Storage**: Write operations automatically store results to IPFS for version tracking

5. **Clear Separation**: Read vs write operations are clearly distinguished through the `requires_owner` flag

## Usage Examples

### Explicit Permission Control

```python
mod = Mod(owner="0xYourAddress")

# Read-only - no permission check
result = mod.forward(
    query="Analyze the performance of main.py",
    requires_owner=False
)

# Write operation - requires owner
result = mod.forward(
    query="Add error handling to parse_config",
    key=my_key,
    requires_owner=True,
    store_ipfs=True
)
```

### Using Convenience Methods

```python
# Read-only operations
analysis = mod.analyze_code(path="./src", focus="security")
debug_info = mod.debug(path="./src", issue_description="Login fails")

# Write operations (require owner)
mod.edit_file(
    file_path="utils.py",
    instructions="Add type hints",
    key=my_key
)

mod.generate_code(
    description="Create a REST API endpoint",
    path="./api",
    key=my_key
)
```

## Implementation Details

### Permission Check Flow

1. Method called (e.g., `edit_file()`)
2. Sets `requires_owner=True` explicitly
3. Calls `forward()` with the flag
4. `forward()` checks ownership via `require_owner()`
5. If check passes, executes Claude Code CLI
6. Optionally stores result to IPFS
7. Returns result with CID if stored

### IPFS Integration

Write operations automatically trigger IPFS storage when `store_ipfs=True`:

```python
if store_ipfs and requires_owner:
    ipfs_data = {
        'query': query,
        'result': result_data,
        'work_dir': work_dir,
        'model': model,
        'description': description
    }
    cid = self._store_to_ipfs(ipfs_data, description)
```

## Migration Notes

If you were previously using separate "standard" and "edit" configurations:

1. **No Changes Required**: The unified system maintains backward compatibility
2. **Explicit Control**: You can now explicitly set `requires_owner` on any operation
3. **Simplified Config**: No need to configure separate backends for different operation types

## Future Enhancements

Potential improvements to the unified system:

1. **Granular Permissions**: Support role-based access control beyond just owner
2. **Operation Auditing**: Track all operations (read and write) to IPFS
3. **Rate Limiting**: Apply different rate limits to read vs write operations
4. **Custom Backends**: Pluggable backend system for different AI providers (see `backends.py`)
