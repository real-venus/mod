#!/usr/bin/env python3
"""
Basic usage example for the MOD authentication and permission system.

This example demonstrates:
1. Setting up the owner
2. Creating authentication tokens
3. Verifying tokens
4. Checking permissions
5. Creating user directories
"""

import sys
from pathlib import Path

# Add mod to path
mod_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(mod_root))

import mod as m
from mod.core.server.auth.auth import (
    Auth,
    PermissionManager,
    AccessControl,
    AuthConfig
)


def example_1_setup_owner():
    """Example 1: Setup the owner address."""
    print("\n" + "="*60)
    print("Example 1: Setup Owner Address")
    print("="*60)

    config = AuthConfig()

    # Option 1: Use current user's key
    try:
        key = m.key()
        owner_address = key.address
        print(f"✓ Using current user's address: {owner_address}")
        config.set_owner_address(owner_address)
    except Exception as e:
        print(f"⚠ Could not get current address: {e}")
        # Option 2: Set manually
        owner_address = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
        print(f"✓ Setting owner address manually: {owner_address}")
        config.set_owner_address(owner_address)

    print(f"✓ Owner address configured")
    return owner_address


def example_2_create_token():
    """Example 2: Create an authentication token."""
    print("\n" + "="*60)
    print("Example 2: Create Authentication Token")
    print("="*60)

    # Create auth instance with a key
    auth = Auth(key='test.auth.example', crypto_type='ecdsa')

    # Generate a token with some data
    data = {
        'action': 'execute_module',
        'module': 'my_module',
        'timestamp': '2024-03-22'
    }

    token = auth.token(data=data)
    print(f"✓ Generated token: {token[:50]}...")

    return auth, token


def example_3_verify_token(auth, token):
    """Example 3: Verify an authentication token."""
    print("\n" + "="*60)
    print("Example 3: Verify Authentication Token")
    print("="*60)

    try:
        verified = auth.verify(token)
        user_address = verified['key']
        print(f"✓ Token verified successfully")
        print(f"  User address: {user_address}")
        print(f"  Data: {verified['data']}")
        return user_address
    except Exception as e:
        print(f"✗ Token verification failed: {e}")
        return None


def example_4_check_permissions(user_address, owner_address):
    """Example 4: Check module access permissions."""
    print("\n" + "="*60)
    print("Example 4: Check Module Permissions")
    print("="*60)

    pm = PermissionManager(owner_address=owner_address)

    # Test paths
    user_module = f"/Users/broski/mod/mod/orbit/_outer/{user_address}/my_module"
    other_user = "0x6478255b80b561b4d8d96c02ce86ffcebbb9d09e"
    other_module = f"/Users/broski/mod/mod/orbit/_outer/{other_user}/other_module"

    # Check user's own module
    print(f"\n1. User accessing their own module:")
    print(f"   Path: {user_module}")
    can_read = pm.can_access(user_address, user_module, 'read')
    can_write = pm.can_access(user_address, user_module, 'write')
    can_execute = pm.can_access(user_address, user_module, 'execute')
    print(f"   ✓ Can read: {can_read}")
    print(f"   ✓ Can write: {can_write}")
    print(f"   ✓ Can execute: {can_execute}")

    # Check other user's module
    print(f"\n2. User accessing another user's module:")
    print(f"   Path: {other_module}")
    can_read = pm.can_access(user_address, other_module, 'read')
    can_write = pm.can_access(user_address, other_module, 'write')
    can_execute = pm.can_access(user_address, other_module, 'execute')
    print(f"   ✗ Can read: {can_read}")
    print(f"   ✗ Can write: {can_write}")
    print(f"   ✗ Can execute: {can_execute}")

    # Check owner access
    print(f"\n3. Owner accessing any module:")
    print(f"   Path: {other_module}")
    can_read = pm.can_access(owner_address, other_module, 'read')
    can_write = pm.can_access(owner_address, other_module, 'write')
    can_execute = pm.can_access(owner_address, other_module, 'execute')
    print(f"   ✓ Can read: {can_read}")
    print(f"   ✓ Can write: {can_write}")
    print(f"   ✓ Can execute: {can_execute}")


