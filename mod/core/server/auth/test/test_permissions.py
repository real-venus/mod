"""
Tests for the permission system.
"""

import pytest
import tempfile
import shutil
from pathlib import Path
import sys

# Add mod to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

from mod.core.server.auth.auth.permissions import PermissionManager


class TestPermissionManager:
    """Test cases for PermissionManager."""

    @pytest.fixture
    def temp_mod_root(self):
        """Create a temporary mod directory structure."""
        temp_dir = tempfile.mkdtemp()
        mod_root = Path(temp_dir)

        # Create the portal directory structure
        outer_path = mod_root / "mod" / "orbit" / "portal"
        outer_path.mkdir(parents=True)

        # Create some test user directories
        user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
        user2 = "0x6478255b80b561b4d8d96c02ce86ffcebbb9d09e"

        # User 1 modules
        (outer_path / user1 / "module1").mkdir(parents=True)
        (outer_path / user1 / "module2").mkdir(parents=True)

        # User 2 modules
        (outer_path / user2 / "module3").mkdir(parents=True)

        yield mod_root

        # Cleanup
        shutil.rmtree(temp_dir)

    def test_owner_has_full_access(self, temp_mod_root):
        """Test that owner has access to all modules."""
        owner_address = "0xowner123"
        pm = PermissionManager(owner_address=owner_address, mod_root=temp_mod_root)

        # Owner should have access to any module
        user1_module = temp_mod_root / "mod" / "orbit" / "portal" / "0x7f46ae9b5a5e25110900a418376e021454c90f4a" / "module1"
        user2_module = temp_mod_root / "mod" / "orbit" / "portal" / "0x6478255b80b561b4d8d96c02ce86ffcebbb9d09e" / "module3"

        assert pm.can_access(owner_address, str(user1_module), 'read')
        assert pm.can_access(owner_address, str(user1_module), 'write')
        assert pm.can_access(owner_address, str(user2_module), 'read')
        assert pm.can_access(owner_address, str(user2_module), 'execute')

    def test_user_can_access_own_modules(self, temp_mod_root):
        """Test that users can access their own modules."""
        user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
        pm = PermissionManager(owner_address="0xowner", mod_root=temp_mod_root)

        # User 1 should have access to their own modules
        user1_module1 = temp_mod_root / "mod" / "orbit" / "portal" / user1 / "module1"
        user1_module2 = temp_mod_root / "mod" / "orbit" / "portal" / user1 / "module2"

        assert pm.can_access(user1, str(user1_module1), 'read')
        assert pm.can_access(user1, str(user1_module1), 'write')
        assert pm.can_access(user1, str(user1_module2), 'execute')

    def test_user_cannot_access_other_users_modules(self, temp_mod_root):
        """Test that users cannot access other users' modules."""
        user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
        user2 = "0x6478255b80b561b4d8d96c02ce86ffcebbb9d09e"
        pm = PermissionManager(owner_address="0xowner", mod_root=temp_mod_root)

        # User 1 should NOT have access to User 2's modules
        user2_module = temp_mod_root / "mod" / "orbit" / "portal" / user2 / "module3"

        assert not pm.can_access(user1, str(user2_module), 'read')
        assert not pm.can_access(user1, str(user2_module), 'write')
        assert not pm.can_access(user1, str(user2_module), 'execute')

    def test_list_user_modules(self, temp_mod_root):
        """Test listing modules for a user."""
        user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
        pm = PermissionManager(owner_address="0xowner", mod_root=temp_mod_root)

        modules = pm.list_user_modules(user1)
        assert len(modules) == 2
        assert "module1" in modules
        assert "module2" in modules

    def test_create_user_directory(self, temp_mod_root):
        """Test creating a new user directory."""
        new_user = "0xnewuser123"
        pm = PermissionManager(owner_address="0xowner", mod_root=temp_mod_root)

        user_path = pm.create_user_directory(new_user)
        assert user_path.exists()
        assert user_path.is_dir()

        # Check that README was created
        readme = user_path / "README.md"
        assert readme.exists()
        assert new_user in readme.read_text()

    def test_get_accessible_modules_for_user(self, temp_mod_root):
        """Test getting all accessible modules for a regular user."""
        user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
        pm = PermissionManager(owner_address="0xowner", mod_root=temp_mod_root)

        accessible = pm.get_accessible_modules(user1)
        assert len(accessible) == 2  # User 1 has 2 modules
        assert all(user1 in path for path in accessible)

    def test_get_accessible_modules_for_owner(self, temp_mod_root):
        """Test that owner can see all modules."""
        owner = "0xowner123"
        pm = PermissionManager(owner_address=owner, mod_root=temp_mod_root)

        accessible = pm.get_accessible_modules(owner)
        assert len(accessible) == 3  # All 3 modules across both users

    def test_check_and_raise_permission_error(self, temp_mod_root):
        """Test that check_and_raise raises PermissionError correctly."""
        user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
        user2 = "0x6478255b80b561b4d8d96c02ce86ffcebbb9d09e"
        pm = PermissionManager(owner_address="0xowner", mod_root=temp_mod_root)

        # User 1 accessing User 2's module should raise error
        user2_module = temp_mod_root / "mod" / "orbit" / "portal" / user2 / "module3"

        with pytest.raises(PermissionError) as exc_info:
            pm.check_and_raise(user1, str(user2_module), 'read')

        assert "does not have permission" in str(exc_info.value)


def test_permission_functions():
    """Test the standalone permission check functions."""
    from mod.core.server.auth.auth.permissions import check_permission, require_permission

    # Create a temporary structure
    temp_dir = tempfile.mkdtemp()
    mod_root = Path(temp_dir)
    outer_path = mod_root / "mod" / "orbit" / "portal"
    user1 = "0x7f46ae9b5a5e25110900a418376e021454c90f4a"
    module_path = outer_path / user1 / "test_module"
    module_path.mkdir(parents=True)

    try:
        # This would need proper setup with actual mod package
        # Just testing that functions exist and are callable
        assert callable(check_permission)
        assert callable(require_permission)
    finally:
        shutil.rmtree(temp_dir)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
