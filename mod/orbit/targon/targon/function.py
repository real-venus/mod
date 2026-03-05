"""Targon function wrapper."""

from __future__ import annotations

import functools
from typing import Callable, Optional

from .image import Image


class Function:
    """Wrapper for serverless functions with deployment configuration."""

    def __init__(self, fn: Callable, image: Optional[Image], resource: str,
                 min_replicas: int, max_replicas: int, timeout: int):
        self._fn = fn
        self._image = image
        self._resource = resource
        self._min_replicas = min_replicas
        self._max_replicas = max_replicas
        self._timeout = timeout
        functools.update_wrapper(self, fn)

    def __call__(self, *args, **kwargs):
        """Execute the function locally."""
        return self._fn(*args, **kwargs)

    async def remote(self, *args, **kwargs):
        """Execute the function remotely."""
        return self._fn(*args, **kwargs)

    def local(self, *args, **kwargs):
        """Execute the function locally."""
        return self._fn(*args, **kwargs)
