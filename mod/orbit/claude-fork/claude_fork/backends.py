"""
Backend Abstraction Layer for Claude Module

Provides a pluggable backend system that allows the claude module to use
different AI code agents: Claude Code CLI, dev module tools, OpenAI Codex,
and any other compatible agent implementation.

NOTE: The claude module uses a unified operation model where both read and write
operations flow through the same backend. There is no separate "standard" vs "edit"
backend - instead, permission requirements are determined by the operation type
(requires_owner flag). All operations use the same forward() execution path.

See UNIFIED_OPERATIONS.md for details on the unified architecture.
"""

from typing import Dict, Any, Optional, Union, List
from abc import ABC, abstractmethod
import os
import subprocess
import json
import logging
from pathlib import Path

logger = logging.getLogger('claude-fork.backends')


class Backend(ABC):
    """
    Abstract base class for all backend implementations.

    Any backend must implement these core methods to be compatible
    with the claude module's interface.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Backend identifier (e.g., 'claude-code', 'dev-tools', 'codex')"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description of the backend"""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this backend is available and properly configured"""
        pass

    @abstractmethod
    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "default",
        stream_output: bool = False,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """
        Execute a code operation query.

        Args:
            query: The task/prompt to execute
            path: Working directory
            model: Model identifier
            stream_output: Whether to stream output
            **kwargs: Backend-specific options

        Returns:
            Response from the backend (parsed or raw)
        """
        pass

    @abstractmethod
    def install(self) -> bool:
        """
        Attempt to install or set up this backend.

        Returns:
            True if installation successful, False otherwise
        """
        pass


class ClaudeCodeBackend(Backend):
    """
    Backend using the official Claude Code CLI.

    This is the default backend that uses `claude` command-line tool
    with your Claude Max subscription or API key.
    """

    @property
    def name(self) -> str:
        return "claude-code"

    @property
    def description(self) -> str:
        return "Official Claude Code CLI (via Anthropic)"

    def __init__(self, api_key: Optional[str] = None, **kwargs):
        self.api_key = api_key or os.environ.get('ANTHROPIC_AUTH_TOKEN') or os.environ.get('ANTHROPIC_API_KEY')
        self.claude_bin = None

    def is_available(self) -> bool:
        """Check if Claude CLI is available"""
        try:
            result = subprocess.run(
                ["which", "claude"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                self.claude_bin = result.stdout.strip()
                return True
            return False
        except Exception as e:
            logger.debug(f"Claude CLI check failed: {e}")
            return False

    def install(self) -> bool:
        """Install Claude CLI via Homebrew"""
        logger.info("Installing Claude CLI via Homebrew...")
        try:
            # Check if homebrew is installed
            result = subprocess.run(
                ["which", "brew"],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                logger.error("Homebrew not found. Install from https://brew.sh")
                return False

            # Install Claude
            result = subprocess.run(
                ["brew", "install", "anthropics/claude/claude"],
                capture_output=True,
                text=True,
                timeout=300
            )

            if result.returncode == 0:
                logger.info("Claude CLI installed successfully")
                # Update our binary path
                self.is_available()
                return True
            else:
                logger.error(f"Installation failed: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"Installation error: {e}")
            return False

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "sonnet",
        stream_output: bool = False,
        output_format: str = "json",
        bypass_permissions: bool = True,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """Execute query using Claude Code CLI"""

        if not self.claude_bin:
            if not self.is_available():
                raise RuntimeError("Claude CLI not available. Run install() first.")

        # Build command
        cmd = [
            self.claude_bin,
            "--print",
            "--model", model,
            "--output-format", output_format,
        ]

        if bypass_permissions:
            cmd.extend([
                "--dangerously-skip-permissions",
                "--permission-mode", "bypassPermissions"
            ])

        # Add any additional options
        additional_options = kwargs.get('additional_options', {})
        for key, value in additional_options.items():
            if isinstance(value, bool):
                if value:
                    cmd.append(f"--{key}")
            elif isinstance(value, list):
                cmd.append(f"--{key}")
                cmd.extend([str(v) for v in value])
            else:
                cmd.extend([f"--{key}", str(value)])

        cmd.append(query)

        # Prepare environment
        env = os.environ.copy()
        if self.api_key:
            env.setdefault('ANTHROPIC_API_KEY', self.api_key)

        work_dir = path or os.getcwd()

        # Execute
        if stream_output:
            return self._execute_streaming(cmd, work_dir, env, output_format)
        else:
            return self._execute_blocking(cmd, work_dir, env, output_format)

    def _execute_blocking(self, cmd, work_dir, env, output_format):
        """Execute command and wait for completion"""
        result = subprocess.run(
            cmd,
            cwd=work_dir,
            capture_output=True,
            text=True,
            env=env,
            timeout=300
        )

        if result.returncode != 0:
            raise RuntimeError(f"Claude Code error: {result.stderr}")

        if output_format == "json":
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON: {e}")
                return {"raw_output": result.stdout, "error": "Failed to parse JSON"}

        return result.stdout

    def _execute_streaming(self, cmd, work_dir, env, output_format):
        """Execute command with streaming output"""
        print("\n" + "="*60)
        print("CLAUDE CODE OUTPUT (LIVE)")
        print("="*60 + "\n")

        process = subprocess.Popen(
            cmd,
            cwd=work_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            bufsize=1,
            universal_newlines=True
        )

        stdout_lines = []
        stderr_lines = []

        import time
        while True:
            retcode = process.poll()

            if process.stdout:
                line = process.stdout.readline()
                if line:
                    print(line, end='', flush=True)
                    stdout_lines.append(line)

            if process.stderr:
                err_line = process.stderr.readline()
                if err_line:
                    print(f"[STDERR] {err_line}", end='', flush=True)
                    stderr_lines.append(err_line)

            if retcode is not None:
                if process.stdout:
                    remaining = process.stdout.read()
                    if remaining:
                        print(remaining, end='', flush=True)
                        stdout_lines.append(remaining)
                if process.stderr:
                    remaining_err = process.stderr.read()
                    if remaining_err:
                        print(f"[STDERR] {remaining_err}", end='', flush=True)
                        stderr_lines.append(remaining_err)
                break

            time.sleep(0.01)

        print("\n" + "="*60)
        print("CLAUDE CODE FINISHED")
        print("="*60 + "\n")

        stdout_text = ''.join(stdout_lines)
        stderr_text = ''.join(stderr_lines)

        if retcode != 0:
            raise RuntimeError(f"Claude Code error: {stderr_text}")

        if output_format == "json":
            try:
                return json.loads(stdout_text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON: {e}")
                return {"raw_output": stdout_text, "error": "Failed to parse JSON"}

        return stdout_text


class DevToolsBackend(Backend):
    """
    Backend using the dev module's tool ecosystem.

    Provides access to bash, grep, glob, read, write, edit, and other
    tools from the dev module, orchestrated through the ask tool for
    AI-powered operations.
    """

    @property
    def name(self) -> str:
        return "dev-tools"

    @property
    def description(self) -> str:
        return "Dev module tool ecosystem with AI orchestration"

    def __init__(self, **kwargs):
        self._mod = None
        self._tools = {}

    def is_available(self) -> bool:
        """Check if dev module is available"""
        try:
            import mod as m
            self._mod = m
            # Try to load the dev.tool registry
            registry = m.mod('dev.tool')()
            tools = registry.forward(action="list")
            return tools.get('success', False)
        except Exception as e:
            logger.debug(f"Dev tools check failed: {e}")
            return False

    def install(self) -> bool:
        """Dev tools are part of the mod framework - no separate install needed"""
        logger.info("Dev tools are part of the mod framework ecosystem")
        return self.is_available()

    def _get_tool(self, name: str):
        """Get or create a tool instance"""
        if name not in self._tools:
            self._tools[name] = self._mod.mod(f'dev.tool.{name}')()
        return self._tools[name]

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "anthropic/claude-opus-4",
        stream_output: bool = False,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """
        Execute query using dev tools + AI orchestration.

        Uses the ask tool to interpret the query and coordinate
        the use of other dev tools (bash, read, write, edit, etc.)
        """

        if not self._mod:
            if not self.is_available():
                raise RuntimeError("Dev tools not available")

        # Get the ask tool for AI orchestration
        ask = self._get_tool('ask')

        # Build system prompt that includes available tools
        registry = self._mod.mod('dev.tool')()
        tools_info = registry.forward(action="list")
        available_tools = tools_info.get('tools', [])

        system_prompt = f"""You are an AI code assistant with access to these tools:
{', '.join(available_tools)}

