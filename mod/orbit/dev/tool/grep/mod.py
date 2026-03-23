"""
Grep Search Tool

Search for patterns in files using regex.
"""

import re
import os
from typing import Dict, Any, Optional, List
from pathlib import Path


class Tool:
    """Search for patterns in files"""

    description = """
    Search for regex patterns in files with support for:
    - Recursive directory search
    - Case-insensitive matching
    - Context lines (before/after)
    - File type filtering
    - Line number display
    """

    def __init__(self, **kwargs):
        """Initialize grep tool."""
        pass

    def forward(
        self,
        pattern: str,
        path: str = ".",
        recursive: bool = True,
        ignore_case: bool = False,
        file_pattern: Optional[str] = None,
        context: int = 0,
        max_results: int = 100,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Search for a pattern in files.

        Args:
            pattern: Regex pattern to search for
            path: Directory or file to search in
            recursive: Search recursively in directories
            ignore_case: Case-insensitive search
            file_pattern: File glob pattern (e.g., "*.py")
            context: Number of context lines to show
            max_results: Maximum number of matches to return
            **kwargs: Additional arguments

        Returns:
            Dictionary with search results:
            {
                "success": bool,
                "message": str,
                "pattern": str,
                "matches": [
                    {
                        "file": str,
                        "line_number": int,
                        "line": str,
                        "context_before": [str],
                        "context_after": [str]
                    },
                    ...
                ],
                "files_searched": int,
                "total_matches": int
            }
        """
        try:
            # Compile regex pattern
            flags = re.IGNORECASE if ignore_case else 0
            regex = re.compile(pattern, flags)

            # Resolve path
            search_path = Path(path).expanduser().resolve()

            if not search_path.exists():
                return {
                    "success": False,
                    "message": f"Path not found: {path}",
                    "pattern": pattern,
                    "matches": [],
                    "files_searched": 0,
                    "total_matches": 0
                }

            matches = []
            files_searched = 0

            # Get files to search
            if search_path.is_file():
                files_to_search = [search_path]
            elif recursive:
                pattern_glob = file_pattern or "**/*"
                files_to_search = [
                    f for f in search_path.glob(pattern_glob)
                    if f.is_file()
                ]
            else:
                pattern_glob = file_pattern or "*"
                files_to_search = [
                    f for f in search_path.glob(pattern_glob)
                    if f.is_file()
                ]

            # Search files
            for file_path in files_to_search:
                if len(matches) >= max_results:
                    break

                try:
                    # Skip binary files
                    with open(file_path, 'rb') as f:
                        chunk = f.read(512)
                        if b'\x00' in chunk:
                            continue

                    # Search file
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()

                    files_searched += 1

                    for i, line in enumerate(lines):
                        if len(matches) >= max_results:
                            break

                        if regex.search(line):
                            match = {
                                "file": str(file_path),
                                "line_number": i + 1,
                                "line": line.rstrip()
                            }

                            # Add context if requested
                            if context > 0:
                                start = max(0, i - context)
                                end = min(len(lines), i + context + 1)
                                match["context_before"] = [
                                    lines[j].rstrip() for j in range(start, i)
                                ]
                                match["context_after"] = [
                                    lines[j].rstrip() for j in range(i + 1, end)
                                ]

                            matches.append(match)

                except (PermissionError, UnicodeDecodeError, OSError):
                    continue

            return {
                "success": True,
                "message": f"Found {len(matches)} matches in {files_searched} files",
                "pattern": pattern,
                "matches": matches,
                "files_searched": files_searched,
                "total_matches": len(matches)
            }

        except re.error as e:
            return {
                "success": False,
                "message": f"Invalid regex pattern: {str(e)}",
                "pattern": pattern,
                "matches": [],
                "files_searched": 0,
                "total_matches": 0
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error during search: {str(e)}",
                "pattern": pattern,
                "matches": [],
                "files_searched": 0,
                "total_matches": 0
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the grep tool"""
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create test files
            test_file = os.path.join(tmpdir, 'test.py')
            with open(test_file, 'w') as f:
                f.write("def hello():\n    print('Hello')\n    return True\n")

            # Test pattern search
            result = self.forward("def ", path=tmpdir, file_pattern="*.py")
            assert result["success"], "Search should succeed"
            assert result["total_matches"] > 0, "Should find matches"

            return {
                "success": True,
                "message": "Grep tool tests passed",
                "test_results": result
            }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
