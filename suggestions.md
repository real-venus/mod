# Suggestions

## Critical

### Flatten redundant directory nesting
- `core/router/router/router.py` → `core/router/router.py`
- `core/store/store/store.py` → `core/store/store.py`
- `core/api/api/api.py` → `core/api/api.py`
- Same pattern for worker, cache, etc.

### Break up `mod.py` (2,000+ lines)
The `Mod` class does everything. Split into focused managers:
- **PathManager** — abspath, relpath, folders, files, glob, dirpath
- **ModuleLoader** — mod, obj, import_mod, search, tree
- **CryptoManager** — encrypt, decrypt, sign, verify
- **StorageManager** — put, get, put_json, get_json
- **Introspector** — schema, fnschema, fns, code, classes
- **ProcessManager** — start, kill, serve, deploy

### Break up `utils.py` (2,700+ lines)
Split into submodules:
```
core/utils/
├── __init__.py       # re-exports for compat
├── networking.py     # ip, ports, free_port, kill_port
├── crypto.py         # hash, bytes2str, str2bytes
├── system.py         # cpu_info, memory_info, disk_info, gpu_info
├── convert.py        # python2str, bytes2dict, str2python
├── file.py           # file2text, put_text, get_text
├── async_ops.py      # gather, wait, thread, executor
├── process.py        # cmd, proc, kill_process
└── math.py           # mean, median, stdev
```

## High

### Replace string-based function resolution
Current pattern everywhere:
```python
self.fn('pm.docker/build')(*args)
self.fn('client/call')('api/call', ...)
```
No IDE support, no type checking, impossible to refactor. Use direct imports or dependency injection instead.

### Fix error handling
Too many bare `except Exception: pass` blocks silently swallowing errors. Use specific exceptions and log failures.

### Add tests for core modules
Only 5 test files exist for the entire core. Missing coverage:
- API endpoints
- Server lifecycle
- Router logic
- Auth/permissions
- Process manager
- Key management (security-critical)
- Crypto roundtrips

### Add type checking
- Python: add mypy, type hints are inconsistent
- TypeScript: enable strict mode, reduce `any` usage

## Medium

### Consolidate Docker setup
Multiple scattered `docker-compose.yml` files (api, app, chain, pm, etc). Unify into one orchestrated compose at the root with profiles for different services.

### Dependency cleanup (pyproject.toml)
- 45+ direct deps, some version ranges too broad (`web3>=6.0.0`)
- Pin security-critical libs: `pycryptodome`, `eth-keys`, `cryptography`
- Split into proper optional groups: `core`, `blockchain`, `ai`, `gpu`
- `black==22.3` is old, update dev tooling

### Improve caching
- `tree_cache` dict is unbounded in memory
- File cache at `~/.mod/tree/` has no invalidation strategy beyond mtime
- Tree building is O(n) per orbit — consider filesystem watchers for large codebases

### Next.js app structure
- Inconsistent route naming: `[cid]`, `[module]`, `[user]`, `[mod]`
- Context scattered across 12 files
- Components spread across feature dirs with no shared component lib
- Token refresh logic distributed across multiple hooks/contexts

## Low Priority

### CI/CD
- No GitHub Actions workflows visible
- No automated test/lint on PRs
- No deployment automation

### Documentation
- No architecture diagram for the orbit system (inner/outer/core)
- No explanation of module loading flow
- No OpenAPI/Swagger generation for the API

### Constants
Replace magic numbers/strings:
- `depth=10` defaults
- IPFS hash detection: `text.startswith('Qm') and len(text) == 46`
- Hardcoded port ranges

### Key management
- No key rotation mechanism
- No key expiry
- No unified key provider interface across ED25519/ECDSA/SR25519/Solana
