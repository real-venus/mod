"""
Glob File Finder Tool

Find files using glob patterns.
"""

import os
from typing import Dict, Any, Optional, List
from pathlib import Path
import fnmatch


class Tool:
    """Find files using glob patterns"""

    description = """
    Find files matching glob patterns with support for:
    - Recursive searching with **
    - Multiple patterns
    - File/directory filtering
    - Size and time filtering
    - Sorted results
    """

    def __init__(self, **kwargs):
        """Initialize glob tool."""
        pass

    def forward(
        self,
        pattern: str,
        path: str = ".",
        recursive: bool = True,
        files_only: bool = True,
        dirs_only: bool = False,
        sort_by: str = "name",
        max_results: int = 1000,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Find files matching a glob pattern.

        Args:
            pattern: Glob pattern (e.g., "*.py", "**/*.js", "test_*.py")
            path: Base directory to search from
            recursive: Enable recursive search (** pattern)
            files_only: Only return files, not directories
            dirs_only: Only return directories, not files
            sort_by: Sort results by "name", "size", "mtime" (modified time)
            max_results: Maximum number of results to return
            **kwargs: Additional arguments

        Returns:
            Dictionary with matched files:
            {
                "success": bool,
                "message": str,
                "pattern": str,
                "matches": [
                    {
                        "path": str,
                        "name": str,
                        "size": int,
                        "mtime": float,
                        "is_file": bool,
                        "is_dir": bool
                    },
                    ...
                ],
                "total": int
            }
        """
        try:
            # Resolve base path
            base_path = Path(path).expanduser().resolve()

            if not base_path.exists():
                return {
                    "success": False,
                    "message": f"Path not found: {path}",
                    "pattern": pattern,
                    "matches": [],
                    "total": 0
                }

            # Handle recursive patterns
            if recursive and '**' not in pattern:
                search_pattern = f"**/{pattern}"
            else:
                search_pattern = pattern

            # Find matches
            matches = []
            try:
                matched_paths = base_path.glob(search_pattern)

                for match_path in matched_paths:
                    if len(matches) >= max_results:
                        break

                    # Filter by type
                    if files_only and not match_path.is_file():
                        continue
                    if dirs_only and not match_path.is_dir():
                        continue

                    try:
                        stat = match_path.stat()
                        matches.append({
                            "path": str(match_path),
                            "name": match_path.name,
                            "size": stat.st_size if match_path.is_file() else 0,
                            "mtime": stat.st_mtime,
                            "is_file": match_path.is_file(),
                            "is_dir": match_path.is_dir()
                        })
                    except (PermissionError, OSError):
                        continue

            except (PermissionError, OSError) as e:
                return {
                    "success": False,
                    "message": f"Permission error: {str(e)}",
                    "pattern": pattern,
                    "matches": [],
                    "total": 0
                }

            # Sort results
            if sort_by == "size":
                matches.sort(key=lambda x: x["size"], reverse=True)
            elif sort_by == "mtime":
                matches.sort(key=lambda x: x["mtime"], reverse=True)
            else:  # name
                matches.sort(key=lambda x: x["name"])

            return {
                "success": True,
                "message": f"Found {len(matches)} matches for pattern '{pattern}'",
                "pattern": pattern,
                "matches": matches,
                "total": len(matches)
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error during glob search: {str(e)}",
                "pattern": pattern,
                "matches": [],
                "total": 0
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the glob tool"""
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create test files
            os.makedirs(os.path.join(tmpdir, 'subdir'))
            for name in ['test1.py', 'test2.py', 'readme.md']:
                open(os.path.join(tmpdir, name), 'w').close()
            open(os.path.join(tmpdir, 'subdir', 'test3.py'), 'w').close()

            # Test glob pattern
            result = self.forward("*.py", path=tmpdir, recursive=False)
            assert result["success"], "Glob should succeed"
            assert result["total"] == 2, "Should find 2 .py files in root"

            # Test recursive
            result2 = self.forward("*.py", path=tmpdir, recursive=True)
            assert result2["total"] == 3, "Should find 3 .py files recursively"

            return {
                "success": True,
                "message": "Glob tool tests passed",
                "test_results": [result, result2]
            }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
