"""Targon - Serverless framework for Python.

This package provides a local implementation of the Targon serverless platform
for development and testing purposes.
"""

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

__version__ = "0.1.0"
