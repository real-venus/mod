import subprocess
import json
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any, Union
import mod as m


class Mod:
    """
    Claude Code Interface Module

    Provides programmatic access to Claude Code for automated code analysis,
    generation, and modifications without user prompts.
    """

    description = """
    Claude Code Interface - Automate code tasks with AI assistance
    """

    def __init__(self, default_path: Optional[str] = None, api_key: Optional[str] = None):
        """
        Initialize the Claude Code interface.

        Args:
            default_path: Default working directory for Claude Code operations
            api_key: Optional Anthropic API key (will check environment if not provided)
        """
        self.default_path = default_path or os.getcwd()
        self.api_key = api_key or self._get_api_key()
        self.claude_bin = self._find_or_install_claude()

    def _get_api_key(self) -> Optional[str]:
        """
        Get API key from environment variables or common locations.

        Returns:
            API key if found, None otherwise
        """
        # Check environment variables
        api_key = os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('CLAUDE_API_KEY')

        if not api_key:
            # Check common config file locations
            config_paths = [
                Path.home() / '.anthropic' / 'api_key',
                Path.home() / '.anthropic' / 'api_keys',
                Path.home() / '.claude' / 'api_key',
                Path.home() / '.config' / 'anthropic' / 'api_key',
            ]

            for config_path in config_paths:
                if config_path.exists():
                    try:
                        api_key = config_path.read_text().strip()
                        if api_key:
                            break
                    except Exception:
                        continue

        return api_key

    def _install_claude(self) -> bool:
        """
        Install Claude CLI using homebrew.

        Returns:
            True if installation successful, False otherwise
        """
        print("Claude CLI not found. Installing...", file=sys.stderr)

        try:
            # Check if homebrew is installed
            result = subprocess.run(
                ["which", "brew"],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                print("Homebrew not found. Please install homebrew first: https://brew.sh", file=sys.stderr)
                return False

            # Install Claude
            print("Running: brew install anthropics/claude/claude", file=sys.stderr)
            result = subprocess.run(
                ["brew", "install", "anthropics/claude/claude"],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout for installation
            )

            if result.returncode != 0:
                print(f"Installation failed: {result.stderr}", file=sys.stderr)
                return False

            print("Claude CLI installed successfully!", file=sys.stderr)
            return True

        except subprocess.TimeoutExpired:
            print("Installation timed out after 5 minutes", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Installation error: {e}", file=sys.stderr)
            return False

    def _find_or_install_claude(self) -> str:
        """
        Find the Claude binary in the system, install if not found.

        Returns:
            Path to Claude binary

        Raises:
            RuntimeError: If Claude cannot be found or installed
        """
        result = subprocess.run(
            ["which", "claude"],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            # Try to install
            if self._install_claude():
                # Try to find it again
                result = subprocess.run(
                    ["which", "claude"],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    return result.stdout.strip()

            raise RuntimeError(
                "Claude CLI not found and could not be installed. "
                "Please install manually: brew install anthropics/claude/claude"
            )

        return result.stdout.strip()

    def forward(self,
                query: str,
                path: Optional[str] = None,
                mod = None,
                model: str = "sonnet",
                output_format: str = "json",
                bypass_permissions: bool = True,
                additional_options: Optional[Dict[str, Any]] = None) -> Union[str, Dict[str, Any]]:
        """
        Execute a Claude Code query in the background without user prompts.

        Args:
            query: The prompt/question to send to Claude Code
            path: Working directory path (defaults to self.default_path)
            model: Model to use (sonnet, opus, haiku)
            output_format: Output format (json, text, stream-json)
            bypass_permissions: If True, bypasses all permission checks
            additional_options: Additional CLI options as key-value pairs

        Returns:
            Response from Claude Code (parsed JSON if output_format='json', otherwise text)

        Example:
            >>> mod = Mod()
            >>> result = mod.forward(
            ...     query="Analyze the main.py file and suggest improvements",
            ...     path="/path/to/project"
            ... )
        """
        if mod != None:
            path = m.dp(mod)

        work_dir = path or self.default_path

        # Build command
        cmd = [
            self.claude_bin,
            "--print",
            "--model", model,
            "--output-format", output_format,
        ]

        # Add API key if available
        if self.api_key:
            cmd.extend(["--api-key", self.api_key])

        # Add permission bypass flags
        if bypass_permissions:
            cmd.extend([
                "--dangerously-skip-permissions",
                "--permission-mode", "bypassPermissions"
            ])

        # Add any additional options
        if additional_options:
            for key, value in additional_options.items():
                if isinstance(value, bool):
                    if value:
                        cmd.append(f"--{key}")
                elif isinstance(value, list):
                    cmd.append(f"--{key}")
                    cmd.extend([str(v) for v in value])
                else:
                    cmd.extend([f"--{key}", str(value)])

        # Add the query
        cmd.append(query)

        # Prepare environment with API key if available
        env = os.environ.copy()
        if self.api_key and 'ANTHROPIC_API_KEY' not in env:
            env['ANTHROPIC_API_KEY'] = self.api_key

        # Execute Claude Code
        result = subprocess.run(
            cmd,
            cwd=work_dir,
            capture_output=True,
            text=True,
            env=env,
            timeout=300  # 5 minute timeout
        )

        if result.returncode != 0:
            raise RuntimeError(f"Claude Code error: {result.stderr}")

        # Parse output based on format
        if output_format == "json":
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {"raw_output": result.stdout, "error": "Failed to parse JSON"}

        return result.stdout

    def analyze_code(self,
                     path: str,
                     focus: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze code in a directory or file.

        Args:
            path: Path to directory or file
            focus: Optional specific aspect to focus on (e.g., "performance", "security")

        Returns:
            Analysis results as a dictionary
        """
        query = f"Analyze the code"
        if focus:
            query += f" focusing on {focus}"

        return self.forward(query=query, path=path)

    def generate_code(self,
                     description: str,
                     path: str,
                     file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate code based on a description.

        Args:
            description: What code to generate
            path: Working directory
            file_path: Optional specific file to create/modify

        Returns:
            Generation results
        """
        query = f"Generate code: {description}"
        if file_path:
            query += f" in file {file_path}"

        return self.forward(query=query, path=path)

    def refactor(self,
                 path: str,
                 instructions: str,
                 target_files: Optional[list] = None) -> Dict[str, Any]:
        """
        Refactor code based on instructions.

        Args:
            path: Working directory
            instructions: Refactoring instructions
            target_files: Optional list of specific files to refactor

        Returns:
            Refactoring results
        """
        query = f"Refactor: {instructions}"
        if target_files:
            query += f"\nTarget files: {', '.join(target_files)}"

        return self.forward(query=query, path=path)

    def debug(self,
             path: str,
             issue_description: str,
             file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Debug an issue in the codebase.

        Args:
            path: Working directory
            issue_description: Description of the bug/issue
            file_path: Optional specific file with the issue

        Returns:
            Debug analysis and suggestions
        """
        query = f"Debug this issue: {issue_description}"
        if file_path:
            query += f"\nFile: {file_path}"

        return self.forward(query=query, path=path)

    def run_task(self,
                task: str,
                path: str,
                agent_type: Optional[str] = None,
                run_in_background: bool = True) -> Dict[str, Any]:
        """
        Run a general task with Claude Code.

        Args:
            task: Task description
            path: Working directory
            agent_type: Optional specific agent type (Bash, Explore, Plan, etc.)
            run_in_background: Whether to run in background

        Returns:
            Task execution results
        """
        additional_opts = {}
        if agent_type:
            additional_opts['agent'] = agent_type

        return self.forward(
            query=task,
            path=path,
            additional_options=additional_opts
        )

    def batch_process(self,
                     queries: list,
                     path: str,
                     model: str = "sonnet") -> list:
        """
        Process multiple queries in batch.

        Args:
            queries: List of query strings
            path: Working directory
            model: Model to use

        Returns:
            List of results for each query
        """
        results = []
        for query in queries:
            try:
                result = self.forward(
                    query=query,
                    path=path,
                    model=model
                )
                results.append({"query": query, "result": result, "success": True})
            except Exception as e:
                results.append({"query": query, "error": str(e), "success": False})

        return results


# Convenience function for quick usage
def run_claude(query: str, path: Optional[str] = None, api_key: Optional[str] = None, **kwargs) -> Union[str, Dict[str, Any]]:
    """
    Quick function to run a Claude Code query.

    Args:
        query: The query to run
        path: Optional working directory
        api_key: Optional Anthropic API key
        **kwargs: Additional options passed to Mod.forward()

    Returns:
        Query results

    Example:
        >>> result = run_claude("Fix the bug in main.py", path="/path/to/project")
    """
    mod = Mod(default_path=path, api_key=api_key)
    return mod.forward(query=query, path=path, **kwargs)
