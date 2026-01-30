import pytest
import os
import sys
import tempfile
import shutil

# Add parent directory to path to import the module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pyenv.mod import Mod


class TestPyenv:
    """Test suite for pyenv module"""
    
    @pytest.fixture
    def temp_pyenv(self):
        """Create a temporary pyenv instance for testing"""
        temp_dir = tempfile.mkdtemp()
        pyenv = Mod(path=temp_dir)
        yield pyenv
        # Cleanup
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
    
    def test_import(self):
        """Test that the module can be imported"""
        assert Mod is not None
    
    def test_initialization(self, temp_pyenv):
        """Test that pyenv initializes correctly"""
        assert os.path.exists(temp_pyenv.path)
        assert os.path.exists(temp_pyenv.config_file)
    
    def test_create_environment(self, temp_pyenv):
        """Test creating a new virtual environment"""
        result = temp_pyenv.create('test_env')
        assert result['success'] == True
        assert 'test_env' in result['message']
    
    def test_list_environments(self, temp_pyenv):
        """Test listing environments"""
        result = temp_pyenv.list_envs()
        assert result['success'] == True
        assert 'environments' in result
        assert 'default' in result['environments']
    
    def test_environment_exists(self, temp_pyenv):
        """Test checking if environment exists"""
        temp_pyenv.create('test_env')
        assert temp_pyenv.exists('test_env') == True
        assert temp_pyenv.exists('nonexistent') == False
    
    def test_remove_environment(self, temp_pyenv):
        """Test removing an environment"""
        temp_pyenv.create('test_env')
        result = temp_pyenv.rm_env('test_env', delete_files=True)
        assert result['success'] == True
        assert temp_pyenv.exists('test_env') == False
    
    def test_cannot_remove_default(self, temp_pyenv):
        """Test that default environment cannot be removed"""
        result = temp_pyenv.rm_env('default')
        assert result['success'] == False
        assert 'Cannot remove default' in result['message']
    
    def test_python_bin_path(self, temp_pyenv):
        """Test getting python binary path"""
        temp_pyenv.create('test_env')
        python_bin = temp_pyenv.python_bin('test_env')
        assert 'python' in python_bin.lower()
    
    def test_delete_environment(self, temp_pyenv):
        """Test deleting an environment"""
        temp_pyenv.create('test_env')
        result = temp_pyenv.delete('test_env')
        assert result['success'] == True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
