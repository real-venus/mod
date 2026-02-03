import subprocess
import os
import sys
from typing import Optional, List, Dict, Any
import json

class Mod:
    description = """
    Conda - Python Package & Environment Manager
    Manage multiple conda environments with a centralized manager
    """

    def __init__(self, path: Optional[str] = '~/.mod/conda'):
        """
        Initialize Conda manager
        
        Args:
            path: Base path for mod storage. Defaults to ~/.mod/conda
        """
        self.path = os.path.abspath(os.path.expanduser(path))
        self.config_file = os.path.join(self.path, 'conda_config.json')
        self.default_env = os.path.join(self.path, 'conda', 'mod')
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

    def env_path(self, name: str) -> str:
        return self.path+'/envs/'+ name

    def create(self, name: str, python_version: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new virtual environment and add it to the manager
        
        Args:
            name: Name for the environment
            python_version: Specific Python version to use (e.g., 'python3.9')
            
        Returns:
            Dictionary with success status and message
        """
        config = self._load_config()
        
        # Add environment to config if not exists
        if name not in config['environments']:
            config['environments'][name] = self.env_path(name)
            self._save_config(config)
        
        env_path = config['environments'][name]
        
        try:
            python_cmd = python_version if python_version else sys.executable
            subprocess.run([python_cmd, '-m', 'venv', env_path], check=True)
            return {'success': True, 'message': f'Environment "{name}" created at {env_path}'}
        except subprocess.CalledProcessError as e:
            return {'success': False, 'message': f'Failed to create environment: {str(e)}'}

    def add(self, name: str, python_version: Optional[str] = None) -> Dict[str, Any]:
        """
        Add and create a new environment (same as create)
        
        Args:
            name: Name identifier for the environment
            python_version: Specific Python version to use (e.g., 'python3.9')
            
        Returns:
            Dictionary with success status and message
        """
        return self.create(name, python_version)

    def cp(self, source_name: str, target_name: str) -> Dict[str, Any]:
        """
        Copy an existing environment to a new environment
        
        Args:
            source_name: Name of the source environment
            target_name: Name for the new copied environment
            
        Returns:
            Dictionary with success status and message
        """
        config = self._load_config()
        
        if source_name not in config['environments']:
            return {'success': False, 'message': f'Source environment "{source_name}" not found'}
        
        source_path = config['environments'][source_name]
        target_path = self.env_path(target_name)
        
        try:
            import shutil
            shutil.copytree(source_path, target_path)
            config['environments'][target_name] = target_path
            self._save_config(config)
            return {'success': True, 'message': f'Environment "{source_name}" copied to "{target_name}"'}
        except Exception as e:
            return {'success': False, 'message': f'Failed to copy environment: {str(e)}'}

    def stats(self, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get information about a specific environment
        
        Args:
            name: Name of the environment. If None, uses active environment
            
        Returns:
            Dictionary with environment details
        """
        config = self._load_config()
        env_name = name or config['active']
        
        if env_name not in config['environments']:
            return {'success': False, 'message': f'Environment "{env_name}" not found'}
        
        env_path = config['environments'][env_name]
        exists = self.exists(env_name)
        
        return {
            'success': True,
            'name': env_name,
            'path': env_path,
            'exists': exists,
            'python_bin': self._get_python_bin(env_path) if exists else None,
            'version': sys.version if exists else None
        }

    def rm(self, name: str, delete_files: bool = False) -> Dict[str, Any]:
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

    def ls(self) -> Dict[str, Any]:
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

    def python_bin(self, name: Optional[str] = None) -> str:
        """Get the path to the Python binary in the virtual environment"""
        config = self._load_config()
        env_name = name or config['active']
        if env_name not in config['environments']:
            raise ValueError(f'Environment "{env_name}" not found')
        env_path = config['environments'][env_name]
        return self._get_python_bin(env_path)

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

    def packages(self, name: Optional[str] = None) -> Dict[str, Any]:
        """List installed packages in the virtual environment"""
        config = self._load_config()
        env_name = name or config['active']
        
        if env_name not in config['environments']:
            return {'success': False, 'message': f'Environment "{env_name}" not found'}
        
        env_path = config['environments'][env_name]
        
        if not self.exists(env_name):
            return {'success': False, 'message': 'Environment does not exist'}

        pip_bin = self._get_pip_bin(env_path)
        outputs =  self.run([pip_bin, 'list'], name)
        packages = []
        if outputs['success']:
            lines = outputs['stdout'].splitlines()[2:]  # Skip header lines
            for line in lines:
                if line.strip():
                    pkg_info = line.split()
                    packages.append({'name': pkg_info[0], 'version': pkg_info[1]})
            return packages
        else:
            return {'success': False, 'message': outputs.get('message', 'Failed to list packages')}

    def install(self, packages: List[str], name: Optional[str] = None) -> list:
        """Install packages using pip in the virtual environment"""
        if isinstance(packages, str):
            packages = [packages]
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
