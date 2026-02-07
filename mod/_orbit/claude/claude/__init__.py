"""
Claude Code Mod - Programmatic Interface

Provides automated access to Claude Code for code analysis,
generation, and modification without user prompts.
"""

from .mod import Mod, run_claude

__version__ = "1.0.0"
__all__ = ["Mod", "run_claude"]
