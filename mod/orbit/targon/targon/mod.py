"""Targon serverless framework - main module.

This module provides a local implementation of the Targon API for development and testing.
It mimics the behavior of the Targon serverless platform for deploying and running functions.
"""

from __future__ import annotations

from .app import App
from .compute import Compute
from .function import Function
from .image import Image

__all__ = [
    "App",
    "Compute",
    "Function",
    "Image",
]
