"""
Middleware for combining authentication and permission checking.

This middleware:
1. Verifies the user's authentication token
2. Extracts the user's address from the token
3. Checks permissions based on the requested module/path
4. Allows or denies the request
"""

from typing import Callable, Optional, Dict, Any
from functools import wraps
from .auth import Auth
from .permissions import PermissionManager


class AuthPermissionMiddleware:
    """
    Middleware that combines authentication and permission checking.
    """

    def __init__(self, auth: Optional[Auth] = None, permissions: Optional[PermissionManager] = None):
        """
        Initialize the middleware.

        Args:
            auth: Auth instance for token verification
            permissions: PermissionManager instance for access control
        """
        self.auth = auth or Auth()
        self.permissions = permissions or PermissionManager()

    def verify_and_check_access(
        self,
        token: str,
        module_path: str,
        operation: str = 'execute'
    ) -> Dict[str, Any]:
        """
        Verify authentication token and check module access permissions.

        Args:
            token: The authentication token
            module_path: The path to the module being accessed
            operation: The operation being performed ('read', 'write', 'execute')

        Returns:
            Dict containing user info and verification status

        Raises:
            AssertionError: If token verification fails
            PermissionError: If user doesn't have required permissions
        """
        # Verify the token
        headers = self.auth.verify(token)
        user_address = headers['key']

        # Check permissions
        if not self.permissions.can_access(user_address, module_path, operation):
            raise PermissionError(
                f"User {user_address} does not have permission to {operation} module at {module_path}"
            )

        return {
            'user_address': user_address,
            'headers': headers,
            'verified': True,
            'has_permission': True
        }

    def require_auth_and_permission(
        self,
        module_path: Optional[str] = None,
        operation: str = 'execute'
    ):
        """
        Decorator that requires authentication and permission checking.

        Args:
            module_path: The path to the module (if None, extracts from function kwargs)
            operation: The operation being performed

        Returns:
            Decorator function
        """
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Get token from kwargs or headers
                token = kwargs.get('token') or kwargs.get('headers', {}).get('token')
                if not token:
                    raise ValueError("No authentication token provided")

                # Determine module path
                path = module_path or kwargs.get('module_path') or kwargs.get('path')
                if not path:
                    raise ValueError("No module path specified")

                # Verify and check access
                auth_info = self.verify_and_check_access(token, path, operation)

                # Add user info to kwargs
                kwargs['user_address'] = auth_info['user_address']
                kwargs['auth_info'] = auth_info

                # Call the original function
                return func(*args, **kwargs)

            return wrapper
        return decorator


def require_auth_and_permission(module_path: Optional[str] = None, operation: str = 'execute'):
    """
    Convenience decorator for requiring authentication and permissions.

    Usage:
        @require_auth_and_permission(operation='read')
        def read_module(module_path: str, token: str, **kwargs):
            # This will only execute if user is authenticated and has permission
            pass

    Args:
        module_path: The path to check (if None, extracts from function kwargs)
        operation: The operation to check ('read', 'write', 'execute')

    Returns:
        Decorator function
    """
    middleware = AuthPermissionMiddleware()
    return middleware.require_auth_and_permission(module_path, operation)


class AccessControl:
    """
    Simple access control helper for use in API endpoints.
    """

    def __init__(self):
        self.auth = Auth()
        self.permissions = PermissionManager()

    def verify_access(
        self,
        token: str,
        module_path: str,
        operation: str = 'execute'
    ) -> tuple[str, bool]:
        """
        Verify token and check access.

        Args:
            token: Authentication token
            module_path: Path to module
            operation: Operation type

        Returns:
            Tuple of (user_address, has_access)
        """
        try:
            headers = self.auth.verify(token)
            user_address = headers['key']
            has_access = self.permissions.can_access(user_address, module_path, operation)
            return user_address, has_access
        except Exception as e:
            print(f"Access verification failed: {e}")
            return None, False

    def get_user_from_token(self, token: str) -> Optional[str]:
        """
        Extract user address from token without checking permissions.

        Args:
            token: Authentication token

        Returns:
            User address or None if invalid
        """
        try:
            headers = self.auth.verify(token)
            return headers['key']
        except Exception:
            return None

    def is_owner(self, token: str) -> bool:
        """
        Check if the token belongs to the system owner.

        Args:
            token: Authentication token

        Returns:
            True if user is owner
        """
        user_address = self.get_user_from_token(token)
        if not user_address:
            return False
        return self.permissions.is_owner(user_address)
