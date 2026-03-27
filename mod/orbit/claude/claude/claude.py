import subprocess
import json
import os
import sys
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Union, List
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

    Provides programmatic access to Claude Code for automated code operations.
    Uses a unified architecture where all operations (read and write) flow through
    the same backend with permission checks based on operation type.

    Key Features:
    - Unified operation model - all operations use forward()
    - Owner-based access control for write operations
    - Automatic IPFS versioning for code changes
    - Read-only operations (analyze, debug) require no permission
    - Write operations (edit, generate, refactor) require owner key
    - Background job execution via Rust server
    - Multi-model support via OpenRouter

    See UNIFIED_OPERATIONS.md for architectural details.
    """

    description = """
    Claude Code Interface - Unified AI developer interface with permission control.

    Supports two creation modes:
    - "new": Create new modules from scratch or import from GitHub
    - "edit": Edit existing modules in your orbit directory
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

    def __init__(self, default_path: Optional[str] = None, api_key: Optional[str] = None, model: str = 'anthropic/claude-opus-4', owner: Optional[str] = None, **kwargs):
        """
        Initialize the Claude Code interface.

        Args:
            default_path: Default working directory for Claude Code operations
            api_key: Optional Anthropic API key (None = use Claude Max subscription auth)
            model: Default model for OpenRouter API calls (default: anthropic/claude-opus-4)
            owner: Owner address/key for access control (only owner can edit)
        """
        logger.info("Initializing Claude Code interface...")
        self.default_path = default_path or os.getcwd()
        self.model = model
        self._router = None
        self._ipfs = None
        logger.info(f"Default path: {self.default_path}")

        # API key is optional — Claude Max auth works without one
        self.api_key = api_key or os.environ.get('ANTHROPIC_AUTH_TOKEN') or os.environ.get('ANTHROPIC_API_KEY')
        if self.api_key:
            logger.info("API key configured successfully")
        else:
            logger.info("No API key — using Claude Max subscription auth")

        # Initialize owner and permissions
        self.owner = owner or self._load_owner()
        self._init_permissions()

        # Initialize CID history
        self.history_path = os.path.join(str(Path.home()), '.mod', 'claude', 'cid_history.json')
        os.makedirs(os.path.dirname(self.history_path), exist_ok=True)

        # Ensure config.json exists with URLs for commune registration
        self._ensure_config()

        self.claude_bin = self._find_or_install_claude()
        logger.info("Claude Code interface initialized successfully")

    def _load_owner(self) -> Optional[str]:
        """
        Load owner address from config file.

        Returns:
            Owner address or None
        """
        config_path = os.path.join(str(Path.home()), '.mod', 'claude', 'owner.json')
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    return config.get('owner')
            except Exception as e:
                logger.warning(f"Failed to load owner config: {e}")
        return None

    def _ensure_config(self) -> None:
        """
        Ensure config.json exists with app and API URLs for commune registration.
        Creates it if missing, stores content to IPFS and saves CID for on-chain registration.
        """
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')

        if not os.path.exists(config_path):
            logger.info("config.json not found, creating with default URLs")

            # Default configuration with app and API URLs
            config = {
                "name": "claude",
                "version": "1.0.0",
                "description": "Programmable AI developer interface with Python SDK, Rust Job Server, and 8-Bit Terminal UI",
                "urls": {
                    "app": "http://localhost:8821",
                    "api": "http://localhost:8820"
                },
                "fns": [
                    "forward",
                    "ask",
                    "analyze_code",
                    "generate_code",
                    "refactor",
                    "debug",
                    "edit_file",
                    "run_task",
                    "batch_process",
                    "bg",
                    "submit",
                    "create_module",
                    "edit_module"
                ],
                "endpoints": {
                    "/health": "Health check",
                    "/repos": "List git repositories",
                    "/auth/challenge": "Get signature challenge",
                    "/auth/verify": "Verify signature and get JWT",
                    "/jobs": "Submit and list jobs",
                    "/jobs/{id}": "Get job details",
                    "/jobs/{id}/cancel": "Cancel running job",
                    "/jobs/{id}/stream": "SSE stream of job output"
                }
            }

            # Write config.json
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)

            logger.info(f"Created config.json at {config_path}")

            # Store to IPFS for commune registration
            try:
                ipfs_client = self.ipfs()
                config_cid = ipfs_client.put(config)

                # Store CID reference for commune registration
                cid_path = os.path.join(str(Path.home()), '.mod', 'claude', 'config_cid.json')
                os.makedirs(os.path.dirname(cid_path), exist_ok=True)

                with open(cid_path, 'w') as f:
                    json.dump({
                        'cid': config_cid,
                        'timestamp': os.path.getmtime(config_path),
                        'gateway': f'https://ipfs.io/ipfs/{config_cid}'
                    }, f, indent=2)

                logger.info(f"Config stored to IPFS: {config_cid}")
                logger.info(f"Use this CID for commune registration")

            except Exception as e:
                logger.warning(f"Failed to store config to IPFS: {e}")
                logger.info("Config file created locally, IPFS storage optional")
        else:
            logger.info(f"config.json exists at {config_path}")

    def _init_permissions(self) -> None:
        """Initialize permissions system based on owner."""
        if not self.owner:
            logger.info("No owner set - first authenticated user will become owner")
            logger.info("Use set_owner() to manually set the owner address")

    def set_owner(self, owner: str) -> None:
        """
        Set the owner address for access control.
        Only the owner can perform edit operations.

        Args:
            owner: Ethereum address or key to set as owner
        """
        config_path = os.path.join(str(Path.home()), '.mod', 'claude', 'owner.json')
        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        # Normalize address
        if hasattr(owner, 'address'):
            owner = owner.address
        owner = owner.lower()

        config = {'owner': owner}
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

        self.owner = owner
        logger.info(f"Owner set to: {owner}")
        print(f"✓ Owner set to: {owner}")
        print("  Only this address can perform edit operations.")

    def get_owner(self) -> Optional[str]:
        """Get the current owner address."""
        return self.owner

    def reload_owner(self) -> Optional[str]:
        """
        Reload owner configuration from disk.
        Useful after the first user authenticates via the web UI.

        Returns:
            The new owner address, or None if still not set
        """
        self.owner = self._load_owner()
        if self.owner:
            logger.info(f"Owner reloaded: {self.owner}")
        else:
            logger.info("No owner set yet")
        return self.owner

    def is_owner(self, key=None) -> bool:
        """
        Check if the given key is the owner.

        Args:
            key: Key object or address string to check

        Returns:
            True if key is owner or no owner is set
        """
        if not self.owner:
            return True  # No owner = everyone has access

        if key is None:
            key = m.key()

        # Normalize key to address
        if hasattr(key, 'address'):
            key = key.address
        key = str(key).lower()

        return key == self.owner

    def require_owner(self, key=None, operation: str = "operation") -> None:
        """
        Require that the key is the owner, raise error otherwise.

        Args:
            key: Key to check
            operation: Name of operation for error message

        Raises:
            PermissionError: If key is not owner
        """
        if not self.is_owner(key):
            current_key = key
            if hasattr(key, 'address'):
                current_key = key.address
            elif key is None:
                current_key = m.key().address
            raise PermissionError(
                f"Access denied: {operation} requires owner permission.\n"
                f"Current key: {current_key}\n"
                f"Owner: {self.owner}\n"
                f"Only the owner can perform this operation."
            )

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
                additional_options: Optional[Dict[str, Any]] = None,
                key = None,
                store_ipfs: bool = False,
                description: str = None,
                requires_owner: bool = None,
                **kwargs) -> Union[str, Dict[str, Any]]:
        """
        Execute a Claude Code query.

        Args:
            query: The prompt/question to send to Claude Code
            path: Working directory path (defaults to self.default_path)
            model: Model to use (sonnet, opus, haiku)
            output_format: Output format (json, text, stream-json)
            bypass_permissions: If True, bypasses all permission checks
            stream_output: If True, streams output in real-time so you can see what Claude is doing
            additional_options: Additional CLI options as key-value pairs
            key: Key for permission check (only owner can edit)
            store_ipfs: If True, stores result to IPFS and shows CID
            description: Description for IPFS history entry
            requires_owner: If True, requires owner permission. If None, auto-detects based on query keywords.

        Returns:
            Response from Claude Code (parsed JSON if output_format='json', otherwise text)

        Example:
            >>> mod = Mod()
            >>> result = mod.forward(
            ...     query="Analyze the main.py file and suggest improvements",
            ...     path="/path/to/project",
            ...     stream_output=True,  # See output in real-time
            ...     store_ipfs=True  # Store to IPFS
            ... )
        """
        # Check if this is an edit operation (requires owner permission)
        if requires_owner is None:
            # Auto-detect based on query keywords
            requires_owner = any(keyword in query.lower() for keyword in [
                'edit', 'modify', 'change', 'update', 'refactor', 'fix', 'add', 'remove', 'delete'
            ])

        if requires_owner:
            self.require_owner(key, operation="code editing")
            logger.info("Owner permission verified for edit operation")

        is_edit_op = requires_owner

        if mod != None:
            path = m.dp(mod)

        work_dir = path or self.default_path

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

        # Prepare environment — pass API key if we have one, otherwise Claude uses Max auth
        env = os.environ.copy()
        if self.api_key:
            env.setdefault('ANTHROPIC_API_KEY', self.api_key)

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
                        result_data = parsed
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse JSON: {e}")
                        result_data = {"raw_output": stdout_text, "error": "Failed to parse JSON"}
                else:
                    result_data = stdout_text

                # Store to IPFS if requested (for edit operations)
                if store_ipfs and is_edit_op:
                    try:
                        # Create metadata for IPFS
                        ipfs_data = {
                            'query': query,
                            'result': result_data,
                            'work_dir': work_dir,
                            'model': model,
                            'description': description or query[:100]
                        }
                        cid = self._store_to_ipfs(ipfs_data, description or query[:100])
                        print("\n" + "="*60)
                        print("IPFS STORAGE")
                        print("="*60)
                        print(f"CID: {cid}")
                        print(f"Gateway: https://ipfs.io/ipfs/{cid}")
                        print("="*60 + "\n")
                    except Exception as e:
                        logger.warning(f"Failed to store to IPFS: {e}")

                return result_data
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
                        result_data = parsed
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse JSON: {e}")
                        result_data = {"raw_output": result.stdout, "error": "Failed to parse JSON"}
                else:
                    result_data = result.stdout

                # Store to IPFS if requested (for edit operations)
                if store_ipfs and is_edit_op:
                    try:
                        # Create metadata for IPFS
                        ipfs_data = {
                            'query': query,
                            'result': result_data,
                            'work_dir': work_dir,
                            'model': model,
                            'description': description or query[:100]
                        }
                        cid = self._store_to_ipfs(ipfs_data, description or query[:100])
                        print("\n" + "="*60)
                        print("IPFS STORAGE")
                        print("="*60)
                        print(f"CID: {cid}")
                        print(f"Gateway: https://ipfs.io/ipfs/{cid}")
                        print("="*60 + "\n")
                    except Exception as e:
                        logger.warning(f"Failed to store to IPFS: {e}")

                return result_data

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

    def ipfs(self):
        """Get or create the IPFS client instance."""
        if self._ipfs is None:
            try:
                self._ipfs = m.mod('ipfs')()
                logger.info("IPFS client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize IPFS: {e}")
                raise RuntimeError(
                    "IPFS module not available. Install with: m install ipfs"
                )
        return self._ipfs

    def _store_to_ipfs(self, content: Dict[str, Any], description: str = None) -> str:
        """
        Store content to IPFS and track in history.

        Args:
            content: Content to store
            description: Optional description of the update

        Returns:
            IPFS CID
        """
        try:
            ipfs_client = self.ipfs()
            cid = ipfs_client.put(content)
            logger.info(f"Stored to IPFS: {cid}")

            # Add to history
            self._add_to_history(cid, description)

            return cid
        except Exception as e:
            logger.error(f"Failed to store to IPFS: {e}")
            raise

    def _add_to_history(self, cid: str, description: str = None) -> None:
        """
        Add a CID to the history log.

        Args:
            cid: IPFS CID to record
            description: Optional description
        """
        import time

        history = self._load_history()

        entry = {
            'cid': cid,
            'timestamp': time.time(),
            'date': time.strftime('%Y-%m-%d %H:%M:%S'),
            'description': description or 'Code update'
        }

        history.append(entry)

        # Save history
        with open(self.history_path, 'w') as f:
            json.dump(history, f, indent=2)

        logger.info(f"Added to history: {cid}")

    def _load_history(self) -> List[Dict[str, Any]]:
        """Load CID history from file."""
        if os.path.exists(self.history_path):
            try:
                with open(self.history_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load history: {e}")
        return []

    def get_history(self, limit: int = None) -> List[Dict[str, Any]]:
        """
        Get CID history, newest first.

        Args:
            limit: Optional limit on number of entries

        Returns:
            List of history entries
        """
        history = self._load_history()
        history.reverse()  # Newest first

        if limit:
            history = history[:limit]

        return history

    def show_history(self, limit: int = 10) -> None:
        """
        Display CID history in a readable format.

        Args:
            limit: Number of entries to show (default: 10)
        """
        history = self.get_history(limit=limit)

        if not history:
            print("No history entries found.")
            return

        print("\n" + "="*80)
        print(f"IPFS CID HISTORY (showing {len(history)} most recent)")
        print("="*80)

        for i, entry in enumerate(history, 1):
            print(f"\n{i}. {entry['date']}")
            print(f"   CID: {entry['cid']}")
            print(f"   Description: {entry['description']}")

            # Show IPFS gateway link
            print(f"   View: https://ipfs.io/ipfs/{entry['cid']}")

        print("\n" + "="*80 + "\n")

    def get_latest_cid(self) -> Optional[str]:
        """Get the most recent CID from history."""
        history = self.get_history(limit=1)
        return history[0]['cid'] if history else None

    def snapshot(self, description: str = None, version: str = None) -> Dict[str, Any]:
        """
        Take a snapshot of the current module state and store it to IPFS.
        Creates a versioned entry in the changelog that can be restored later.

        Args:
            description: Description of this version / what changed
            version: Optional semantic version label (e.g. "1.2.0"). Auto-increments if not provided.

        Returns:
            Dict with cid, version, description, and gateway URL
        """
        import time
        import glob as glob_mod

        # Determine version
        changelog = self._load_changelog()
        if version is None:
            if changelog:
                last_ver = changelog[-1].get('version', '0.0.0')
                parts = last_ver.split('.')
                try:
                    parts[-1] = str(int(parts[-1]) + 1)
                    version = '.'.join(parts)
                except ValueError:
                    version = f"{last_ver}.1"
            else:
                version = '0.1.0'

        # Collect module files to snapshot
        module_root = os.path.dirname(os.path.dirname(__file__))
        snapshot_data = {
            'module': 'claude',
            'version': version,
            'description': description or f'Snapshot v{version}',
            'timestamp': time.time(),
            'date': time.strftime('%Y-%m-%d %H:%M:%S'),
            'files': {}
        }

        # Include key source files
        for pattern in ['claude/*.py', 'config.json', 'requirements.txt', 'api/src/*.rs', 'api/Cargo.toml']:
            for filepath in glob_mod.glob(os.path.join(module_root, pattern)):
                try:
                    with open(filepath, 'r') as f:
                        rel = os.path.relpath(filepath, module_root)
                        snapshot_data['files'][rel] = f.read()
                except Exception:
                    pass

        # Store to IPFS
        cid = self._store_to_ipfs(snapshot_data, description=f'v{version}: {description or "snapshot"}')

        # Add to changelog
        entry = {
            'version': version,
            'cid': cid,
            'timestamp': time.time(),
            'date': time.strftime('%Y-%m-%d %H:%M:%S'),
            'description': description or f'Snapshot v{version}',
            'file_count': len(snapshot_data['files'])
        }
        changelog.append(entry)
        self._save_changelog(changelog)

        logger.info(f"Snapshot v{version} stored: {cid}")
        print(f"\n{'='*60}")
        print(f"SNAPSHOT v{version}")
        print(f"{'='*60}")
        print(f"CID: {cid}")
        print(f"Files: {len(snapshot_data['files'])}")
        print(f"Gateway: https://ipfs.io/ipfs/{cid}")
        print(f"{'='*60}\n")

        return {
            'version': version,
            'cid': cid,
            'description': entry['description'],
            'date': entry['date'],
            'file_count': len(snapshot_data['files']),
            'gateway': f'https://ipfs.io/ipfs/{cid}'
        }

    def changelog(self, limit: int = None) -> List[Dict[str, Any]]:
        """
        Get the version changelog, newest first.

        Args:
            limit: Optional limit on number of entries

        Returns:
            List of changelog entries with version, cid, date, description
        """
        entries = self._load_changelog()
        entries.reverse()
        if limit:
            entries = entries[:limit]
        return entries

    def show_changelog(self, limit: int = 20) -> None:
        """Display the version changelog in a readable format."""
        entries = self.changelog(limit=limit)

        if not entries:
            print("No changelog entries. Use snapshot() to create the first version.")
            return

        print(f"\n{'='*70}")
        print(f"  CHANGELOG — {len(entries)} version(s)")
        print(f"{'='*70}")

        for i, entry in enumerate(entries):
            marker = "►" if i == 0 else " "
            print(f"\n {marker} v{entry['version']}  ({entry['date']})")
            print(f"   CID: {entry['cid']}")
            print(f"   {entry['description']}")
            if entry.get('file_count'):
                print(f"   Files: {entry['file_count']}")

        print(f"\n{'='*70}\n")

    def get_version(self, version: str = None, cid: str = None) -> Dict[str, Any]:
        """
        Retrieve a specific version from IPFS by version label or CID.

        Args:
            version: Version string (e.g. "0.1.0")
            cid: IPFS CID to retrieve directly

        Returns:
            The stored snapshot data including all files
        """
        if cid:
            ipfs_client = self.ipfs()
            return ipfs_client.get(cid)

        if version:
            changelog = self._load_changelog()
            for entry in changelog:
                if entry['version'] == version:
                    ipfs_client = self.ipfs()
                    return ipfs_client.get(entry['cid'])
            raise ValueError(f"Version '{version}' not found in changelog")

        raise ValueError("Must provide either version or cid")

    def restore_version(self, version: str = None, cid: str = None, dry_run: bool = True) -> Dict[str, Any]:
        """
        Restore the module to a previous version from IPFS.

        Args:
            version: Version string to restore (e.g. "0.1.0")
            cid: IPFS CID to restore from directly
            dry_run: If True, only show what would change without writing (default: True)

        Returns:
            Dict with restored files list and status
        """
        snapshot_data = self.get_version(version=version, cid=cid)
        module_root = os.path.dirname(os.path.dirname(__file__))

        files = snapshot_data.get('files', {})
        if not files:
            raise ValueError("Snapshot contains no files")

        result = {
            'version': snapshot_data.get('version', 'unknown'),
            'files': list(files.keys()),
            'dry_run': dry_run,
            'restored': []
        }

        for rel_path, content in files.items():
            target = os.path.join(module_root, rel_path)
            if dry_run:
                exists = os.path.exists(target)
                result['restored'].append({
                    'path': rel_path,
                    'action': 'overwrite' if exists else 'create',
                    'size': len(content)
                })
            else:
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, 'w') as f:
                    f.write(content)
                result['restored'].append({'path': rel_path, 'action': 'written'})
                logger.info(f"Restored: {rel_path}")

        action = "DRY RUN" if dry_run else "RESTORED"
        print(f"\n{'='*60}")
        print(f"  {action} — v{result['version']}")
        print(f"{'='*60}")
        for f in result['restored']:
            print(f"  {f['action'].upper():>10}  {f['path']}")
        print(f"{'='*60}\n")

        if dry_run:
            print("  Pass dry_run=False to actually restore these files.")

        return result

    def _load_changelog(self) -> List[Dict[str, Any]]:
        """Load changelog from file."""
        changelog_path = os.path.join(str(Path.home()), '.mod', 'claude', 'changelog.json')
        if os.path.exists(changelog_path):
            try:
                with open(changelog_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load changelog: {e}")
        return []

    def _save_changelog(self, changelog: List[Dict[str, Any]]) -> None:
        """Save changelog to file."""
        changelog_path = os.path.join(str(Path.home()), '.mod', 'claude', 'changelog.json')
        os.makedirs(os.path.dirname(changelog_path), exist_ok=True)
        with open(changelog_path, 'w') as f:
            json.dump(changelog, f, indent=2)

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
        Analyze code in a directory or file (read-only operation).

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

        return self.forward(query=query, path=path, stream_output=stream_output, requires_owner=False)

    def generate_code(self,
                     description: str,
                     path: str,
                     file_path: Optional[str] = None,
                     key = None,
                     store_ipfs: bool = True) -> Dict[str, Any]:
        """
        Generate code based on a description (write operation - requires owner).

        Args:
            description: What code to generate
            path: Working directory
            file_path: Optional specific file to create/modify
            key: Key for permission check (only owner can edit)
            store_ipfs: If True, stores result to IPFS (default: True)

        Returns:
            Generation results with IPFS CID
        """
        query = f"Generate code: {description}"
        if file_path:
            query += f" in file {file_path}"

        desc = f"Generate: {description[:80]}"

        return self.forward(
            query=query,
            path=path,
            key=key,
            store_ipfs=store_ipfs,
            description=desc,
            requires_owner=True
        )

    def refactor(self,
                 path: str,
                 instructions: str,
                 target_files: Optional[list] = None,
                 key = None,
                 store_ipfs: bool = True) -> Dict[str, Any]:
        """
        Refactor code based on instructions (write operation - requires owner).

        Args:
            path: Working directory
            instructions: Refactoring instructions
            target_files: Optional list of specific files to refactor
            key: Key for permission check (only owner can edit)
            store_ipfs: If True, stores result to IPFS (default: True)

        Returns:
            Refactoring results with IPFS CID
        """
        query = f"Refactor: {instructions}"
        if target_files:
            query += f"\nTarget files: {', '.join(target_files)}"

        description = f"Refactor: {instructions[:80]}"

        return self.forward(
            query=query,
            path=path,
            key=key,
            store_ipfs=store_ipfs,
            description=description,
            requires_owner=True
        )

    def debug(self,
             path: str,
             issue_description: str,
             file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Debug an issue in the codebase (read-only operation).

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

        return self.forward(query=query, path=path, requires_owner=False)

    def edit_file(self,
                  file_path: str,
                  instructions: str,
                  path: Optional[str] = None,
                  mod = None,
                  stream_output: bool = False,
                  key = None,
                  store_ipfs: bool = True) -> Dict[str, Any]:
        """
        Edit a specific file based on instructions (write operation - requires owner).

        Args:
            file_path: Path to the file to edit (relative to working directory)
            instructions: Instructions on what changes to make
            path: Working directory (defaults to self.default_path)
            mod: Optional mod object to get path from
            stream_output: If True, streams output in real-time
            key: Key for permission check (only owner can edit)
            store_ipfs: If True, stores result to IPFS (default: True)

        Returns:
            Edit results from Claude Code with IPFS CID

        Example:
            >>> mod = Mod()
            >>> result = mod.edit_file(
            ...     file_path="main.py",
            ...     instructions="Add error handling to the parse_config function",
            ...     path="/path/to/project",
            ...     stream_output=True
            ... )
            # Result includes IPFS CID for tracking
        """
        if mod is not None:
            path = m.dp(mod)

        work_dir = path or self.default_path

        query = f"Edit the file {file_path}: {instructions}"
        description = f"Edit {file_path}: {instructions[:80]}"

        return self.forward(
            query=query,
            path=work_dir,
            stream_output=stream_output,
            key=key,
            store_ipfs=store_ipfs,
            description=description,
            requires_owner=True
        )

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

    # ── Local Background Tasks (no server needed) ────────────────────

    def bg(self, prompt: str, path: Optional[str] = None, mod=None,
           model: str = "sonnet", log_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        Fire-and-forget background Claude task using your Max subscription.
        No server required — just spawns claude CLI in the background.

        Args:
            prompt: Task to run
            path: Working directory
            mod: Optional mod name to resolve path
            model: Model (sonnet, opus, haiku)
            log_dir: Where to store output logs (default: ~/.mod/claude/logs/)

        Returns:
            Dict with pid, log_file, and command info

        Example:
            >>> c = Mod()
            >>> task = c.bg("refactor utils.py to use async", mod="core")
            >>> print(task['log_file'])  # tail -f this to watch progress
        """
        if mod is not None:
            path = m.dp(mod)
        work_dir = path or self.default_path

        log_dir = log_dir or os.path.join(str(Path.home()), '.mod', 'claude', 'logs')
        os.makedirs(log_dir, exist_ok=True)

        import time
        task_id = f"{int(time.time())}_{os.getpid()}"
        log_file = os.path.join(log_dir, f"{task_id}.log")

        cmd = [
            self.claude_bin, "--print",
            "--model", model,
            "--output-format", "text",
            "--dangerously-skip-permissions",
        ]
        cmd.append(prompt)

        with open(log_file, 'w') as f:
            f.write(f"# Task: {prompt}\n# Dir: {work_dir}\n# Model: {model}\n# Started: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        log_out = open(log_file, 'a')
        process = subprocess.Popen(
            cmd, cwd=work_dir,
            stdout=log_out, stderr=log_out,
            start_new_session=True,
        )

        logger.info(f"Background task started: PID {process.pid} → {log_file}")
        print(f"Background task started (PID {process.pid})")
        print(f"Log: {log_file}")
        print(f"Watch: tail -f {log_file}")

        return {
            "pid": process.pid,
            "task_id": task_id,
            "log_file": log_file,
            "prompt": prompt,
            "model": model,
            "work_dir": work_dir,
        }

    def bg_status(self, pid: int) -> str:
        """Check if a background task is still running."""
        try:
            os.kill(pid, 0)
            return "running"
        except ProcessLookupError:
            return "completed"
        except PermissionError:
            return "running"

    def bg_list(self, log_dir: Optional[str] = None) -> list:
        """List recent background task logs."""
        log_dir = log_dir or os.path.join(str(Path.home()), '.mod', 'claude', 'logs')
        if not os.path.exists(log_dir):
            return []
        logs = sorted(Path(log_dir).glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
        return [{"file": str(l), "size": l.stat().st_size, "modified": l.stat().st_mtime} for l in logs[:20]]

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
                "Start it with: cd mod/orbit/claude/api && cargo run"
            )

    def submit(self, prompt: str, model: str = "sonnet", work_dir: str = None,
               module_name: str = None, creation_mode: str = None,
               github_url: str = None, anchor_dir: str = None) -> dict:
        """
        Submit a background Claude job to the Rust job server.

        Args:
            prompt: Task prompt
            model: Model to use (sonnet, opus, haiku)
            work_dir: Working directory for the job (edit mode)
            module_name: Name of module to create (for new mode) or use (for edit mode)
            creation_mode: "new" for creating module, "edit" for editing existing
            github_url: GitHub repo URL to import (new mode only)
            anchor_dir: Anchor directory (default: ~/mod or MOD_ANCHOR env var)

        Returns:
            Job object with id, status, etc.

        Examples:
            >>> # Edit existing module
            >>> job = c.submit("fix the bug", module_name="mymod", creation_mode="edit")

            >>> # Create new module from scratch
            >>> job = c.submit("add a REST API", module_name="myapi", creation_mode="new")

            >>> # Create new module from GitHub
            >>> job = c.submit("customize for my use case",
            ...                module_name="myagent", creation_mode="new",
            ...                github_url="https://github.com/user/repo")
        """
        data = {"prompt": prompt, "model": model}
        if work_dir:
            data["work_dir"] = work_dir
        if module_name:
            data["module_name"] = module_name
        if creation_mode:
            data["creation_mode"] = creation_mode
        if github_url:
            data["github_url"] = github_url
        if anchor_dir:
            data["anchor_dir"] = anchor_dir
        return self._jobs_request("POST", "/jobs", data)

    def create_module(self, module_name: str, prompt: str,
                     github_url: str = None, model: str = "sonnet",
                     anchor_dir: str = None) -> dict:
        """
        Create a new module in the orbit directory.

        Args:
            module_name: Name of the new module (auto-inferred from GitHub if not provided)
            prompt: Description of what the module should do
            github_url: Optional GitHub repo URL to import from
            model: Model to use
            anchor_dir: Anchor directory (default: ~/mod)

        Returns:
            Job object

        Examples:
            >>> # Create from scratch
            >>> job = c.create_module("chatbot", "Create a conversational AI module")

            >>> # Create from GitHub repo
            >>> job = c.create_module(
            ...     "myagent",
            ...     "Add web scraping capabilities",
            ...     github_url="https://github.com/user/agent"
            ... )
        """
        return self.submit(
            prompt=prompt,
            model=model,
            module_name=module_name,
            creation_mode="new",
            github_url=github_url,
            anchor_dir=anchor_dir
        )

    def edit_module(self, module_name: str, prompt: str,
                   model: str = "sonnet", anchor_dir: str = None) -> dict:
        """
        Edit an existing module with Claude.

        Args:
            module_name: Name of the module to edit
            prompt: Instructions for what to change
            model: Model to use
            anchor_dir: Anchor directory (default: ~/mod)

        Returns:
            Job object

        Example:
            >>> job = c.edit_module("chatbot", "Add error handling to all API calls")
        """
        return self.submit(
            prompt=prompt,
            model=model,
            module_name=module_name,
            creation_mode="edit",
            anchor_dir=anchor_dir
        )

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

    def tail(self, job_id: str) -> None:
        """
        Live-stream job output via SSE. Prints as it arrives.
        Ctrl+C to detach (job keeps running).

        Args:
            job_id: Job ID to tail
        """
        import urllib.request
        url = f"{self._jobs_url()}/jobs/{job_id}/stream"
        req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})

        print(f"Streaming job {job_id[:8]}...")
        print("-" * 50)

        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                for raw_line in resp:
                    line = raw_line.decode("utf-8", errors="replace").rstrip()
                    if line.startswith("data:"):
                        text = line[5:]
                        if text.strip() == "[DONE]":
                            print("\n--- Job finished ---")
                            break
                        print(text, end="", flush=True)
        except KeyboardInterrupt:
            print("\n--- Detached (job still running) ---")

    def serve_jobs(self, port: int = 8820) -> None:
        """Start the Claude Jobs Rust API."""
        server_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'api')
        logger.info(f"Starting Claude Jobs server on port {port}...")
        subprocess.Popen(
            ["cargo", "run", "--release", "--", str(port)],
            cwd=server_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"Claude Jobs server starting on port {port}")

    def get_config_cid(self) -> Optional[str]:
        """
        Get the IPFS CID of the config.json for commune registration.

        Returns:
            CID string or None if not yet stored
        """
        cid_path = os.path.join(str(Path.home()), '.mod', 'claude', 'config_cid.json')
        if os.path.exists(cid_path):
            try:
                with open(cid_path, 'r') as f:
                    data = json.load(f)
                    return data.get('cid')
            except Exception as e:
                logger.warning(f"Failed to load config CID: {e}")
        return None

    def update_config_urls(self, app_url: str = None, api_url: str = None) -> str:
        """
        Update the app and API URLs in config.json and re-store to IPFS.

        Args:
            app_url: New app URL (default: http://localhost:8821)
            api_url: New API URL (default: http://localhost:8820)

        Returns:
            New IPFS CID for the updated config

        Example:
            >>> c = Mod()
            >>> cid = c.update_config_urls(
            ...     app_url="https://claude.example.com",
            ...     api_url="https://api.claude.example.com"
            ... )
            >>> print(f"Register this CID with commune: {cid}")
        """
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')

        # Load existing config or create new
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
        else:
            # Trigger creation
            self._ensure_config()
            with open(config_path, 'r') as f:
                config = json.load(f)

        # Update URLs
        if 'urls' not in config:
            config['urls'] = {}

        if app_url:
            config['urls']['app'] = app_url
        if api_url:
            config['urls']['api'] = api_url

        # Write updated config
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

        logger.info(f"Updated config.json with URLs: app={config['urls']['app']}, api={config['urls']['api']}")

        # Store to IPFS
        try:
            ipfs_client = self.ipfs()
            config_cid = ipfs_client.put(config)

            # Update CID reference
            cid_path = os.path.join(str(Path.home()), '.mod', 'claude', 'config_cid.json')
            os.makedirs(os.path.dirname(cid_path), exist_ok=True)

            with open(cid_path, 'w') as f:
                json.dump({
                    'cid': config_cid,
                    'timestamp': os.path.getmtime(config_path),
                    'gateway': f'https://ipfs.io/ipfs/{config_cid}',
                    'urls': config['urls']
                }, f, indent=2)

            logger.info(f"Config updated and stored to IPFS: {config_cid}")
            print(f"\n{'='*60}")
            print(f"CONFIG UPDATED")
            print(f"{'='*60}")
            print(f"App URL:  {config['urls']['app']}")
            print(f"API URL:  {config['urls']['api']}")
            print(f"IPFS CID: {config_cid}")
            print(f"Gateway:  https://ipfs.io/ipfs/{config_cid}")
            print(f"{'='*60}\n")
            print(f"✓ Use this CID to register with commune on-chain")

            return config_cid

        except Exception as e:
            logger.error(f"Failed to store config to IPFS: {e}")
            raise RuntimeError(f"Failed to store config to IPFS: {e}")

    def show_config(self) -> None:
        """
        Display the current config.json and its IPFS CID for commune registration.
        """
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')

        if not os.path.exists(config_path):
            print("No config.json found. Initializing...")
            self._ensure_config()

        with open(config_path, 'r') as f:
            config = json.load(f)

        cid = self.get_config_cid()

        print(f"\n{'='*60}")
        print("CLAUDE MODULE CONFIGURATION")
        print(f"{'='*60}")
        print(json.dumps(config, indent=2))
        print(f"{'='*60}")

        if cid:
            print(f"\nIPFS CID: {cid}")
            print(f"Gateway:  https://ipfs.io/ipfs/{cid}")
            print(f"\n✓ Use this CID to register with commune on-chain")
        else:
            print("\n⚠ Not yet stored to IPFS")
            print("  Run update_config_urls() to store to IPFS")

        print(f"{'='*60}\n")


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