def example_5_create_user_directory():
    """Example 5: Create a directory for a new user."""
    print("\n" + "="*60)
    print("Example 5: Create User Directory")
    print("="*60)

    pm = PermissionManager()

    # Create directory for a new user
    new_user = "0xnewuser1234567890abcdef"
    print(f"Creating directory for user: {new_user}")

    user_path = pm.get_user_path(new_user)
    print(f"✓ User path: {user_path}")
    print(f"  (Directory will be created when user registers their first module)")

    # List modules for a user
    user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
    modules = pm.list_user_modules(user1)
    print(f"\nModules for {user1}:")
    if modules:
        for module in modules:
            print(f"  • {module}")
    else:
        print("  (No modules yet)")


def example_6_access_control_helper():
    """Example 6: Using AccessControl helper in an API endpoint."""
    print("\n" + "="*60)
    print("Example 6: AccessControl Helper")
    print("="*60)

    ac = AccessControl()

    # Simulate an API request
    auth = Auth(key='test.api.user', crypto_type='ecdsa')
    token = auth.token(data={'action': 'execute'})

    module_path = "/Users/broski/mod/mod/orbit/_outer/0x7f46ae9b5a5e25110900a418376e021454c90f4a/my_module"

    print(f"API Request:")
    print(f"  Token: {token[:50]}...")
    print(f"  Module: {module_path}")
    print(f"  Operation: execute")

    # Verify access
    user_address, has_access = ac.verify_access(token, module_path, 'execute')

    print(f"\nVerification Result:")
    print(f"  User: {user_address}")
    print(f"  Has Access: {has_access}")

    # Check if user is owner
    is_owner = ac.is_owner(token)
    print(f"  Is Owner: {is_owner}")


def example_7_full_workflow():
    """Example 7: Complete authentication and permission workflow."""
    print("\n" + "="*60)
    print("Example 7: Complete Workflow")
    print("="*60)

    # Step 1: User generates token
    print("\n1. User generates authentication token")
    user_auth = Auth(key='test.user', crypto_type='ecdsa')
    user_address = user_auth.key.address
    token = user_auth.token(data={'action': 'execute_module', 'module': 'my_app'})
    print(f"   ✓ Token generated by user: {user_address}")

    # Step 2: Server receives and verifies token
    print("\n2. Server verifies token")
    server_auth = Auth()
    try:
        verified = server_auth.verify(token)
        print(f"   ✓ Token verified")
        print(f"   ✓ User authenticated: {verified['key']}")
    except Exception as e:
        print(f"   ✗ Verification failed: {e}")
        return

    # Step 3: Check permissions
    print("\n3. Server checks permissions")
    pm = PermissionManager()
    module_path = f"/Users/broski/mod/mod/orbit/_outer/{user_address}/my_app"

    if pm.can_access(user_address, module_path, 'execute'):
        print(f"   ✓ Permission granted")
        print(f"   ✓ User can execute module at: {module_path}")

        # Step 4: Execute module (simulated)
        print("\n4. Execute module")
        print(f"   ✓ Module execution would happen here")
        print(f"   ✓ User: {user_address}")
        print(f"   ✓ Module: my_app")
    else:
        print(f"   ✗ Permission denied")
        print(f"   ✗ User cannot access this module")


def main():
    """Run all examples."""
    print("\n" + "="*60)
    print("MOD Authentication & Permission System Examples")
    print("="*60)

    try:
        # Example 1: Setup
        owner_address = example_1_setup_owner()

        # Example 2: Create token
        auth, token = example_2_create_token()

        # Example 3: Verify token
        user_address = example_3_verify_token(auth, token)

        if user_address:
            # Example 4: Check permissions
            example_4_check_permissions(user_address, owner_address)

        # Example 5: User directories
        example_5_create_user_directory()

        # Example 6: Access control helper
        example_6_access_control_helper()

        # Example 7: Full workflow
        example_7_full_workflow()

        print("\n" + "="*60)
        print("✓ All examples completed successfully!")
        print("="*60)
        print("\nNext steps:")
        print("  1. Review the code in this file to understand the patterns")
        print("  2. Check PERMISSIONS.md for detailed documentation")
        print("  3. Run the tests: pytest test/test_permissions.py -v")
        print("  4. Integrate into your API endpoints")
        print()

    except Exception as e:
        print(f"\n✗ Error running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
