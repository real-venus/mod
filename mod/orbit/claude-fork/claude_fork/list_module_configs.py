#!/usr/bin/env python3
"""
List all modules and their current config.json status.
"""
import json
from pathlib import Path
from typing import Dict, Optional

def get_orbit_modules():
    """Find all modules in orbit directory."""
    orbit_path = Path(__file__).parent.parent.parent
    modules = []

    for item in orbit_path.iterdir():
        if item.is_dir() and not item.name.startswith(('.', '_')):
            modules.append(item)

    return sorted(modules)

def check_module(module_path: Path) -> Dict:
    """Check module structure and config."""
    config_path = module_path / 'config.json'
    has_config = config_path.exists()

    config = {}
    if has_config:
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
        except json.JSONDecodeError:
            config = {'error': 'Invalid JSON'}

    return {
        'name': module_path.name,
        'has_api': (module_path / 'api').exists(),
        'has_app': (module_path / 'app').exists(),
        'has_config': has_config,
        'config': config
    }

def main(show_all: bool = False):
    """List all modules with their config status."""
    modules = get_orbit_modules()

    print("\n" + "=" * 80)
    print("Module Configuration Status")
    print("=" * 80 + "\n")

    modules_with_ui = []
    modules_without_ui = []

    for module in modules:
        info = check_module(module)

        if info['has_api'] or info['has_app']:
            modules_with_ui.append(info)
        else:
            modules_without_ui.append(info)

    # Display modules with UI/API first
    print(f"Modules with App/API ({len(modules_with_ui)}):")
    print("-" * 80)

    for info in modules_with_ui:
        print(f"\n📦 {info['name']}")
        print(f"   API: {'✓' if info['has_api'] else '✗'}")
        print(f"   App: {'✓' if info['has_app'] else '✗'}")
        print(f"   Config: {'✓' if info['has_config'] else '✗'}")

        if info['has_config']:
            urls = info['config'].get('urls', {})
            if urls:
                if 'api' in urls:
                    print(f"   → API URL: {urls['api']}")
                if 'app' in urls:
                    print(f"   → App URL: {urls['app']}")
            else:
                print("   ⚠️  No URLs configured")

    # Display modules without UI if requested
    if show_all:
        print(f"\n\nModules without App/API ({len(modules_without_ui)}):")
        print("-" * 80)
        for info in modules_without_ui:
            config_status = "✓" if info['has_config'] else "✗"
            print(f"  {info['name']:<30} Config: {config_status}")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    import sys
    show_all = '--all' in sys.argv or '-a' in sys.argv

    if '--help' in sys.argv or '-h' in sys.argv:
        print("Usage: python list_module_configs.py [OPTIONS]")
        print("\nOptions:")
        print("  --all, -a    Show all modules including those without app/api")
        print("  --help, -h   Show this help")
        sys.exit(0)

    main(show_all=show_all)
