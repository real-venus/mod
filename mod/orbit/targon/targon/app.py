"""Targon application definition."""

from __future__ import annotations

import functools
from typing import Callable, Optional

from .compute import Compute
from .function import Function
from .image import Image


class App:
    """A Targon application that can contain multiple serverless functions."""

    def __init__(self, name: str, image: Optional[Image] = None,
                 project_name: str = "default"):
        self.name = name
        self.image = image
        self.project_name = project_name
        self.app_id: Optional[str] = None
        self._functions: list[Function] = []
        self._entrypoints: list[Callable] = []

    def function(
        self,
        *,
        image: Optional[Image] = None,
        resource: str = Compute.CPU_SMALL,
        min_replicas: int = 1,
        max_replicas: int = 3,
        timeout: int = 300,
        **kwargs,
    ):
        """Decorator to register a function with this app."""
        def decorator(fn: Callable) -> Function:
            func = Function(
                fn=fn,
                image=image or self.image,
                resource=resource,
                min_replicas=min_replicas,
                max_replicas=max_replicas,
                timeout=timeout,
            )
            self._functions.append(func)
            return func
        return decorator

    class _RunContext:
        """Context manager for running the app."""

        def __init__(self, app: App):
            self._app = app

        async def __aenter__(self):
            return self._app

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return False

    def run(self):
        """Run the app in a context manager."""
        return self._RunContext(self)

    def local_entrypoint(self):
        """Decorator to register a local entrypoint function."""
        def decorator(fn: Callable) -> Callable:
            self._entrypoints.append(fn)

            @functools.wraps(fn)
            def wrapper(*args, **kwargs):
                return fn(*args, **kwargs)
            return wrapper
        return decorator

    def deploy(self):
        """Deploy the app to the Targon platform."""
        self.app_id = f"{self.project_name}-{self.name}"
        return self.app_id

    def serve(self):
        """Serve the app locally."""
        self.app_id = f"{self.project_name}-{self.name}"
        return self.app_id
