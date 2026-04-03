"""
File Read Tool

Reads files from the filesystem with support for line ranges and encoding.
"""

import os
from typing import Dict, Any, Optional, List
from pathlib import Path


class Tool:
    """Read files from the filesystem"""

    description = """
    Read file contents with support for:
    - Line range selection (offset and limit)
    - Multiple encodings
    - Binary file detection
    - Large file handling
    """

    def __init__(self, encoding: str = 'utf-8', **kwargs):
        """
        Initialize read tool.

        Args:
            encoding: Default file encoding (default: 'utf-8')
        """
        self.encoding = encoding

    def forward(
        self,
        file_path: str,
        offset: Optional[int] = None,
        limit: Optional[int] = None,
        encoding: Optional[str] = None,
        show_line_numbers: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Read a file from the filesystem.

        Args:
            file_path: Path to file to read
            offset: Line number to start reading from (0-indexed)
            limit: Maximum number of lines to read
            encoding: File encoding (default: utf-8)
            show_line_numbers: Prepend line numbers to output
            **kwargs: Additional arguments

        Returns:
            Dictionary with file contents:
            {
                "success": bool,
                "message": str,
                "file_path": str,
                "content": str,
                "lines": int,
                "size": int,
                "encoding": str
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
                    "content": "",
                    "lines": 0,
                    "size": 0,
                    "encoding": encoding or self.encoding
                }

            if not path.is_file():
                return {
                    "success": False,
                    "message": f"Path is not a file: {file_path}",
                    "file_path": str(path),
                    "content": "",
                    "lines": 0,
                    "size": 0,
                    "encoding": encoding or self.encoding
                }

            file_encoding = encoding or self.encoding
            file_size = path.stat().st_size

            # Try to detect binary files
            try:
                with open(path, 'rb') as f:
                    chunk = f.read(512)
                    if b'\x00' in chunk:
                        return {
                            "success": False,
                            "message": "Cannot read binary file",
                            "file_path": str(path),
                            "content": "",
                            "lines": 0,
                            "size": file_size,
                            "encoding": "binary"
                        }
            except:
                pass

            # Read file
            try:
                with open(path, 'r', encoding=file_encoding) as f:
                    lines = f.readlines()
            except UnicodeDecodeError:
                # Try alternative encodings
                for alt_encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                    try:
                        with open(path, 'r', encoding=alt_encoding) as f:
                            lines = f.readlines()
                        file_encoding = alt_encoding
                        break
                    except:
                        continue
                else:
                    return {
                        "success": False,
                        "message": f"Could not decode file with encoding: {file_encoding}",
                        "file_path": str(path),
                        "content": "",
                        "lines": 0,
                        "size": file_size,
                        "encoding": file_encoding
                    }

            # Apply offset and limit
            total_lines = len(lines)
            start = offset if offset is not None else 0
            end = start + limit if limit is not None else total_lines

            selected_lines = lines[start:end]

            # Add line numbers if requested
            if show_line_numbers:
                formatted_lines = [
                    f"{i + start + 1:6d}→{line.rstrip()}"
                    for i, line in enumerate(selected_lines)
                ]
                content = '\n'.join(formatted_lines)
            else:
                content = ''.join(selected_lines)

            return {
                "success": True,
                "message": f"Read {len(selected_lines)} lines from {path.name}",
                "file_path": str(path),
                "content": content,
                "lines": len(selected_lines),
                "total_lines": total_lines,
                "size": file_size,
                "encoding": file_encoding
            }

        except PermissionError:
            return {
                "success": False,
                "message": f"Permission denied: {file_path}",
                "file_path": file_path,
                "content": "",
                "lines": 0,
                "size": 0,
                "encoding": encoding or self.encoding
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error reading file: {str(e)}",
                "file_path": file_path,
                "content": "",
                "lines": 0,
                "size": 0,
                "encoding": encoding or self.encoding
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the read tool"""
        # Create a test file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            test_file = f.name
            f.write("Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n")

        try:
            # Test reading entire file
            result1 = self.forward(test_file)
            assert result1["success"], "Should read file successfully"
            assert result1["total_lines"] == 5, "Should have 5 lines"

            # Test reading with offset and limit
            result2 = self.forward(test_file, offset=1, limit=2)
            assert result2["success"], "Should read with offset/limit"
            assert result2["lines"] == 2, "Should read 2 lines"

            return {
                "success": True,
                "message": "Read tool tests passed",
                "test_results": [result1, result2]
            }
        finally:
            os.unlink(test_file)


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
