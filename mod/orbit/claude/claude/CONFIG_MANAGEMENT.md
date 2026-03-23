# Module Configuration Management

Tools for managing config.json files across all orbit modules with app/api directories.

## Quick Start

### 1. Check current status
```bash
python3 list_module_configs.py
```

### 2. Preview changes (dry-run)
```bash
python3 update_configs.py
```

### 3. Apply updates
```bash
python3 update_configs.py --apply
```

## Tools Overview

### list_module_configs.py
Lists all modules and their current configuration status.

**Usage:**
```bash
# Show modules with app/api only
python3 list_module_configs.py

# Show all modules
python3 list_module_configs.py --all
```

**Output:**
- Module name
- Has API directory: ✓/✗
- Has App directory: ✓/✗
- Has config.json: ✓/✗
- Current URLs (if configured)

### update_configs.py
Updates config.json files for modules with app/api directories.

**Usage:**
```bash
# Dry-run (preview changes)
python3 update_configs.py

# Apply changes
python3 update_configs.py --apply

# Update specific module only
python3 update_configs.py --module=claude --apply
```

**What it does:**
- Scans orbit directory for modules with `app/` or `api/` directories
- Assigns unique ports for each module
- Creates or updates `config.json` with:
  - `urls.api` - API server URL (if api/ exists)
  - `urls.app` - App server URL (if app/ exists)
  - `name` - Module name (if not present)
- Preserves existing config fields
- Pretty-prints JSON with 2-space indentation

## Port Assignment Strategy

### Default Ports
- **API**: Starting at 8800, increments by 2 (8800, 8802, 8804...)
- **App**: Starting at 8900, increments by 2 (8900, 8902, 8904...)

### Custom Port Assignments
Some modules have custom port assignments defined in `CUSTOM_PORTS`:

```python
CUSTOM_PORTS = {
    'claude': {'api': 8820, 'app': 8821},
    # Add more as needed
}
```

To add custom ports for a module, edit `update_configs.py` and add to the `CUSTOM_PORTS` dictionary.

## Configuration Structure

The tool ensures each module's `config.json` has this structure:

```json
{
  "name": "module-name",
  "urls": {
    "api": "http://localhost:8820",
    "app": "http://localhost:8821"
  },
  "fns": [...],
  "endpoints": {...}
}
```

Only `urls.api` or `urls.app` are added based on whether the module has those directories.

## Examples

### Example 1: Update all modules
```bash
# Preview
python3 update_configs.py

# Review output, then apply
python3 update_configs.py --apply
```

### Example 2: Update single module
```bash
python3 update_configs.py --module=uniswap --apply
```

### Example 3: Check status after update
```bash
python3 list_module_configs.py
```

## Integration with Mod Framework

After updating configs, modules can be started with their assigned ports:

```python
import mod as m

# Load module config
config = m.get('claude/config')

# Start app on configured port
app_url = config['urls']['app']  # http://localhost:8821
```

Or via CLI:
```bash
# Start claude app
m serve claude/app

# Start claude API
m serve claude/api
```

## Adding New Modules

When creating a new module with app/api:

1. Create module directory in `orbit/`
2. Add `app/` or `api/` subdirectory
3. Run `python3 update_configs.py --module=yourmodule --apply`
4. Ports will be auto-assigned or use `CUSTOM_PORTS` if needed

## Troubleshooting

### "No modules found"
- Make sure you're running from within the `claude/claude` directory
- Or update the `orbit_path` calculation in the scripts

### "Config already has different URLs"
- The tool shows what would change in dry-run mode
- Review changes before using `--apply`
- Custom ports take precedence over auto-assignment

### Port conflicts
- Check if ports are already in use: `lsof -i :8820`
- Update `CUSTOM_PORTS` to use different ports
- Or modify `BASE_API_PORT` and `BASE_APP_PORT`

## See Also

- [Module Architecture](../ARCHITECTURE.md)
- [Module Creation Guide](../MODULE_CREATION.md)
- [Server Management](../server/README.md)
