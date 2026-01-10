import subprocess
import os
import sys
from typing import Optional, List, Dict, Any
import json

class Mod:
    description = """
    PyEnv - Python Environment Manager
    Manage multiple Python virtual environments with a centralized manager
    """

    def __init__(self, path: Optional[str] = None):
        """
        Initialize PyEnv manager
        
        Args:
            path: Base path for mod storage. Defaults to ~/.mod
        """
        self.path = path if path else os.path.join(os.path.expanduser('~'), '.mod')
        self.config_file = os.path.join(self.path, 'pyenv_config.json')
        self.default_env = os.path.join(self.path, 'pyenv', 'mod')
        self._ensure_config()

    def _ensure_config(self):
        """Ensure config file and default environment exist"""
        os.makedirs(self.path, exist_ok=True)
        if not os.path.exists(self.config_file):
            config = {
                'environments': {
                    'default': self.default_env
                },
                'active': 'default'
            }
            with open(self.config_file, 'w') as f:
                f.write(json.dumps(config, indent=2))

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        with open(self.config_file, 'r') as f:
            return json.loads(f.read())

    def _save_config(self, config: Dict[str, Any]):
        """Save configuration to file"""
        with open(self.config_file, 'w') as f:
            f.write(json.dumps(config, indent=2))

    def add_env(self, name: str, env_path: str) -> Dict[str, Any]:
        """
        Add a new environment to the manager
        
        Args:
            name: Name identifier for the environment
            env_path: Path to the virtual environment
            
        Returns:
            Dictionary with success status and message
        """
        config = self._load_config()
        if name in config['environments']:
            return {'success': False, 'message': f'Environment "{name}" already exists'}
        
        config['environments'][name] = os.path.abspath(env_path)
        self._save_config(config)
        return {'success': True, 'message': f'Environment "{name}" added at {env_path}'}

    def remove_env(self, name: str, delete_files: bool = False) -> Dict[str, Any]:
        """
        Remove an environment from the manager
        
        Args:
            name: Name of the environment to remove
            delete_files: Whether to delete the actual environment files
            
        Returns:
            Dictionary with success status and message
        """
        config = self._load_config()
        if name not in config['environments']:
            return {'success': False, 'message': f'Environment "{name}" not found'}
        
        if name == 'default':
            return {'success': False, 'message': 'Cannot remove default environment'}
        
        env_path = config['environments'][name]
        del config['environments'][name]
        
        if config['active'] == name:
            config['active'] = 'default'
        
        self._save_config(config)
        
        if delete_files and os.path.exists(env_path):
            import shutil
            shutil.rmtree(env_path)
            return {'success': True, 'message': f'Environment "{name}" removed and deleted from {env_path}'}
        
        return {'success': True, 'message': f'Environment "{name}" removed from manager'}

    def list_envs(self) -> Dict[str, Any]:
        """
        List all managed environments
        
        Returns:
            Dictionary with environments and active environment
        """
        config = self._load_config()
        return {
            'success': True,
            'environments': config['environments'],
            'active': config['active']
        }

    def set_active(self, name: str) -> Dict[str, Any]:
        """
        Set the active environment
        
        Args:
            name: Name of the environment to activate
            
        Returns:
            Dictionary with success status and message
        """
        config = self._load_config()
        if name not in config['environments']:
            return {'success': False, 'message': f'Environment "{name}" not found'}
        
        config['active'] = name
        self._save_config(config)
        return {'success': True, 'message': f'Active environment set to "{name}"'}

    def get_active_env(self) -> str:
        """Get the path to the active environment"""
        config = self._load_config()
        active_name = config['active']
        return config['environments'][active_name]

    def _get_python_bin(self, env_path: str) -> str:
        """Get the path to the Python binary in the virtual environment"""
        if sys.platform == 'win32':
            return os.path.join(env_path, 'Scripts', 'python.exe')
        return os.path.join(env_path, 'bin', 'python')

    def _get_pip_bin(self, env_path: str) -> str:
        """Get the path to the pip binary in the virtual environment"""
        if sys.platform == 'win32':
            return os.path.join(env_path, 'Scripts', 'pip.exe')
        return os.path.join(env_path, 'bin', 'pip')

    def create(self, name: Optional[str] = None, python_version: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new virtual environment
        
        Args:
            name: Name for the environment (uses active if None)
            python_version: Specific Python version to use (e.g., 'python3.9')
            
        Returns:
            Dictionary with success status and message
        """
        config = self._load_config()
        env_name = name or config['active']
        
        if env_name not in config['environments']:
            return {'success': False, 'message': f'Environment "{env_name}" not in manager. Add it first.'}
        
        env_path = config['environments'][env_name]
        
        try:
            python_cmd = python_version if python_version else sys.executable
            subprocess.run([python_cmd, '-m', 'venv', env_path], check=True)
            return {'success': True, 'message': f'Environment "{env_name}" created at {env_path}'}
        except subprocess.CalledProcessError as e:
            return {'success': False, 'message': f'Failed to create environment: {str(e)}'}

    def exists(self, name: Optional[str] = None) -> bool:
        """Check if the virtual environment exists"""
        config = self._load_config()
        env_name = name or config['active']
        if env_name not in config['environments']:
            return False
        env_path = config['environments'][env_name]
        python_bin = self._get_python_bin(env_path)
        return os.path.exists(env_path) and os.path.exists(python_bin)

    def delete(self, name: Optional[str] = None) -> Dict[str, Any]:
        """Delete the virtual environment"""
        config = self._load_config()
        env_name = name or config['active']
        
        if env_name not in config['environments']:
            return {'success': False, 'message': f'Environment "{env_name}" not found'}
        
        env_path = config['environments'][env_name]
        
        try:
            if os.path.exists(env_path):
                import shutil
                shutil.rmtree(env_path)
                return {'success': True, 'message': f'Environment "{env_name}" deleted: {env_path}'}
            return {'success': False, 'message': 'Environment does not exist'}
        except Exception as e:
            return {'success': False, 'message': f'Failed to delete environment: {str(e)}'}

    def run(self, command: List[str], name: Optional[str] = None, capture_output: bool = True) -> Dict[str, Any]:
        """Run a command in the virtual environment"""
        config = self._load_config()
        env_name = name or config['active']
        
        if env_name not in config['environments']:
            return {'success': False, 'message': f'Environment "{env_name}" not found', 'returncode': -1}
        
        env_path = config['environments'][env_name]
        
        if not self.exists(env_name):
            return {'success': False, 'message': 'Environment does not exist', 'returncode': -1}

        try:
            result = subprocess.run(
                command,
                capture_output=capture_output,
                text=True,
                cwd=os.path.dirname(env_path),
                env=self._get_env_vars(env_path)
            )
            return {
                'success': result.returncode == 0,
                'returncode': result.returncode,
                'stdout': result.stdout if capture_output else '',
                'stderr': result.stderr if capture_output else ''
            }
        except Exception as e:
            return {'success': False, 'message': str(e), 'returncode': -1}

    def install(self, packages: List[str], name: Optional[str] = None) -> Dict[str, Any]:
        """Install packages using pip in the virtual environment"""
        config = self._load_config()
        env_name = name or config['active']
        
        if env_name not in config['environments']:
            return {'success': False, 'message': f'Environment "{env_name}" not found'}
        
        env_path = config['environments'][env_name]
        
        if not self.exists(env_name):
            return {'success': False, 'message': 'Environment does not exist'}

        pip_bin = self._get_pip_bin(env_path)
        return self.run([pip_bin, 'install'] + packages, name)

    def _get_env_vars(self, env_path: str) -> Dict[str, str]:
        """Get environment variables with virtual environment activated"""
        env = os.environ.copy()
        
        if sys.platform == 'win32':
            bin_dir = os.path.join(env_path, 'Scripts')
        else:
            bin_dir = os.path.join(env_path, 'bin')
        
        env['PATH'] = f"{bin_dir}{os.pathsep}{env.get('PATH', '')}"
        env['VIRTUAL_ENV'] = env_path
        env.pop('PYTHONHOME', None)
        
        return env
