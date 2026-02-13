import mod as m
import os
import subprocess
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
import json

class Codex:
    """
    Codex Module - A Python wrapper for Anthropic's Claude Code CLI

    This module provides a clean interface to the @openai/codex npm package
    (Anthropic's Claude Code CLI tool), allowing you to use Claude Code
    directly from Python.

    Installation:
        npm install -g @openai/codex
        # or
        c.module('codex').install()

    Features:
        - Interactive and non-interactive modes
        - Code review capabilities
        - Sandbox execution modes
        - Image attachments
        - Resume and fork sessions
        - Configuration management
    """

    description = "Anthropic Claude Code CLI wrapper for autonomous AI coding"

    defaults = {
        'model': 'claude-sonnet-4-5',
        'sandbox': 'workspace-write',  # read-only, workspace-write, danger-full-access
        'json_output': False,
        'debug': False,
        'timeout': 600,  # 10 minutes default timeout
        'full_auto': False,
    }

    # Valid sandbox modes from CLI
    VALID_SANDBOX_MODES = {'read-only', 'workspace-write', 'danger-full-access'}

    # Valid approval modes
    VALID_APPROVAL_MODES = {'suggest', 'auto-edit', 'full-auto'}

    # Anthropic model options (as of codex-cli 0.98.0)
    VALID_MODELS = {
        'claude-sonnet-4-5',
        'claude-opus-4',
        'claude-haiku-4-5',
        'claude-sonnet-3-5',
        'claude-opus-3',
    }
    
    def __init__(self,
                 api_key: Optional[str] = None,
                 model: str = 'claude-sonnet-4-5',
                 sandbox: str = 'workspace-write',
                 approval_mode: str = 'suggest',
                 debug: bool = False,
                 full_auto: bool = False,
                 **kwargs):
        """
        Initialize Codex module.

        Args:
            api_key: Anthropic API key (or set ANTHROPIC_API_KEY env var)
            model: Model to use (claude-sonnet-4-5, claude-opus-4, etc.)
            sandbox: Sandbox mode - read-only | workspace-write | danger-full-access
            approval_mode: suggest | auto-edit | full-auto
            debug: Enable debug logging
            full_auto: Enable full automation with workspace-write sandbox

        Raises:
            ValueError: If invalid model or sandbox mode provided
        """
        # Initialize parent Mod class first
        super().__init__(**kwargs)

        # Setup logging first
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        self.debug = debug
        if debug:
            self.logger.setLevel(logging.DEBUG)
        else:
            self.logger.setLevel(logging.INFO)

        # Validate inputs
        if model and model not in self.VALID_MODELS:
            self.logger.warning(f"Model '{model}' not in known models. Using anyway. Known: {', '.join(self.VALID_MODELS)}")
        if sandbox not in self.VALID_SANDBOX_MODES:
            raise ValueError(f"Invalid sandbox '{sandbox}'. Must be one of: {', '.join(self.VALID_SANDBOX_MODES)}")
        if approval_mode not in self.VALID_APPROVAL_MODES:
            raise ValueError(f"Invalid approval_mode '{approval_mode}'. Must be one of: {', '.join(self.VALID_APPROVAL_MODES)}")

        self.model = model
        self.sandbox = sandbox
        self.approval_mode = approval_mode
        self.full_auto = full_auto
        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')

        if not self.api_key:
            self.logger.warning("No API key provided. Codex will use config.toml auth or prompt for login.")
        
    @classmethod
    def install(cls, global_install: bool = True) -> Dict[str, Any]:
        """
        Install the @openai/codex npm package.
        
        Args:
            global_install: Install globally (-g flag)
            
        Returns:
            Installation result dictionary
        """
        # Check if npm is available
        if not shutil.which('npm'):
            return {
                'success': False,
                'error': 'npm not found. Please install Node.js first.',
                'install_node': 'https://nodejs.org/'
            }
        
        # Check if already installed
        if cls.is_installed():
            return {
                'success': True,
                'message': '@openai/codex is already installed',
                'version': cls.version()
            }
        
        # Install codex
        cmd = 'npm install -g @openai/codex' if global_install else 'npm install @openai/codex'
        
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                return {
                    'success': True,
                    'message': '@openai/codex installed successfully',
                    'output': result.stdout
                }
            else:
                return {
                    'success': False,
                    'error': result.stderr,
                    'output': result.stdout
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    @classmethod
    def uninstall(cls, global_uninstall: bool = True) -> Dict[str, Any]:
        """Uninstall @openai/codex npm package."""
        cmd = 'npm uninstall -g @openai/codex' if global_uninstall else 'npm uninstall @openai/codex'
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr if result.returncode != 0 else None
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @classmethod
    def is_installed(cls) -> bool:
        """Check if codex CLI is installed."""
        return shutil.which('codex') is not None
    
    @classmethod
    def version(cls) -> Optional[str]:
        """Get installed codex version."""
        try:
            result = subprocess.run(
                'codex --version',
                shell=True,
                capture_output=True,
                text=True
            )
            return result.stdout.strip() if result.returncode == 0 else None
        except:
            return None
    
    def forward(self, 
                prompt: str,
                model: Optional[str] = None,
                approval_mode: Optional[str] = None,
                quiet: bool = False,
                json_output: bool = False,
                working_dir: Optional[str] = None,
                **kwargs) -> Dict[str, Any]:
        """
        Run codex with a prompt (main entry point).
        
        Args:
            prompt: The instruction/prompt for codex
            model: Model override (o4-mini, o3, gpt-4.1, etc.)
            approval_mode: suggest | auto-edit | full-auto
            quiet: Non-interactive quiet mode
            json_output: Output in JSON format
            working_dir: Working directory for codex
            
        Returns:
            Result dictionary with output
        """
        return self.run(
            prompt=prompt,
            model=model,
            approval_mode=approval_mode,
            quiet=quiet,
            json_output=json_output,
            working_dir=working_dir,
            **kwargs
        )
    
    def run(self,
            prompt: str,
            model: Optional[str] = None,
            approval_mode: Optional[str] = None,
            quiet: bool = False,
            json_output: bool = False,
            working_dir: Optional[str] = None,
            timeout: Optional[int] = None,
            env_vars: Optional[Dict[str, str]] = None,
            **kwargs) -> Dict[str, Any]:
        """
        Execute codex CLI with given parameters.

        Args:
            prompt: The instruction/prompt for codex
            model: Model to use (default: o4-mini)
            approval_mode: suggest | auto-edit | full-auto
            quiet: Non-interactive quiet mode (-q)
            json_output: Output JSON format
            working_dir: Working directory
            timeout: Command timeout in seconds (default: 300)
            env_vars: Additional environment variables

        Returns:
            Execution result dictionary with keys:
                - success (bool): Whether command succeeded
                - output (str): Command stdout
                - error (str): Error message if failed
                - return_code (int): Process return code
                - command (str): Executed command

        Raises:
            ValueError: If invalid model or approval_mode provided
        """
        # Validate inputs
        _model = model or self.model
        _approval = approval_mode or self.approval_mode

        if _model and _model not in self.VALID_MODELS:
            raise ValueError(f"Invalid model '{_model}'. Must be one of: {', '.join(self.VALID_MODELS)}")
        if _approval and _approval not in self.VALID_APPROVAL_MODES:
            raise ValueError(f"Invalid approval_mode '{_approval}'. Must be one of: {', '.join(self.VALID_APPROVAL_MODES)}")

        if not prompt or not prompt.strip():
            return {
                'success': False,
                'error': 'Prompt cannot be empty',
                'return_code': -1
            }

        if not self.is_installed():
            self.logger.info("Codex not installed, attempting auto-install...")
            install_result = self.install()
            if not install_result.get('success'):
                return install_result

        # Build command using list (safer than shell=True)
        cmd_parts = ['codex']

        # Model selection
        if _model:
            cmd_parts.extend(['--model', _model])

        # Approval mode
        if _approval:
            cmd_parts.extend(['--approval-mode', _approval])

        # Quiet mode
        if quiet:
            cmd_parts.append('-q')

        # JSON output
        if json_output:
            cmd_parts.append('--json')

        # Add the prompt (no shell injection risk with list-based args)
        cmd_parts.append(prompt)

        # Setup environment
        env = os.environ.copy()
        if self.api_key:
            env['ANTHROPIC_API_KEY'] = self.api_key
        elif not env.get('ANTHROPIC_API_KEY'):
            return {
                'success': False,
                'error': 'No API key provided. Set ANTHROPIC_API_KEY environment variable or pass api_key parameter.',
                'return_code': -1
            }
        if env_vars:
            env.update(env_vars)

        # Validate working directory
        if working_dir:
            work_path = Path(working_dir)
            if not work_path.exists():
                return {
                    'success': False,
                    'error': f'Working directory does not exist: {working_dir}',
                    'return_code': -1
                }
            if not work_path.is_dir():
                return {
                    'success': False,
                    'error': f'Working directory path is not a directory: {working_dir}',
                    'return_code': -1
                }

        # Set default timeout
        _timeout = timeout or self.defaults.get('timeout', 300)

        cmd_str = ' '.join(cmd_parts)
        self.logger.debug(f"Executing command: {cmd_str}")

        # Execute (using list-based args for security)
        try:
            result = subprocess.run(
                cmd_parts,  # Use list instead of shell=True for security
                capture_output=True,
                text=True,
                cwd=working_dir,
                env=env,
                timeout=_timeout
            )

            response = {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr if result.returncode != 0 else None,
                'return_code': result.returncode,
                'command': cmd_str
            }

            # Parse JSON output if requested
            if json_output and result.returncode == 0:
                try:
                    response['parsed'] = json.loads(result.stdout)
                except json.JSONDecodeError as e:
                    self.logger.warning(f"Failed to parse JSON output: {e}")
                    response['json_parse_error'] = str(e)

            if self.debug:
                self.logger.debug(f"Command result: {response}")

            return response

        except subprocess.TimeoutExpired:
            error_msg = f'Command timed out after {_timeout} seconds'
            self.logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'command': cmd_str,
                'return_code': -1
            }
        except FileNotFoundError:
            error_msg = 'codex command not found. Is it installed?'
            self.logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'command': cmd_str,
                'return_code': -1
            }
        except Exception as e:
            error_msg = f'Unexpected error: {str(e)}'
            self.logger.error(error_msg, exc_info=True)
            return {
                'success': False,
                'error': error_msg,
                'command': cmd_str,
                'return_code': -1
            }
    
    def suggest(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Run codex in suggest mode (default, requires approval)."""
        return self.run(prompt, approval_mode='suggest', **kwargs)
    
    def auto_edit(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Run codex in auto-edit mode (auto-applies file edits)."""
        return self.run(prompt, approval_mode='auto-edit', **kwargs)
    
    def full_auto(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Run codex in full-auto mode (no human approval needed)."""
        return self.run(prompt, approval_mode='full-auto', **kwargs)
    
    def quiet_run(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Run codex in quiet non-interactive mode."""
        return self.run(prompt, quiet=True, **kwargs)
    
    def interactive(self, working_dir: Optional[str] = None) -> int:
        """
        Launch interactive codex session.

        Args:
            working_dir: Working directory for the session

        Returns:
            Exit code from the interactive session
        """
        if not self.is_installed():
            print("Installing codex...")
            install_result = self.install()
            if not install_result.get('success'):
                print(f"Installation failed: {install_result.get('error')}")
                return -1

        cmd_parts = ['codex']
        if self.model:
            cmd_parts.extend(['--model', self.model])

        env = os.environ.copy()
        if self.api_key:
            env['ANTHROPIC_API_KEY'] = self.api_key
        elif not env.get('ANTHROPIC_API_KEY'):
            print("Error: No API key provided. Set ANTHROPIC_API_KEY environment variable.")
            return -1

        # Run interactively (needs to be shell=False with list for proper tty handling)
        try:
            result = subprocess.run(cmd_parts, cwd=working_dir, env=env)
            return result.returncode
        except KeyboardInterrupt:
            print("\nInteractive session interrupted.")
            return 0
        except Exception as e:
            print(f"Error launching interactive session: {e}")
            return -1
    
    def config_set(self, key: str, value: str) -> Dict[str, Any]:
        """
        Set a codex configuration value.

        Args:
            key: Config key (e.g., 'model', 'approval-mode')
            value: Config value

        Returns:
            Result dictionary with success status
        """
        if not self.is_installed():
            return {
                'success': False,
                'error': 'Codex is not installed. Run install() first.'
            }

        cmd_parts = ['codex', 'config', 'set', key, value]
        try:
            result = subprocess.run(cmd_parts, capture_output=True, text=True)
            return {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr if result.returncode != 0 else None
            }
        except Exception as e:
            self.logger.error(f"Config set failed: {e}")
            return {'success': False, 'error': str(e)}

    def config_get(self, key: str) -> Optional[str]:
        """
        Get a codex configuration value.

        Args:
            key: Config key to retrieve

        Returns:
            Config value or None if not found
        """
        if not self.is_installed():
            self.logger.warning('Codex is not installed.')
            return None

        cmd_parts = ['codex', 'config', 'get', key]
        try:
            result = subprocess.run(cmd_parts, capture_output=True, text=True)
            return result.stdout.strip() if result.returncode == 0 else None
        except Exception as e:
            self.logger.error(f"Config get failed: {e}")
            return None

    def config_list(self) -> Dict[str, Any]:
        """
        List all codex configuration values.

        Returns:
            Dictionary with all config values or error info
        """
        if not self.is_installed():
            return {
                'success': False,
                'error': 'Codex is not installed. Run install() first.'
            }

        cmd_parts = ['codex', 'config', 'list']
        try:
            result = subprocess.run(cmd_parts, capture_output=True, text=True)
            return {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr if result.returncode != 0 else None
            }
        except Exception as e:
            self.logger.error(f"Config list failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def set_api_key(self, api_key: str) -> None:
        """Set the Anthropic API key."""
        self.api_key = api_key
        os.environ['ANTHROPIC_API_KEY'] = api_key
    
    @classmethod
    def help(cls) -> str:
        """
        Get codex CLI help text.

        Returns:
            Help text or installation message
        """
        if not cls.is_installed():
            return "Codex not installed. Run: c.module('codex').install()"

        try:
            result = subprocess.run(['codex', '--help'], capture_output=True, text=True)
            return result.stdout if result.returncode == 0 else result.stderr
        except Exception as e:
            return f"Error getting help: {e}"
    
    @classmethod
    def models(cls) -> List[str]:
        """List available models."""
        return list(cls.VALID_MODELS)
    
    @classmethod  
    def approval_modes(cls) -> Dict[str, str]:
        """List available approval modes with descriptions."""
        return {
            'suggest': 'Suggest changes, require approval for all actions',
            'auto-edit': 'Auto-apply file edits, require approval for commands',
            'full-auto': 'No approval needed, fully autonomous'
        }
    
    def __repr__(self) -> str:
        return f"Codex(model={self.model}, approval_mode={self.approval_mode}, installed={self.is_installed()})"
    
    # Aliases for convenience
    __call__ = forward
    execute = run
    ask = forward
    code = forward
