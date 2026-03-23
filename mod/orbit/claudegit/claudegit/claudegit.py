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
logger = logging.getLogger('claudegit')


class Mod:
    """
    Claude Code + GitHub Integration Module

    Extends Claude Code with GitHub authentication and automatic force push capabilities.
    All code changes are automatically pushed to a configured GitHub repository.
    """

    description = """
    Claude Code + GitHub Integration - Automate code tasks with AI and sync to GitHub
    """

    @staticmethod
    def set_log_level(level: str = "INFO") -> None:
        """
        Set the logging level for the ClaudeGit module.

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
        api_key: Optional[str] = None,
        model: str = 'anthropic/claude-opus-4',
        owner: Optional[str] = None,
        github_token: Optional[str] = None,
        github_repo: Optional[str] = None,
        github_branch: str = 'main',
        auto_push: bool = True,
        **kwargs
    ):
        """
        Initialize the ClaudeGit interface.

        Args:
            default_path: Default working directory for operations
            api_key: Optional Anthropic API key (None = use Claude Max subscription auth)
            model: Default model for OpenRouter API calls (default: anthropic/claude-opus-4)
            owner: Owner address/key for access control
            github_token: GitHub Personal Access Token for authentication
            github_repo: GitHub repository URL (e.g., 'username/repo' or full URL)
            github_branch: Branch to push to (default: 'main')
            auto_push: Automatically force push after operations (default: True)
        """
        logger.info("Initializing ClaudeGit interface...")
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
        self.history_path = os.path.join(str(Path.home()), '.mod', 'claudegit', 'cid_history.json')
        os.makedirs(os.path.dirname(self.history_path), exist_ok=True)

        # GitHub configuration
        self.github_token = github_token or os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
        self.github_repo = github_repo or os.environ.get('GITHUB_REPO')
        self.github_branch = github_branch
        self.auto_push = auto_push

        # Load or save GitHub config
        self._load_github_config()

        if not self.github_token:
            logger.warning("No GitHub token configured! Set GITHUB_TOKEN environment variable or pass github_token parameter")
        else:
            logger.info("GitHub token configured")

        if not self.github_repo:
            logger.warning("No GitHub repository configured! Set GITHUB_REPO or pass github_repo parameter")
        else:
            logger.info(f"GitHub repository: {self.github_repo}")
            logger.info(f"GitHub branch: {self.github_branch}")
            logger.info(f"Auto push: {self.auto_push}")

        # Ensure config.json exists
        self._ensure_config()

        self.claude_bin = self._find_or_install_claude()
        logger.info("ClaudeGit interface initialized successfully")

    def _load_owner(self) -> Optional[str]:
        """Load owner address from config file."""
        config_path = os.path.join(str(Path.home()), '.mod', 'claudegit', 'owner.json')
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    return config.get('owner')
            except Exception as e:
                logger.warning(f"Failed to load owner config: {e}")
        return None

    def _load_github_config(self) -> None:
        """Load GitHub configuration from file."""
        config_path = os.path.join(str(Path.home()), '.mod', 'claudegit', 'github.json')

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    self.github_token = self.github_token or config.get('token')
                    self.github_repo = self.github_repo or config.get('repo')
                    self.github_branch = config.get('branch', self.github_branch)
                    self.auto_push = config.get('auto_push', self.auto_push)
                    logger.info("Loaded GitHub config from file")
            except Exception as e:
                logger.warning(f"Failed to load GitHub config: {e}")

        # Save current config
        self._save_github_config()

    def _save_github_config(self) -> None:
        """Save GitHub configuration to file."""
        config_path = os.path.join(str(Path.home()), '.mod', 'claudegit', 'github.json')
        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        config = {
            'token': self.github_token,
            'repo': self.github_repo,
            'branch': self.github_branch,
            'auto_push': self.auto_push
        }

        try:
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            # Make file readable only by owner (contains token)
            os.chmod(config_path, 0o600)
            logger.info(f"Saved GitHub config to {config_path}")
        except Exception as e:
            logger.warning(f"Failed to save GitHub config: {e}")

    def _ensure_config(self) -> None:
        """Ensure config.json exists with app and API URLs."""
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')

        if not os.path.exists(config_path):
            logger.info("config.json not found, creating with default URLs")

            config = {
                "name": "claudegit",
                "version": "1.0.0",
                "description": "Claude Code + GitHub Integration - Automated AI code tasks with GitHub sync",
                "urls": {
                    "app": "http://localhost:8831",
                    "api": "http://localhost:8830"
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
                    "fork_module",
                    "git_push",
                    "git_force_push",
                    "configure_github",
                    "sync_to_github"
                ],
                "endpoints": {
                    "/health": "Health check",
                    "/repos": "List git repositories",
                    "/auth/challenge": "Get signature challenge",
                    "/auth/verify": "Verify signature and get JWT",
                    "/jobs": "Submit and list jobs",
                    "/jobs/{id}": "Get job details",
                    "/jobs/{id}/cancel": "Cancel running job",
                    "/jobs/{id}/stream": "SSE stream of job output",
                    "/github/push": "Force push to GitHub"
                }
            }

            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)

            logger.info(f"Created config.json at {config_path}")
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

        Args:
            owner: Ethereum address or key to set as owner
        """
        config_path = os.path.join(str(Path.home()), '.mod', 'claudegit', 'owner.json')
        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        config = {'owner': owner}
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

        self.owner = owner
        logger.info(f"Owner set to {owner}")

    def _find_or_install_claude(self) -> str:
        """Find or install Claude CLI."""
        # Check if claude is in PATH
        try:
            result = subprocess.run(['which', 'claude'], capture_output=True, text=True, check=True)
            claude_bin = result.stdout.strip()
            logger.info(f"Found Claude CLI at {claude_bin}")
            return claude_bin
        except subprocess.CalledProcessError:
            logger.warning("Claude CLI not found in PATH")

            # Try to install via homebrew
            try:
                logger.info("Attempting to install Claude CLI via Homebrew...")
                subprocess.run(['brew', 'install', 'anthropics/claude/claude'], check=True)
                result = subprocess.run(['which', 'claude'], capture_output=True, text=True, check=True)
                claude_bin = result.stdout.strip()
                logger.info(f"Installed Claude CLI at {claude_bin}")
                return claude_bin
            except Exception as e:
                logger.error(f"Failed to install Claude CLI: {e}")
                raise RuntimeError(
                    "Claude CLI not found. Install it with: brew install anthropics/claude/claude"
                )

    def configure_github(
        self,
        token: Optional[str] = None,
        repo: Optional[str] = None,
        branch: Optional[str] = None,
        auto_push: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Configure GitHub integration settings.

        Args:
            token: GitHub Personal Access Token
            repo: GitHub repository (username/repo or full URL)
            branch: Branch to push to
            auto_push: Enable/disable automatic push after operations

        Returns:
            Current GitHub configuration
        """
        if token is not None:
            self.github_token = token
        if repo is not None:
            self.github_repo = repo
        if branch is not None:
            self.github_branch = branch
        if auto_push is not None:
            self.auto_push = auto_push

        self._save_github_config()

        return {
            'token_set': bool(self.github_token),
            'repo': self.github_repo,
            'branch': self.github_branch,
            'auto_push': self.auto_push
        }

    def _setup_git_remote(self, path: Optional[str] = None) -> None:
        """
        Configure git remote with GitHub authentication.

        Args:
            path: Working directory (default: self.default_path)
        """
        path = path or self.default_path

        if not self.github_token or not self.github_repo:
            raise ValueError("GitHub token and repo must be configured. Use configure_github() first.")

        # Parse repo URL
        if self.github_repo.startswith('http'):
            repo_url = self.github_repo
        else:
            repo_url = f"https://github.com/{self.github_repo}.git"

        # Add token to URL for authentication
        authenticated_url = repo_url.replace('https://', f'https://{self.github_token}@')

        try:
            # Check if remote exists
            result = subprocess.run(
                ['git', 'remote', 'get-url', 'origin'],
                cwd=path,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                # Update existing remote
                subprocess.run(
                    ['git', 'remote', 'set-url', 'origin', authenticated_url],
                    cwd=path,
                    check=True,
                    capture_output=True
                )
                logger.info(f"Updated git remote origin with authentication")
            else:
                # Add new remote
                subprocess.run(
                    ['git', 'remote', 'add', 'origin', authenticated_url],
                    cwd=path,
                    check=True,
                    capture_output=True
                )
                logger.info(f"Added git remote origin: {repo_url}")

        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to setup git remote: {e}")
            raise

    def git_force_push(
        self,
        path: Optional[str] = None,
        branch: Optional[str] = None,
        commit_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Force push current changes to GitHub.

        Args:
            path: Working directory (default: self.default_path)
            branch: Branch to push to (default: self.github_branch)
            commit_message: Optional commit message. If None, auto-generates one.

        Returns:
            Dict with push status
        """
        path = path or self.default_path
        branch = branch or self.github_branch

        logger.info(f"Starting force push to {self.github_repo}:{branch}")

        try:
            # Setup git remote with authentication
            self._setup_git_remote(path)

            # Check if there are changes to commit
            status_result = subprocess.run(
                ['git', 'status', '--porcelain'],
                cwd=path,
                capture_output=True,
                text=True,
                check=True
            )

            has_changes = bool(status_result.stdout.strip())

            if has_changes:
                # Stage all changes
                subprocess.run(
                    ['git', 'add', '-A'],
                    cwd=path,
                    check=True,
                    capture_output=True
                )

                # Create commit
                if not commit_message:
                    commit_message = f"ClaudeGit auto-commit: {m.timestamp()}"

                subprocess.run(
                    ['git', 'commit', '-m', commit_message],
                    cwd=path,
                    check=True,
                    capture_output=True
                )
                logger.info(f"Created commit: {commit_message}")
            else:
                logger.info("No changes to commit")

            # Force push to GitHub
            push_result = subprocess.run(
                ['git', 'push', '-f', 'origin', f'HEAD:{branch}'],
                cwd=path,
                capture_output=True,
                text=True,
                check=True
            )

            logger.info(f"Successfully force pushed to {self.github_repo}:{branch}")

            return {
                'success': True,
                'repo': self.github_repo,
                'branch': branch,
                'commit_message': commit_message if has_changes else None,
                'had_changes': has_changes,
                'output': push_result.stdout + push_result.stderr
            }

        except subprocess.CalledProcessError as e:
            error_msg = f"Git operation failed: {e.stderr if hasattr(e, 'stderr') else str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'repo': self.github_repo,
                'branch': branch
            }

    def git_push(self, path: Optional[str] = None, branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Regular push to GitHub (non-force).

        Args:
            path: Working directory
            branch: Branch to push to

        Returns:
            Dict with push status
        """
        path = path or self.default_path
        branch = branch or self.github_branch

        try:
            self._setup_git_remote(path)

            result = subprocess.run(
                ['git', 'push', 'origin', f'HEAD:{branch}'],
                cwd=path,
                capture_output=True,
                text=True,
                check=True
            )

            logger.info(f"Successfully pushed to {self.github_repo}:{branch}")

            return {
                'success': True,
                'repo': self.github_repo,
                'branch': branch,
                'output': result.stdout + result.stderr
            }

        except subprocess.CalledProcessError as e:
            error_msg = f"Git push failed: {e.stderr if hasattr(e, 'stderr') else str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }

    def sync_to_github(
        self,
        path: Optional[str] = None,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sync current state to GitHub with force push.
        Alias for git_force_push() for convenience.

        Args:
            path: Working directory
            message: Commit message

        Returns:
            Dict with sync status
        """
        return self.git_force_push(path=path, commit_message=message)

    def _auto_push_if_enabled(self, path: Optional[str] = None) -> None:
        """Automatically push to GitHub if auto_push is enabled."""
        if self.auto_push and self.github_token and self.github_repo:
            logger.info("Auto-push enabled, syncing to GitHub...")
            result = self.git_force_push(path=path)
            if result['success']:
                logger.info("Auto-push successful")
            else:
                logger.warning(f"Auto-push failed: {result.get('error')}")

    # Inherit all Claude Code methods from the mod framework
    def forward(self, *args, **kwargs):
        """Forward query to Claude Code."""
        return m.fn('claude/forward')(*args, **kwargs)

    def ask(self, *args, **kwargs):
        """Ask Claude a question."""
        result = m.fn('claude/ask')(*args, **kwargs)
        self._auto_push_if_enabled()
        return result

    def analyze_code(self, *args, **kwargs):
        """Analyze code."""
        result = m.fn('claude/analyze_code')(*args, **kwargs)
        self._auto_push_if_enabled()
        return result

    def generate_code(self, *args, **kwargs):
        """Generate code."""
        result = m.fn('claude/generate_code')(*args, **kwargs)
        self._auto_push_if_enabled()
        return result

    def refactor(self, *args, **kwargs):
        """Refactor code."""
        result = m.fn('claude/refactor')(*args, **kwargs)
        self._auto_push_if_enabled()
        return result

    def debug(self, *args, **kwargs):
        """Debug code."""
        result = m.fn('claude/debug')(*args, **kwargs)
        self._auto_push_if_enabled()
        return result

    def edit_file(self, *args, **kwargs):
        """Edit a file."""
        result = m.fn('claude/edit_file')(*args, **kwargs)
        self._auto_push_if_enabled()
        return result

    def run_task(self, *args, **kwargs):
        """Run a task."""
        result = m.fn('claude/run_task')(*args, **kwargs)
        self._auto_push_if_enabled()
        return result


# Expose the main class
__all__ = ['Mod']
