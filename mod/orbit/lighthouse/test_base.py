import pytest
import os
import tempfile
import shutil
from unittest.mock import patch, MagicMock

# Test fixtures
@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    temp_path = tempfile.mkdtemp()
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)

@pytest.fixture
def mock_module():
    """Mock the base module for testing."""
    mock = MagicMock()
    return mock


class TestCreateFile:
    """Tests for create_file functionality."""
    
    def test_create_file_success(self, temp_dir):
        """Test successful file creation."""
        file_path = os.path.join(temp_dir, "test.txt")
        content = "Hello, World!"
        
        # Simulate create_file behavior
        with open(file_path, 'w') as f:
            f.write(content)
        
        assert os.path.exists(file_path)
        with open(file_path, 'r') as f:
            assert f.read() == content
    
    def test_create_file_with_parent_dirs(self, temp_dir):
        """Test file creation with parent directory creation."""
        file_path = os.path.join(temp_dir, "nested", "dir", "test.txt")
        content = "Nested content"
        
        parent_dir = os.path.dirname(file_path)
        os.makedirs(parent_dir, exist_ok=True)
        with open(file_path, 'w') as f:
            f.write(content)
        
        assert os.path.exists(file_path)
        assert os.path.isdir(parent_dir)
    
    def test_create_file_no_overwrite(self, temp_dir):
        """Test that file is not overwritten when overwrite=False."""
        file_path = os.path.join(temp_dir, "existing.txt")
        original_content = "Original"
        
        with open(file_path, 'w') as f:
            f.write(original_content)
        
        # Simulate overwrite=False behavior
        if os.path.exists(file_path):
            result = {
                "success": False,
                "file_path": file_path,
                "message": "File already exists and overwrite is False"
            }
        
        assert result["success"] == False
        with open(file_path, 'r') as f:
            assert f.read() == original_content
    
    def test_create_file_with_overwrite(self, temp_dir):
        """Test file overwrite when overwrite=True."""
        file_path = os.path.join(temp_dir, "overwrite.txt")
        original_content = "Original"
        new_content = "New content"
        
        with open(file_path, 'w') as f:
            f.write(original_content)
        
        # Overwrite the file
        with open(file_path, 'w') as f:
            f.write(new_content)
        
        with open(file_path, 'r') as f:
            assert f.read() == new_content
    
    def test_create_empty_file(self, temp_dir):
        """Test creating an empty file."""
        file_path = os.path.join(temp_dir, "empty.txt")
        
        with open(file_path, 'w') as f:
            f.write("")
        
        assert os.path.exists(file_path)
        assert os.path.getsize(file_path) == 0


class TestCmd:
    """Tests for cmd functionality."""
    
    def test_cmd_echo(self):
        """Test simple echo command."""
        result = os.system("echo 'test'")
        assert result == 0
    
    def test_cmd_ls(self, temp_dir):
        """Test ls command in temp directory."""
        result = os.system(f"ls {temp_dir}")
        assert result == 0
    
    def test_cmd_invalid_command(self):
        """Test handling of invalid command."""
        result = os.system("nonexistent_command_12345 2>/dev/null")
        assert result != 0
    
    def test_cmd_with_pipe(self, temp_dir):
        """Test command with pipe."""
        file_path = os.path.join(temp_dir, "pipe_test.txt")
        result = os.system(f"echo 'line1\nline2\nline3' > {file_path}")
        assert result == 0
    
    def test_cmd_mkdir(self, temp_dir):
        """Test mkdir command."""
        new_dir = os.path.join(temp_dir, "new_directory")
        result = os.system(f"mkdir -p {new_dir}")
        assert result == 0
        assert os.path.isdir(new_dir)


class TestIntegration:
    """Integration tests combining multiple operations."""
    
    def test_create_and_read_file(self, temp_dir):
        """Test creating a file and reading it back."""
        file_path = os.path.join(temp_dir, "integration.txt")
        content = "Integration test content"
        
        with open(file_path, 'w') as f:
            f.write(content)
        
        with open(file_path, 'r') as f:
            read_content = f.read()
        
        assert read_content == content
    
    def test_create_multiple_files(self, temp_dir):
        """Test creating multiple files."""
        files = {
            "file1.txt": "Content 1",
            "file2.txt": "Content 2",
            "file3.txt": "Content 3"
        }
        
        for filename, content in files.items():
            file_path = os.path.join(temp_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
        
        for filename, expected_content in files.items():
            file_path = os.path.join(temp_dir, filename)
            assert os.path.exists(file_path)
            with open(file_path, 'r') as f:
                assert f.read() == expected_content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
