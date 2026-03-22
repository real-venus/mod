import subprocess
import json
import os
import sys
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Union
import mod as m

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('claude')


class Mod:
    """
    Claude Code Interface Module

    Provides programmatic access to Claude Code for automated code analysis,
    generation, and modifications without user prompts.
    """

    description = """
    Claude Code Interface - Automate code tasks with AI assistance
    """

    @staticmethod
    def set_log_level(level: str = "INFO") -> None:
        """
        Set the logging level for the Claude module.

        Args:
            level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

        Example:
            >>> Mod.set_log_level("DEBUG")  # Show all logs including debug info
            >>> Mod.set_log_level("WARNING")  # Only show warnings and errors
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

    def __init__(self, default_path: Optional[str] = None, api_key: Optional[str] = None, model: str = 'anthropic/claude-opus-4', **kwargs):
        """
        Initialize the Claude Code interface.

        Args:
            default_path: Default working directory for Claude Code operations
            api_key: Optional Anthropic API key (will check environment if not provided)
            model: Default model for OpenRouter API calls (default: anthropic/claude-opus-4)
        """
        logger.info("Initializing Claude Code interface...")
        self.default_path = default_path or os.getcwd()
        self.model = model
        self._router = None
        logger.info(f"Default path: {self.default_path}")

        self.api_key = api_key or self._get_api_key()
        if self.api_key:
            logger.info("API key configured successfully")
        else:
            logger.warning("No API key configured - CLI operations will require an API key")

        self.claude_bin = self._find_or_install_claude()
        logger.info("Claude Code interface initialized successfully")

    def save_api_key(self, api_key: str) -> None:
        """
        Save the API key to a common config file location for future use.

        Args:
            api_key: The API key to save
        """
        config_dir = Path.home() / '.anthropic'
        config_dir.mkdir(parents=True, exist_ok=True)
        config_path = config_dir / 'api_key'

        try:
            config_path.write_text(api_key.strip())
            logger.info(f"API key saved to {config_path}")
            print(f"✓ API key saved to {config_path}")
        except Exception as e:
            logger.error(f"Failed to save API key: {e}")
            print(f"✗ Failed to save API key: {e}", file=sys.stderr)

    def _get_api_key(self) -> Optional[str]:
        """
        Get API key from environment variables or common locations.
        Prompts user if not found.

        Returns:
            API key if found, None otherwise
        """
        logger.info("Searching for Anthropic API key...")

        # Check environment variables
        api_key = os.environ.get('ANTHROPIC_AUTH_TOKEN')

        if api_key:
            logger.info("Found API key in environment variables")
            return api_key

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
                        logger.info(f"Found API key in {config_path}")
                        return api_key
                except Exception as e:
                    logger.debug(f"Failed to read {config_path}: {e}")
                    continue

        # No API key found, prompt user
        logger.warning("No API key found in environment or config files")
        print("\n" + "="*60)
        print("ANTHROPIC API KEY REQUIRED")
        print("="*60)
        print("No API key was found. You need an Anthropic API key to use Claude.")
        print("Get your API key at: https://console.anthropic.com/settings/keys")
        print("="*60 + "\n")

        try:
            api_key = input("Enter your Anthropic API key (or press Enter to skip): ").strip()

            if api_key:
                # Ask if they want to save it
                save = input("Save this key for future use? (y/n): ").strip().lower()
                if save == 'y':
                    self.save_api_key(api_key)
                    logger.info("API key saved successfully")
                return api_key
            else:
                logger.warning("No API key provided - operations will fail")
                return None

        except (EOFError, KeyboardInterrupt):
            logger.warning("\nAPI key input cancelled")
            return None

    def _install_claude(self) -> bool:
        """
        Install Claude CLI using homebrew.

        Returns:
            True if installation successful, False otherwise
        """
        logger.warning("Claude CLI not found. Attempting installation...")
        print("Claude CLI not found. Installing...")

        try:
            # Check if homebrew is installed
            logger.info("Checking for homebrew...")
            result = subprocess.run(
                ["which", "brew"],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                logger.error("Homebrew not found")
                print("✗ Homebrew not found. Please install homebrew first: https://brew.sh")
                return False

            # Install Claude
            logger.info("Running: brew install anthropics/claude/claude")
            print("Running: brew install anthropics/claude/claude")
            print("This may take a few minutes...")

            result = subprocess.run(
                ["brew", "install", "anthropics/claude/claude"],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout for installation
            )

            if result.returncode != 0:
                logger.error(f"Installation failed: {result.stderr}")
                print(f"✗ Installation failed: {result.stderr}")
                return False

            logger.info("Claude CLI installed successfully!")
            print("✓ Claude CLI installed successfully!")
            return True

        except subprocess.TimeoutExpired:
            logger.error("Installation timed out after 5 minutes")
            print("✗ Installation timed out after 5 minutes")
            return False
        except Exception as e:
            logger.error(f"Installation error: {e}")
            print(f"✗ Installation error: {e}")
            return False

    def _find_or_install_claude(self) -> str:
        """
        Find the Claude binary in the system, install if not found.

        Returns:
            Path to Claude binary

        Raises:
            RuntimeError: If Claude cannot be found or installed
        """
        logger.info("Searching for Claude CLI...")
        result = subprocess.run(
            ["which", "claude"],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            logger.warning("Claude CLI not found in PATH")
            # Try to install
            if self._install_claude():
                # Try to find it again
                logger.info("Verifying installation...")
                result = subprocess.run(
                    ["which", "claude"],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    claude_path = result.stdout.strip()
                    logger.info(f"Claude CLI found at: {claude_path}")
                    return claude_path

            error_msg = (
                "Claude CLI not found and could not be installed. "
                "Please install manually: brew install anthropics/claude/claude"
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        claude_path = result.stdout.strip()
        logger.info(f"Found Claude CLI at: {claude_path}")
        return claude_path

    def forward(self,
                query: str,
                path: Optional[str] = None,
                mod = None,
                model: str = "sonnet",
                output_format: str = "json",
                bypass_permissions: bool = True,
                stream_output: bool = True,
                additional_options: Optional[Dict[str, Any]] = None, **kwargs) -> Union[str, Dict[str, Any]]:
        """
        Execute a Claude Code query in the background without user prompts.

        Args:
            query: The prompt/question to send to Claude Code
            path: Working directory path (defaults to self.default_path)
            model: Model to use (sonnet, opus, haiku)
            output_format: Output format (json, text, stream-json)
            bypass_permissions: If True, bypasses all permission checks
            stream_output: If True, streams output in real-time so you can see what Claude is doing
            additional_options: Additional CLI options as key-value pairs

        Returns:
            Response from Claude Code (parsed JSON if output_format='json', otherwise text)

        Example:
            >>> mod = Mod()
            >>> result = mod.forward(
            ...     query="Analyze the main.py file and suggest improvements",
            ...     path="/path/to/project",
            ...     stream_output=True  # See output in real-time
            ... )
        """
        if mod != None:
            path = m.dp(mod)

        work_dir = path or self.default_path

        # Check if API key is available
        if not self.api_key:
            logger.error("No API key available - cannot execute Claude Code")
            raise RuntimeError(
                "No API key available. Please set ANTHROPIC_API_KEY environment variable "
                "or save an API key using mod.save_api_key()"
            )

        logger.info(f"Executing Claude Code query in: {work_dir}")
        logger.info(f"Model: {model}, Format: {output_format}")
        logger.debug(f"Query: {query[:100]}..." if len(query) > 100 else f"Query: {query}")

        # Build command
        cmd = [
            self.claude_bin,
            "--print",
            "--model", model,
            "--output-format", output_format,
        ]

        # Add permission bypass flags
        if bypass_permissions:
            cmd.extend([
                "--dangerously-skip-permissions",
                "--permission-mode", "bypassPermissions"
            ])
            logger.debug("Permission bypass enabled")

        # Add any additional options
        if additional_options:
            logger.debug(f"Additional options: {additional_options}")
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

        # Log the command (without the API key for security)
        cmd_safe = [c if not c.startswith('sk-') else '***' for c in cmd]
        print(cmd_safe)
        logger.info(f"Running command: {' '.join(cmd_safe[:5])}... (truncated)")

        # Execute Claude Code
        logger.info("Sending request to Claude Code...")
        try:
            if stream_output:
                # Stream output in real-time
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

                # Read output in real-time
                import select
                import time

                while True:
                    # Check if process has finished
                    retcode = process.poll()

                    # Read stdout
                    if process.stdout:
                        line = process.stdout.readline()
                        if line:
                            print(line, end='', flush=True)
                            stdout_lines.append(line)

                    # Read stderr
                    if process.stderr:
                        err_line = process.stderr.readline()
                        if err_line:
                            print(f"[STDERR] {err_line}", end='', flush=True)
                            stderr_lines.append(err_line)

                    if retcode is not None:
                        # Process finished, read any remaining output
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
                    logger.error(f"Claude Code error: {stderr_text}")
                    raise RuntimeError(f"Claude Code error: {stderr_text}")

                logger.info("Successfully received response from Claude Code")

                # Parse output based on format
                if output_format == "json":
                    try:
                        parsed = json.loads(stdout_text)
                        logger.debug(f"Successfully parsed JSON response")
                        return parsed
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse JSON: {e}")
                        return {"raw_output": stdout_text, "error": "Failed to parse JSON"}

                return stdout_text
            else:
                # Capture output silently (original behavior)
                result = subprocess.run(
                    cmd,
                    cwd=work_dir,
                    capture_output=True,
                    text=True,
                    env=env,
                    timeout=300  # 5 minute timeout
                )

                logger.info(f"Claude Code returned with exit code: {result.returncode}")

                if result.returncode != 0:
                    logger.error(f"Claude Code error: {result.stderr}")
                    raise RuntimeError(f"Claude Code error: {result.stderr}")

                logger.info("Successfully received response from Claude Code")

                # Parse output based on format
                if output_format == "json":
                    try:
                        parsed = json.loads(result.stdout)
                        logger.debug(f"Successfully parsed JSON response")
                        return parsed
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse JSON: {e}")
                        return {"raw_output": result.stdout, "error": "Failed to parse JSON"}

                return result.stdout

        except subprocess.TimeoutExpired:
            logger.error("Claude Code request timed out after 5 minutes")
            raise RuntimeError("Claude Code request timed out after 5 minutes")
        except Exception as e:
            logger.error(f"Unexpected error executing Claude Code: {e}")
            raise

    def router(self):
        """Get or create the OpenRouter instance for API proxying."""
        if self._router is None:
            self._router = m.mod('model.openrouter')()
        return self._router

    def ask(self, message: str, model: str = None, stream: bool = False,
            history: list = None, system_prompt: str = None,
            temperature: float = 1.0, max_tokens: int = 10000000, **kwargs) -> str:
        """
        Send a message to Claude via OpenRouter API.
        This is the primary method exposed when serving access to others.

        Args:
            message: The message to send to Claude
            model: Model to use (default: self.model)
            stream: Whether to stream the response
            history: Conversation history
            system_prompt: System prompt
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Returns:
            Response text from Claude
        """
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
        """List available Claude models via OpenRouter."""
        return self.router().models(search=search)

    def analyze_code(self,
                     path: str,
                     focus: Optional[str] = None,
                     stream_output: bool = False) -> Dict[str, Any]:
        """
        Analyze code in a directory or file.

        Args:
            path: Path to directory or file
            focus: Optional specific aspect to focus on (e.g., "performance", "security")
            stream_output: If True, streams output in real-time

        Returns:
            Analysis results as a dictionary
        """
        query = f"Analyze the code"
        if focus:
            query += f" focusing on {focus}"

        return self.forward(query=query, path=path, stream_output=stream_output)

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

    def edit_file(self,
                  file_path: str,
                  instructions: str,
                  path: Optional[str] = None,
                  mod = None,
                  stream_output: bool = False) -> Dict[str, Any]:
        """
        Edit a specific file based on instructions.

        Args:
            file_path: Path to the file to edit (relative to working directory)
            instructions: Instructions on what changes to make
            path: Working directory (defaults to self.default_path)
            mod: Optional mod object to get path from
            stream_output: If True, streams output in real-time

        Returns:
            Edit results from Claude Code

        Example:
            >>> mod = Mod()
            >>> result = mod.edit_file(
            ...     file_path="main.py",
            ...     instructions="Add error handling to the parse_config function",
            ...     path="/path/to/project",
            ...     stream_output=True
            ... )
        """
        if mod is not None:
            path = m.dp(mod)

        work_dir = path or self.default_path

        query = f"Edit the file {file_path}: {instructions}"

        return self.forward(query=query, path=work_dir, stream_output=stream_output)

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
        logger.info(f"Starting batch processing of {len(queries)} queries")
        results = []
        for i, query in enumerate(queries, 1):
            logger.info(f"Processing query {i}/{len(queries)}: {query[:50]}...")
            try:
                result = self.forward(
                    query=query,
                    path=path,
                    model=model
                )
                results.append({"query": query, "result": result, "success": True})
                logger.info(f"✓ Query {i}/{len(queries)} completed successfully")
            except Exception as e:
                logger.error(f"✗ Query {i}/{len(queries)} failed: {e}")
                results.append({"query": query, "error": str(e), "success": False})

        successful = sum(1 for r in results if r.get('success'))
        logger.info(f"Batch processing complete: {successful}/{len(queries)} successful")
        return results

    # ── Background Job Management (via Rust server) ──────────────────

    def _jobs_url(self) -> str:
        """Get the Claude Jobs server URL."""
        return os.environ.get('CLAUDE_JOBS_URL', 'http://localhost:8820')

    def _jobs_request(self, method: str, path: str, data: dict = None) -> dict:
        """Make a request to the Claude Jobs server."""
        import urllib.request
        url = f"{self._jobs_url()}{path}"
        body = json.dumps(data).encode() if data else None
        headers = {'Content-Type': 'application/json'} if data else {}

        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            logger.error(f"Jobs server request failed: {e}")
            raise RuntimeError(
                f"Claude Jobs server not reachable at {self._jobs_url()}. "
                "Start it with: cd mod/orbit/claude/server && cargo run"
            )

    def submit(self, prompt: str, model: str = "sonnet", work_dir: str = None) -> dict:
        """
        Submit a background Claude job to the Rust job server.

        Args:
            prompt: Task prompt
            model: Model to use (sonnet, opus, haiku)
            work_dir: Working directory for the job

        Returns:
            Job object with id, status, etc.
        """
        data = {"prompt": prompt, "model": model}
        if work_dir:
            data["work_dir"] = work_dir
        return self._jobs_request("POST", "/jobs", data)

    def jobs(self) -> list:
        """List all background jobs."""
        result = self._jobs_request("GET", "/jobs")
        return result.get("jobs", [])

    def job(self, job_id: str) -> dict:
        """Get a specific job by ID."""
        return self._jobs_request("GET", f"/jobs/{job_id}")

    def cancel(self, job_id: str) -> dict:
        """Cancel a running job."""
        return self._jobs_request("POST", f"/jobs/{job_id}/cancel")

    def delete_job(self, job_id: str) -> dict:
        """Delete a job."""
        return self._jobs_request("DELETE", f"/jobs/{job_id}")

    def logs(self, job_id: str) -> str:
        """Get output logs for a job."""
        result = self._jobs_request("GET", f"/jobs/{job_id}")
        return result.get("output", "")

    def serve_jobs(self, port: int = 8820) -> None:
        """Start the Claude Jobs Rust server."""
        server_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'server')
        logger.info(f"Starting Claude Jobs server on port {port}...")
        subprocess.Popen(
            ["cargo", "run", "--release", "--", str(port)],
            cwd=server_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"Claude Jobs server starting on port {port}")


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
    logger.info("Running quick Claude Code query")
    mod = Mod(default_path=path, api_key=api_key)
    return mod.forward(query=query, path=path, **kwargs)
