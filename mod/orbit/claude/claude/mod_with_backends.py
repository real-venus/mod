"""
Claude Module with Pluggable Backends

This module provides a unified interface for AI-powered code operations
with support for multiple backends: Claude Code CLI, dev tools, Codex, etc.
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Union, List
import mod as m
from .backends import registry as backend_registry, Backend

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('claude')


class Mod:
    """
    Claude AI Code Interface with Pluggable Backends

    Provides programmatic access to multiple AI code backends:
    - Claude Code CLI (default)
    - Dev module tools (mod framework ecosystem)
    - OpenAI Codex (GPT-4 code models)
    - Custom backends (extensible)
    """

    description = """
    Multi-backend AI code interface - Automate code tasks with pluggable backends
    """

    @staticmethod
    def set_log_level(level: str = "INFO") -> None:
        """
        Set the logging level for the Claude module.

        Args:
            level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        """
        level_map = {
            "DEBUG": logging.DEBUG,
            "INFO": logging.INFO,
            "WARNING": logging.WARNING,
            "ERROR": logging.ERROR,
            "CRITICAL": logging.CRITICAL
        }
        log_level = level_map.get(level.upper(), logging.INFO)
        logger.setLevel(log_level)
        logger.info(f"Log level set to {level.upper()}")

    def __init__(
        self,
        default_path: Optional[str] = None,
        backend: Optional[str] = None,
        api_key: Optional[str] = None,
        model: str = 'anthropic/claude-opus-4',
        auto_install: bool = True,
        **kwargs
    ):
        """
        Initialize the Claude Code interface with backend selection.

        Args:
            default_path: Default working directory
            backend: Backend to use ('claude-code', 'dev-tools', 'codex', or None for auto)
            api_key: API key for the backend (if required)
            model: Default model identifier
            auto_install: Automatically install backend if missing
            **kwargs: Additional backend-specific options
        """
        logger.info("Initializing Claude interface with pluggable backends...")
        self.default_path = default_path or os.getcwd()
        self.model = model
        self._router = None
        self._ipfs = None

        # Select or auto-detect backend
        if backend:
            logger.info(f"Using explicitly selected backend: {backend}")
            self.backend = backend_registry.get_backend(backend, api_key=api_key, **kwargs)
        else:
            logger.info("Auto-selecting best available backend...")
            self.backend = backend_registry.auto_select(api_key=api_key, **kwargs)

        logger.info(f"Backend selected: {self.backend.name} - {self.backend.description}")

        # Check if backend is available
        if not self.backend.is_available():
            logger.warning(f"Backend {self.backend.name} is not available")
            if auto_install:
                logger.info("Attempting automatic installation...")
                if self.backend.install():
                    logger.info("Backend installed successfully")
                else:
                    raise RuntimeError(f"Backend {self.backend.name} could not be installed")
            else:
                raise RuntimeError(f"Backend {self.backend.name} is not available and auto_install is False")

        logger.info("Claude interface initialized successfully")

    @staticmethod
    def list_backends() -> List[Dict[str, Any]]:
        """
        List all available backends and their status.

        Returns:
            List of dicts with name, description, available status

        Example:
            >>> backends = Mod.list_backends()
            >>> for b in backends:
            ...     status = "✓" if b['available'] else "✗"
            ...     print(f"{status} {b['name']}: {b['description']}")
        """
        return backend_registry.list_available()

    def switch_backend(self, backend_name: str, **kwargs) -> None:
        """
        Switch to a different backend at runtime.

        Args:
            backend_name: Name of backend to switch to
            **kwargs: Backend initialization arguments

        Example:
            >>> mod = Mod()  # Uses default (claude-code)
            >>> mod.switch_backend('dev-tools')  # Switch to dev tools
            >>> mod.switch_backend('codex', api_key='sk-...')  # Switch to Codex
        """
        logger.info(f"Switching backend from {self.backend.name} to {backend_name}")
        self.backend = backend_registry.get_backend(backend_name, **kwargs)

        if not self.backend.is_available():
            raise RuntimeError(f"Backend {backend_name} is not available")

        logger.info(f"Switched to backend: {self.backend.name}")

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        mod=None,
        model: str = "sonnet",
        stream_output: bool = True,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """
        Execute a query using the active backend.

        Args:
            query: The prompt/question to send
            path: Working directory path
            mod: Optional mod object to get path from
            model: Model to use
            stream_output: Stream output in real-time
            **kwargs: Backend-specific options

        Returns:
            Response from the backend

        Example:
            >>> mod = Mod()
            >>> result = mod.forward("Analyze security vulnerabilities in auth.py")
        """
        if mod is not None:
            path = m.dp(mod)

        work_dir = path or self.default_path

        logger.info(f"Executing query via {self.backend.name} backend")
        logger.info(f"Working directory: {work_dir}")
        logger.debug(f"Query: {query[:100]}...")

        return self.backend.forward(
            query=query,
            path=work_dir,
            model=model,
            stream_output=stream_output,
            **kwargs
        )

    # ── High-level convenience methods ────────────────────────────

    def analyze_code(
        self,
        path: Optional[str] = None,
        focus: Optional[str] = None,
        stream_output: bool = False
    ) -> Dict[str, Any]:
        """Analyze code with optional focus area"""
        query = f"Analyze the code"
        if focus:
            query += f" focusing on {focus}"
        return self.forward(query=query, path=path, stream_output=stream_output)

    def generate_code(
        self,
        description: str,
        path: Optional[str] = None,
        file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate code based on description"""
        query = f"Generate code: {description}"
        if file_path:
            query += f" in file {file_path}"
        return self.forward(query=query, path=path)

    def refactor(
        self,
        instructions: str,
        path: Optional[str] = None,
        target_files: Optional[list] = None
    ) -> Dict[str, Any]:
        """Refactor code based on instructions"""
        query = f"Refactor: {instructions}"
        if target_files:
            query += f"\nTarget files: {', '.join(target_files)}"
        return self.forward(query=query, path=path)

    def debug(
        self,
        issue_description: str,
        path: Optional[str] = None,
        file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Debug an issue"""
        query = f"Debug this issue: {issue_description}"
        if file_path:
            query += f"\nFile: {file_path}"
        return self.forward(query=query, path=path)

    def edit_file(
        self,
        file_path: str,
        instructions: str,
        path: Optional[str] = None,
        mod=None,
        stream_output: bool = False
    ) -> Dict[str, Any]:
        """Edit a specific file"""
        if mod is not None:
            path = m.dp(mod)
        work_dir = path or self.default_path
        query = f"Edit the file {file_path}: {instructions}"
        return self.forward(query=query, path=work_dir, stream_output=stream_output)

    def batch_process(
        self,
        queries: list,
        path: Optional[str] = None,
        model: str = "sonnet"
    ) -> list:
        """Process multiple queries in batch"""
        logger.info(f"Starting batch processing of {len(queries)} queries")
        results = []
        for i, query in enumerate(queries, 1):
            logger.info(f"Processing query {i}/{len(queries)}")
            try:
                result = self.forward(query=query, path=path, model=model)
                results.append({"query": query, "result": result, "success": True})
            except Exception as e:
                logger.error(f"Query {i} failed: {e}")
                results.append({"query": query, "error": str(e), "success": False})

        successful = sum(1 for r in results if r.get('success'))
        logger.info(f"Batch complete: {successful}/{len(queries)} successful")
        return results

    # ── OpenRouter integration (existing functionality) ───────────

    def router(self):
        """Get or create OpenRouter instance"""
        if self._router is None:
            self._router = m.mod('model.openrouter')()
        return self._router

    def ask(
        self,
        message: str,
        model: str = None,
        stream: bool = False,
        history: list = None,
        system_prompt: str = None,
        temperature: float = 1.0,
        max_tokens: int = 10000000,
        **kwargs
    ) -> str:
        """Send a message via OpenRouter API"""
        return self.router().forward(
            message,
            model=model or self.model,
            stream=stream,
            history=history,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )

    def models(self, search: str = 'claude') -> list:
        """List available Claude models via OpenRouter"""
        return self.router().models(search=search)


def run_claude(
    query: str,
    path: Optional[str] = None,
    backend: Optional[str] = None,
    **kwargs
) -> Union[str, Dict[str, Any]]:
    """
    Quick function to run a query with automatic backend selection.

    Args:
        query: The query to run
        path: Optional working directory
        backend: Optional backend name
        **kwargs: Additional options

    Returns:
        Query results

    Example:
        >>> result = run_claude("Fix the bug in main.py", path="/path/to/project")
    """
    logger.info("Running quick Claude query")
    mod = Mod(default_path=path, backend=backend, **kwargs)
    return mod.forward(query=query, path=path)
