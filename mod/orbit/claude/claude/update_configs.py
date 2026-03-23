#!/usr/bin/env python3
"""
Update config.json files for all modules with app/api registration.
Automatically assigns ports and ensures consistent structure.
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Optional

# Base ports for auto-assignment
BASE_API_PORT = 8800
BASE_APP_PORT = 8900

# Modules with custom port assignments (override auto-assignment)
CUSTOM_PORTS = {
    'claude': {'api': 8820, 'app': 8821},
    # Add more custom assignments here as needed
}

def get_orbit_modules() -> List[Path]:
    """Find all modules in orbit directory."""
    orbit_path = Path(__file__).parent.parent.parent
    modules = []

    for item in orbit_path.iterdir():
        if item.is_dir() and not item.name.startswith(('.', '_')):
            modules.append(item)

    return sorted(modules)

def has_api_or_app(module_path: Path) -> Dict[str, bool]:
    """Check if module has api or app directories."""
    return {
        'api': (module_path / 'api').exists(),
        'app': (module_path / 'app').exists()
    }

def get_config_path(module_path: Path) -> Path:
    """Get path to module's config.json."""
    return module_path / 'config.json'

def load_config(config_path: Path) -> Dict:
    """Load existing config or return empty dict."""
    if config_path.exists():
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Could not parse {config_path}, creating new config")
            return {}
    return {}

def assign_ports(module_name: str, idx: int) -> Dict[str, int]:
    """Assign API and app ports for a module."""
    if module_name in CUSTOM_PORTS:
        return CUSTOM_PORTS[module_name]

    return {
        'api': BASE_API_PORT + idx * 2,
        'app': BASE_APP_PORT + idx * 2
    }

def update_module_config(module_path: Path, ports: Dict[str, int], has_dirs: Dict[str, bool], dry_run: bool = True) -> bool:
    """Update a module's config.json with URLs."""
    config_path = get_config_path(module_path)
    config = load_config(config_path)

    # Initialize urls section if needed
    if 'urls' not in config:
        config['urls'] = {}

    # Update URLs based on what directories exist
    updated = False
    if has_dirs['app']:
        app_url = f"http://localhost:{ports['app']}"
        if config['urls'].get('app') != app_url:
            config['urls']['app'] = app_url
            updated = True
            print(f"  App URL: {app_url}")

    if has_dirs['api']:
        api_url = f"http://localhost:{ports['api']}"
        if config['urls'].get('api') != api_url:
            config['urls']['api'] = api_url
            updated = True
            print(f"  API URL: {api_url}")

    # Add module name and description if not present
    if 'name' not in config:
        config['name'] = module_path.name
        updated = True

    if updated and not dry_run:
        # Write config with nice formatting
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"  ✓ Updated {config_path}")

    return updated

def main(dry_run: bool = True, filter_module: Optional[str] = None):
    """Update all module configs."""
    modules = get_orbit_modules()

    if filter_module:
        modules = [m for m in modules if m.name == filter_module]

    updated_count = 0
    port_idx = 0

    print("=" * 60)
    print("Module Config Update Tool")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")
    print()

    for module in modules:
        has_dirs = has_api_or_app(module)

        # Skip modules without app or api
        if not has_dirs['api'] and not has_dirs['app']:
            continue

        print(f"\n{module.name}:")
        print(f"  Has API: {has_dirs['api']}")
        print(f"  Has App: {has_dirs['app']}")

        ports = assign_ports(module.name, port_idx)
        port_idx += 1

        was_updated = update_module_config(module, ports, has_dirs, dry_run)
        if was_updated:
            updated_count += 1

    print("\n" + "=" * 60)
    print(f"Summary: {updated_count} module(s) would be updated" if dry_run else f"Updated {updated_count} module(s)")
    print("=" * 60)

    if dry_run:
        print("\nTo apply changes, run: python update_configs.py --apply")

if __name__ == '__main__':
    import sys

    dry_run = True
    filter_module = None

    # Parse simple command line args
    for arg in sys.argv[1:]:
        if arg in ['--apply', '-a']:
            dry_run = False
        elif arg.startswith('--module='):
            filter_module = arg.split('=')[1]
        elif arg in ['--help', '-h']:
            print("Usage: python update_configs.py [OPTIONS]")
            print("\nOptions:")
            print("  --apply, -a         Apply changes (default is dry-run)")
            print("  --module=NAME       Only update specific module")
            print("  --help, -h          Show this help")
            sys.exit(0)

    main(dry_run=dry_run, filter_module=filter_module)
