"""
File Edit Tool

Edit files by replacing old text with new text.
"""

import os
from typing import Dict, Any, Optional
from pathlib import Path


class Tool:
    """Edit files by replacing text"""

    description = """
    Edit files by replacing old text with new text.
    Supports:
    - Exact string replacement
    - Replace all occurrences
    - Backup before editing
    - Multi-line replacements
    """

    def __init__(self, encoding: str = 'utf-8', backup: bool = True, **kwargs):
        """
        Initialize edit tool.

        Args:
            encoding: Default file encoding (default: 'utf-8')
            backup: Create backup before editing (default: True)
        """
        self.encoding = encoding
        self.backup = backup

    def forward(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
        encoding: Optional[str] = None,
        backup: Optional[bool] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Edit a file by replacing old text with new text.

        Args:
            file_path: Path to file to edit
            old_string: Text to replace
            new_string: Text to replace with
            replace_all: Replace all occurrences (default: False, only first)
            encoding: File encoding (default: utf-8)
            backup: Create backup before editing
            **kwargs: Additional arguments

        Returns:
            Dictionary with edit results:
            {
                "success": bool,
                "message": str,
                "file_path": str,
                "replacements": int,
                "backup_path": str (if backup created)
            }
        """
        try:
            # Resolve path
            path = Path(file_path).expanduser().resolve()

            if not path.exists():
                return {
                    "success": False,
                    "message": f"File not found: {file_path}",
                    "file_path": str(path),
                    "replacements": 0
                }

            if not path.is_file():
                return {
                    "success": False,
                    "message": f"Path is not a file: {file_path}",
                    "file_path": str(path),
                    "replacements": 0
                }

            file_encoding = encoding or self.encoding
            do_backup = backup if backup is not None else self.backup

            # Read file
            with open(path, 'r', encoding=file_encoding) as f:
                content = f.read()

            # Check if old_string exists
            if old_string not in content:
                return {
                    "success": False,
                    "message": f"String not found in file: '{old_string[:50]}...'",
                    "file_path": str(path),
                    "replacements": 0
                }

            # Create backup if requested
            backup_path = None
            if do_backup:
                backup_path = path.with_suffix(path.suffix + '.bak')
                import shutil
                shutil.copy2(path, backup_path)

            # Perform replacement
            if replace_all:
                new_content = content.replace(old_string, new_string)
                replacements = content.count(old_string)
            else:
                new_content = content.replace(old_string, new_string, 1)
                replacements = 1

            # Write updated content
            with open(path, 'w', encoding=file_encoding) as f:
                f.write(new_content)

            result = {
                "success": True,
                "message": f"Made {replacements} replacement(s) in {path.name}",
                "file_path": str(path),
                "replacements": replacements,
                "encoding": file_encoding
            }

            if backup_path:
                result["backup_path"] = str(backup_path)

            return result

        except PermissionError:
            return {
                "success": False,
                "message": f"Permission denied: {file_path}",
                "file_path": file_path,
                "replacements": 0
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error editing file: {str(e)}",
                "file_path": file_path,
                "replacements": 0
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the edit tool"""
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = os.path.join(tmpdir, 'test.txt')

            # Create test file
            with open(test_file, 'w') as f:
                f.write("Hello World\nHello Universe\nGoodbye World\n")

            # Test single replacement
            result1 = self.forward(test_file, "Hello World", "Hi Earth")
            assert result1["success"], "Should edit successfully"
            assert result1["replacements"] == 1, "Should make 1 replacement"

            # Verify content
            with open(test_file, 'r') as f:
                content = f.read()
            assert "Hi Earth" in content, "Should contain new text"
            assert content.count("Hello") == 1, "Should only replace first occurrence"

            # Test replace all
            result2 = self.forward(test_file, "World", "Planet", replace_all=True)
            assert result2["success"], "Should replace all"

            return {
                "success": True,
                "message": "Edit tool tests passed",
                "test_results": [result1, result2]
            }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