Working directory: {path or os.getcwd()}

When the user asks you to perform code operations, use the appropriate tools:
- bash: Execute shell commands
- read: Read file contents
- write: Write files
- edit: Edit existing files
- grep: Search file contents
- glob: Find files by pattern
- task: Launch specialized agents

Respond with structured JSON containing your actions and results.
"""

        # Execute query via ask tool
        result = ask.forward(
            query=query,
            model=model,
            system=system_prompt,
            temperature=0.7,
            **kwargs
        )

        if result.get('success'):
            response = result.get('response', '')

            if stream_output:
                print("\n" + "="*60)
                print("DEV TOOLS OUTPUT")
                print("="*60 + "\n")
                print(response)
                print("\n" + "="*60)
                print("DEV TOOLS FINISHED")
                print("="*60 + "\n")

            return {
                "success": True,
                "response": response,
                "backend": self.name,
                "model": model
            }
        else:
            raise RuntimeError(f"Dev tools error: {result.get('message', 'Unknown error')}")


class CodexBackend(Backend):
    """
    Backend using OpenAI Codex via OpenAI API.

    Uses OpenAI's code models (GPT-4, GPT-3.5-turbo with code focus)
    for code generation and manipulation tasks.
    """

    @property
    def name(self) -> str:
        return "codex"

    @property
    def description(self) -> str:
        return "OpenAI Codex / GPT-4 Code Models"

    def __init__(self, api_key: Optional[str] = None, **kwargs):
        self.api_key = api_key or os.environ.get('OPENAI_API_KEY')
        self._openai = None

    def is_available(self) -> bool:
        """Check if OpenAI client is available"""
        try:
            import openai
            self._openai = openai
            return bool(self.api_key)
        except ImportError:
            logger.debug("OpenAI package not installed")
            return False

    def install(self) -> bool:
        """Install OpenAI package"""
        logger.info("Installing OpenAI package...")
        try:
            subprocess.run(
                ["pip", "install", "openai"],
                capture_output=True,
                text=True,
                timeout=60
            )
            return self.is_available()
        except Exception as e:
            logger.error(f"Installation failed: {e}")
            return False

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "gpt-4",
        stream_output: bool = False,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """Execute query using OpenAI Codex"""

        if not self._openai:
            if not self.is_available():
                raise RuntimeError("OpenAI not available. Run install() first.")

        # Create client
        client = self._openai.OpenAI(api_key=self.api_key)

        # Build system prompt for code operations
        system_prompt = f"""You are an expert code assistant.
