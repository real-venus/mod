"""
File Write Tool

Writes content to files with support for creating new files and overwriting.
"""

import os
from typing import Dict, Any, Optional
from pathlib import Path


class Tool:
    """Write content to files"""

    description = """
    Write content to files with support for:
    - Creating new files
    - Overwriting existing files
    - Creating parent directories
    - Backup before overwrite
    """

    def __init__(self, encoding: str = 'utf-8', backup: bool = False, **kwargs):
        """
        Initialize write tool.

        Args:
            encoding: Default file encoding (default: 'utf-8')
            backup: Create backup before overwriting (default: False)
        """
        self.encoding = encoding
        self.backup = backup

    def forward(
        self,
        file_path: str,
        content: str,
        encoding: Optional[str] = None,
        create_dirs: bool = True,
        backup: Optional[bool] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Write content to a file.

        Args:
            file_path: Path to file to write
            content: Content to write
            encoding: File encoding (default: utf-8)
            create_dirs: Create parent directories if they don't exist
            backup: Override default backup setting
            **kwargs: Additional arguments

        Returns:
            Dictionary with write results:
            {
                "success": bool,
                "message": str,
                "file_path": str,
                "bytes_written": int,
                "lines_written": int,
                "backup_path": str (if backup created)
            }
        """
        try:
            # Resolve path
            path = Path(file_path).expanduser().resolve()
            file_encoding = encoding or self.encoding
            do_backup = backup if backup is not None else self.backup

            # Create parent directories if requested
            if create_dirs and not path.parent.exists():
                path.parent.mkdir(parents=True, exist_ok=True)

            # Create backup if file exists and backup is enabled
            backup_path = None
            if do_backup and path.exists():
                backup_path = path.with_suffix(path.suffix + '.bak')
                import shutil
                shutil.copy2(path, backup_path)

            # Write content
            with open(path, 'w', encoding=file_encoding) as f:
                f.write(content)

            # Get stats
            bytes_written = len(content.encode(file_encoding))
            lines_written = content.count('\n') + (1 if content and not content.endswith('\n') else 0)

            result = {
                "success": True,
                "message": f"Wrote {bytes_written} bytes to {path.name}",
                "file_path": str(path),
                "bytes_written": bytes_written,
                "lines_written": lines_written,
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
                "bytes_written": 0,
                "lines_written": 0
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error writing file: {str(e)}",
                "file_path": file_path,
                "bytes_written": 0,
                "lines_written": 0
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the write tool"""
        import tempfile
        import os

        # Test writing new file
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = os.path.join(tmpdir, 'test.txt')
            content = "Hello, World!\nThis is a test."

            result1 = self.forward(test_file, content)
            assert result1["success"], "Should write file successfully"
            assert os.path.exists(test_file), "File should exist"

            # Test overwriting with backup
            result2 = self.forward(test_file, "New content", backup=True)
            assert result2["success"], "Should overwrite with backup"
            assert "backup_path" in result2, "Should create backup"

            return {
                "success": True,
                "message": "Write tool tests passed",
                "test_results": [result1, result2]
            }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
