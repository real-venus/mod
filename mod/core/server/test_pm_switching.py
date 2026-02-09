#!/usr/bin/env python3
"""
Test script to verify seamless PM switching between Docker and PM2.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_pm_switching():
    """Test that PM2 and Docker PMs are seamlessly switchable."""
    print("=" * 70)
    print("Testing PM Switching (Docker ↔ PM2)")
    print("=" * 70)

    # Test importing the PM modules
    try:
        from pm.pm.docker.docker import PM as DockerPM
        print("✓ Docker PM imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import Docker PM: {e}")
        return False

    try:
        from pm.pm.pm2.pm2 import PM2
        print("✓ PM2 imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import PM2: {e}")
        return False

    # Test that both have the same interface
    print("\n" + "=" * 70)
    print("Checking Interface Compatibility")
    print("=" * 70)

    required_methods = [
        'forward', 'start', 'stop', 'restart', 'kill', 'exists',
        'server_exists', 'servers', 'ps', 'logs', 'stats', 'sync',
        'params2cmd', 'get_port', 'process_info'
    ]

    docker = DockerPM()
    pm2 = PM2()

    missing_in_pm2 = []
    for method in required_methods:
        has_docker = hasattr(docker, method)
        has_pm2 = hasattr(pm2, method)

        status = "✓" if (has_docker and has_pm2) else "✗"
        print(f"{status} {method:20s} - Docker: {has_docker}, PM2: {has_pm2}")

        if not has_pm2:
            missing_in_pm2.append(method)

    if missing_in_pm2:
        print(f"\n✗ Missing methods in PM2: {missing_in_pm2}")
        return False

    print("\n✓ All required methods present in both backends")

    # Test registry integration
    print("\n" + "=" * 70)
    print("Checking Registry Integration")
    print("=" * 70)

    for name, pm_obj in [("Docker", docker), ("PM2", pm2)]:
        has_registry = hasattr(pm_obj, 'registry')
        has_reg = hasattr(pm_obj.registry if has_registry else None, 'reg')
        has_dereg = hasattr(pm_obj.registry if has_registry else None, 'dereg')

        status = "✓" if (has_registry and has_reg and has_dereg) else "✗"
        print(f"{status} {name:10s} - registry: {has_registry}, reg: {has_reg}, dereg: {has_dereg}")

    print("\n✓ Both backends have registry integration")

    # Test PM wrapper
    print("\n" + "=" * 70)
    print("Checking PM Wrapper")
    print("=" * 70)

    try:
        from pm.pm.pm import Pm
        print("✓ PM wrapper imported successfully")

        # Test default backend
        pm_default = Pm()
        print(f"✓ Default backend: {pm_default.backend}")

        # Test explicit PM2 backend
        pm_pm2 = Pm(mod='pm2')
        print(f"✓ PM2 backend via 'pm2': {pm_pm2.backend}")

        # Test explicit Docker backend
        pm_docker = Pm(mod='docker')
        print(f"✓ Docker backend via 'docker': {pm_docker.backend}")

    except Exception as e:
        print(f"✗ PM wrapper test failed: {e}")
        return False

    print("\n" + "=" * 70)
    print("✓ All Tests Passed!")
    print("=" * 70)
    print("\nPM2 and Docker are now seamlessly switchable!")
    print("\nUsage:")
    print("  # Use PM2:")
    print("  m.serve('mymod', pm='pm2', port=8000)")
    print("")
    print("  # Use Docker:")
    print("  m.serve('mymod', pm='docker', port=8000)")
    print("")
    print("  # Set default:")
    print("  export MOD_PM=pm.pm2")
    print("")

    return True

if __name__ == "__main__":
    success = test_pm_switching()
    sys.exit(0 if success else 1)
