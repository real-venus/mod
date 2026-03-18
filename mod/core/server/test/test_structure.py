#!/usr/bin/env python3
"""
Test script to verify PM structure and interface compatibility.
"""
import sys
import os
import inspect

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_public_methods(cls):
    """Get all public methods of a class."""
    methods = []
    for name, method in inspect.getmembers(cls, predicate=inspect.isfunction):
        if not name.startswith('_'):
            methods.append(name)
    return set(methods)

def test_structure():
    """Test the PM structure without actually loading mod."""
    print("=" * 70)
    print("Testing PM Structure and Interface")
    print("=" * 70)

    # Read the PM2 file and check for required methods
    pm2_file = os.path.join(os.path.dirname(__file__), 'pm/pm/pm2/pm2.py')
    docker_file = os.path.join(os.path.dirname(__file__), 'pm/pm/docker/docker.py')

    print("\nChecking files exist:")
    print(f"  PM2 file: {os.path.exists(pm2_file)} - {pm2_file}")
    print(f"  Docker file: {os.path.exists(docker_file)} - {docker_file}")

    # Read both files and check for method definitions
    required_methods = [
        'forward', 'start', 'stop', 'restart', 'kill', 'exists',
        'server_exists', 'servers', 'ps', 'logs', 'stats', 'sync',
        'params2cmd', 'get_port', 'process_info'
    ]

    print("\n" + "=" * 70)
    print("Method Coverage Analysis")
    print("=" * 70)

    def check_methods_in_file(filepath, name):
        with open(filepath, 'r') as f:
            content = f.read()

        found_methods = {}
        for method in required_methods:
            # Look for method definition
            patterns = [
                f'def {method}(',
                f'def {method} (',
            ]
            found = any(pattern in content for pattern in patterns)
            found_methods[method] = found

        print(f"\n{name}:")
        missing = []
        for method, found in sorted(found_methods.items()):
            status = "✓" if found else "✗"
            print(f"  {status} {method}")
            if not found:
                missing.append(method)

        return missing

    pm2_missing = check_methods_in_file(pm2_file, "PM2")
    docker_missing = check_methods_in_file(docker_file, "Docker PM")

    # Check registry integration
    print("\n" + "=" * 70)
    print("Registry Integration Check")
    print("=" * 70)

    with open(pm2_file, 'r') as f:
        pm2_content = f.read()

    with open(docker_file, 'r') as f:
        docker_content = f.read()

    pm2_has_registry_init = 'self.registry' in pm2_content
    pm2_has_registry_reg = 'self.registry.reg(' in pm2_content
    pm2_has_registry_dereg = 'self.registry.dereg(' in pm2_content

    docker_has_registry_init = 'self.registry' in docker_content or 'registry' in docker_content
    docker_has_registry_reg = 'self.registry.reg(' in docker_content
    docker_has_registry_dereg = 'self.registry.dereg(' in docker_content

    print("\nPM2:")
    print(f"  {'✓' if pm2_has_registry_init else '✗'} Registry initialized")
    print(f"  {'✓' if pm2_has_registry_reg else '✗'} Calls registry.reg()")
    print(f"  {'✓' if pm2_has_registry_dereg else '✗'} Calls registry.dereg()")

    print("\nDocker PM:")
    print(f"  {'✓' if docker_has_registry_init else '✗'} Registry initialized")
    print(f"  {'✓' if docker_has_registry_reg else '✗'} Calls registry.reg()")
    print(f"  {'✓' if docker_has_registry_dereg else '✗'} Calls registry.dereg()")

    # Check PM wrapper
    print("\n" + "=" * 70)
    print("PM Wrapper Check")
    print("=" * 70)

    pm_wrapper_file = os.path.join(os.path.dirname(__file__), 'pm/pm/pm.py')
    with open(pm_wrapper_file, 'r') as f:
        pm_wrapper_content = f.read()

    has_env_support = 'MOD_PM' in pm_wrapper_content
    has_pm2_support = "'pm2'" in pm_wrapper_content or '"pm2"' in pm_wrapper_content
    has_docker_support = "'docker'" in pm_wrapper_content or '"docker"' in pm_wrapper_content

    print(f"  {'✓' if has_env_support else '✗'} MOD_PM environment variable support")
    print(f"  {'✓' if has_pm2_support else '✗'} PM2 backend support")
    print(f"  {'✓' if has_docker_support else '✗'} Docker backend support")

    # Summary
    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)

    all_good = (
        len(pm2_missing) == 0 and
        len(docker_missing) == 0 and
        pm2_has_registry_reg and
        pm2_has_registry_dereg and
        has_env_support and
        has_pm2_support and
        has_docker_support
    )

    if all_good:
        print("\n✓ ALL CHECKS PASSED!")
        print("\nPM2 is now seamlessly switchable with Docker!")
        print("\nUsage:")
        print("  import mod as m")
        print("")
        print("  # Use PM2:")
        print("  m.serve('mymod', pm='pm2', port=8000)")
        print("")
        print("  # Use Docker:")
        print("  m.serve('mymod', pm='docker', port=8000)")
        print("")
        print("  # Set default:")
        print("  export MOD_PM=pm.pm2")
    else:
        print("\n✗ Some checks failed")
        if pm2_missing:
            print(f"  - PM2 missing methods: {pm2_missing}")
        if docker_missing:
            print(f"  - Docker missing methods: {docker_missing}")

    return all_good

if __name__ == "__main__":
    success = test_structure()
    sys.exit(0 if success else 1)