Working directory: {path or os.getcwd()}

When asked to perform code operations:
1. Analyze the request carefully
2. Read relevant files first (describe what you'd read)
3. Make precise, targeted changes
4. Explain what you did and why

Return results in JSON format with:
- summary: Brief description of actions taken
- files_modified: List of files changed
- explanation: Detailed explanation
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]

        if stream_output:
            print("\n" + "="*60)
            print("CODEX OUTPUT (LIVE)")
            print("="*60 + "\n")

            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                temperature=kwargs.get('temperature', 0.3),
                max_tokens=kwargs.get('max_tokens', 4000)
            )

            full_response = []
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    print(content, end='', flush=True)
                    full_response.append(content)

            print("\n" + "="*60)
            print("CODEX FINISHED")
            print("="*60 + "\n")

            response_text = ''.join(full_response)
        else:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.3),
                max_tokens=kwargs.get('max_tokens', 4000)
            )
            response_text = response.choices[0].message.content

        # Try to parse as JSON, fall back to raw text
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            return {
                "success": True,
                "response": response_text,
                "backend": self.name,
                "model": model
            }


class BackendRegistry:
    """
    Central registry for managing multiple backends.

    Allows the claude module to automatically select the best available
    backend or let users choose their preferred backend explicitly.
    """

    def __init__(self):
        self.backends: Dict[str, Backend] = {}
        self._default_order = ['claude-code', 'dev-tools', 'codex']

        # Register built-in backends
        self.register('claude-code', ClaudeCodeBackend)
        self.register('dev-tools', DevToolsBackend)
        self.register('codex', CodexBackend)

    def register(self, name: str, backend_class: type, **init_kwargs):
        """Register a backend"""
        self.backends[name] = {
            'class': backend_class,
            'init_kwargs': init_kwargs
        }

    def get_backend(self, name: str, **init_kwargs) -> Backend:
        """
        Get a backend instance by name.

        Args:
            name: Backend name
            **init_kwargs: Initialization arguments for the backend

        Returns:
            Backend instance
        """
        if name not in self.backends:
            raise ValueError(f"Backend '{name}' not registered. Available: {list(self.backends.keys())}")

        backend_info = self.backends[name]
        kwargs = {**backend_info['init_kwargs'], **init_kwargs}
        return backend_info['class'](**kwargs)

    def auto_select(self, **init_kwargs) -> Backend:
        """
        Automatically select the best available backend.

        Tries backends in order of preference:
        1. Claude Code CLI (default, most integrated)
        2. Dev Tools (mod framework ecosystem)
        3. Codex (OpenAI, requires API key)

        Returns:
            Backend instance
        """
        for name in self._default_order:
            try:
                backend = self.get_backend(name, **init_kwargs)
                if backend.is_available():
                    logger.info(f"Auto-selected backend: {name}")
                    return backend
            except Exception as e:
                logger.debug(f"Backend {name} not available: {e}")
                continue

        # If none available, return Claude Code (will prompt for install)
        logger.warning("No backends available, defaulting to claude-code")
        return self.get_backend('claude-code', **init_kwargs)

    def list_available(self, **init_kwargs) -> List[Dict[str, Any]]:
        """
        List all available backends with their status.

        Returns:
            List of dicts with name, description, available status
        """
        results = []
        for name in self.backends.keys():
            try:
                backend = self.get_backend(name, **init_kwargs)
                results.append({
                    'name': name,
                    'description': backend.description,
                    'available': backend.is_available()
                })
            except Exception as e:
                results.append({
                    'name': name,
                    'description': 'Error loading backend',
                    'available': False,
                    'error': str(e)
                })

        return results


# Global registry instance
registry = BackendRegistry()
