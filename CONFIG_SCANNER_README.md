# Config Scanner & Remote Jobs - Quick Reference

## What Was Implemented

### ✅ Automated Config Scanning
- Scans module configs every 1 second
- Detects changes using file mtime + SHA256 hash
- Efficient caching to avoid redundant reads
- Automatic sync to routy gateway

### ✅ Remote Job Execution
- Router automatically routes jobs to remote servers
- Namespace-based URL lookup
- Transparent local/remote execution
- Full task tracking for both modes

### ✅ Registry Synchronization
- Routy monitors namespace changes every 1 second
- Hash-based change detection for registry
- Automatic route updates
- Cross-module cache sharing for performance

## Quick Start

### Run Tests
```bash
python test_config_scanner.py
```

Expected output: `5/5 tests passed`

### Execute Remote Jobs
```python
import mod as m

# Initialize API
api = m.mod('api')()

# Synchronous job
result = api.run_job('module/function', {'param': 'value'})

# Asynchronous job
cid = api.submit_job('module/function', {'param': 'value'})
```

### Monitor Config Cache
```python
from mod.core.api.mod import Api

# View cached configs
print(Api._config_cache)

# View file modification times
print(Api._config_cache_time)
```

### Manual Sync
```python
routy = m.mod('routy')()
routy.sync(use_cache=True)  # Fast (uses cache)
```

## Key Features

### Config Scanner (API Module)
- **File**: `mod/core/api/mod.py`
- **Worker**: `_config_scanner_worker()` (daemon thread)
- **Interval**: 1 second
- **Cache**: Class-level `_config_cache` and `_config_cache_time`

### Remote Execution (Router)
- **File**: `mod/core/api/router/router.py`
- **Method**: `_get_remote_url(mod)` - namespace lookup
- **Routing**: Automatic local vs remote decision
- **Tracking**: `task['remote']` and `task['remote_url']` fields

### Auto Sync (Routy)
- **File**: `mod/orbit/routy/routy/mod.py`
- **Worker**: `_sync_worker()` (daemon thread)
- **Interval**: 1 second
- **Cache**: Uses API module's `_config_cache` for fast lookups

## Performance

All workers use efficient caching:
- Only read files if mtime changed
- Only hash if file content changed
- Only sync if hash changed
- Shared caches across modules

Expected overhead: ~1-5ms per scan cycle (with caching)

## Files Modified

1. `mod/core/api/mod.py` - Config scanner + job execution
2. `mod/core/api/router/router.py` - Remote job routing
3. `mod/orbit/routy/routy/mod.py` - Auto sync worker
4. `test_config_scanner.py` - Test suite (new file)
5. `IMPLEMENTATION_SUMMARY.md` - Full documentation (new file)
6. `CONFIG_SCANNER_README.md` - This file (new)

## Troubleshooting

### Workers Not Starting
Check if threads initialized:
```python
api = m.mod('api')()
print('config_scanner' in api.threads)  # Should be True

routy = m.mod('routy')()
print(hasattr(routy, '_worker_thread'))  # Should be True
```

### Cache Not Working
Verify cache structures:
```python
from mod.core.api.mod import Api
print(hasattr(Api, '_config_cache'))  # Should be True
```

### Routy Not Syncing
1. Check if routy is running: `m routy/status`
2. Start routy: `m routy/serve`
3. Check logs: `/tmp/routy/api.log`

## Architecture

```
Module Config Changes
         ↓
API Config Scanner (1s) → Cache → Routy Sync
         ↓
Registry Updates
         ↓
Routy Worker (1s) → Route Updates
         ↓
Router Job Execution → Remote/Local Decision
```

## What's Next?

The implementation is complete and tested. All components are working:
- ✅ Config scanning with caching
- ✅ Remote job execution
- ✅ Registry synchronization
- ✅ Cross-module cache sharing
- ✅ Test suite passing

To see it in action:
1. Start routy: `m routy/serve`
2. Start a module API: `m <module>/serve`
3. Submit a job: `api.run_job('module/function', params)`
4. Watch the automatic routing happen!
