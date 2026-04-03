import mod as c
import os
from typing import Dict, Any, Optional

print = c.print

class Tool:
    """Precise file editor using exact string matching for replacements."""

    def forward(
        self,
        path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
        backup: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Edit file by replacing exact string matches with precision.

        Args:
            path: File path to edit (absolute or relative)
            old_string: Exact text to find and replace
            new_string: Text to replace with (must differ from old_string)
            replace_all: Replace all occurrences (default: False, fails if not unique)
            backup: Create backup before editing

        Returns:
            Dict with success status, message, and details
        """
        try:
            path = os.path.abspath(path)

            if not os.path.exists(path):
                return {"success": False, "message": f"File not found: {path}"}

            if old_string == new_string:
                return {"success": False, "message": "old_string and new_string must be different"}

            # Create backup if requested
            if backup:
                backup_path = f"{path}.backup"
                with open(path, 'r', encoding='utf-8') as src:
                    with open(backup_path, 'w', encoding='utf-8') as dst:
                        dst.write(src.read())

            # Read file content
            text = self.get_text(path)

            # Check if old_string exists
            if old_string not in text:
                return {"success": False, "message": f"old_string not found in {path}"}

            # Count occurrences
            occurrences = text.count(old_string)

            if not replace_all and occurrences > 1:
                return {
                    "success": False,
                    "message": f"old_string appears {occurrences} times in file. Either provide a larger unique string or use replace_all=True"
                }

            # Perform replacement
            if replace_all:
                new_text = text.replace(old_string, new_string)
                replacements = occurrences
            else:
                new_text = text.replace(old_string, new_string, 1)
                replacements = 1

            # Write back
            self.put_text(path, new_text)

            return {
                "success": True,
                "message": f"Successfully edited {path}: replaced {replacements} occurrence(s)",
                "replacements": replacements,
                "file_size_before": len(text),
                "file_size_after": len(new_text)
            }
        except Exception as e:
            return {"success": False, "message": f"Error editing file: {str(e)}"}
    
    def put_text(self, path: str, content: str) -> None:
        """Write content to file with directory creation."""
        path = os.path.abspath(path)
        dir_path = os.path.dirname(path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def get_text(self, path: str) -> str:
        """Read file content with error handling."""
        path = os.path.abspath(path)
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def test(self, test_file: str = '~/.mod/edit_file/test.py') -> Dict[str, Any]:
        """Comprehensive test suite for Tool functionality."""
        test_file = os.path.expanduser(test_file)
        sample_content = "Line 0\nLine 1\nLine 2\nLine 3\nLine 4\n"

        # Test 1: Basic string replacement
        self.put_text(test_file, sample_content)
        result = self.forward(
            path=test_file,
            old_string="Line 1\nLine 2\nLine 3",
            new_string="New Content"
        )
        assert result["success"], f"Test 1 failed: {result['message']}"
        updated_text = self.get_text(test_file)
        assert "New Content" in updated_text, "Test 1: Content not updated correctly"
        assert "Line 0" in updated_text, "Test 1: First line should remain"
        assert "Line 4" in updated_text, "Test 1: Last line should remain"
        assert "Line 1" not in updated_text, "Test 1: Old content not removed"
        assert "Line 2" not in updated_text, "Test 1: Old content not removed"
        print("✓ Test 1 passed: Basic string replacement")

        # Test 2: Replace all occurrences
        self.put_text(test_file, "foo\nbar\nfoo\nbaz\nfoo")
        result = self.forward(
            path=test_file,
            old_string="foo",
            new_string="qux",
            replace_all=True
        )
        assert result["success"], f"Test 2 failed: {result['message']}"
        assert result["replacements"] == 3, "Test 2: Should replace 3 occurrences"
        updated_text = self.get_text(test_file)
        assert "foo" not in updated_text, "Test 2: All 'foo' should be replaced"
        assert updated_text.count("qux") == 3, "Test 2: Should have 3 'qux'"
        print("✓ Test 2 passed: Replace all occurrences")

        # Test 3: Non-unique string without replace_all should fail
        self.put_text(test_file, "duplicate\ndata\nduplicate\nend")
        result = self.forward(
            path=test_file,
            old_string="duplicate",
            new_string="unique",
            replace_all=False
        )
        assert not result["success"], "Test 3: Should fail on non-unique string"
        assert "appears 2 times" in result["message"], "Test 3: Should report count"
        print("✓ Test 3 passed: Non-unique detection")

        # Test 4: String not found
        self.put_text(test_file, "hello\nworld")
        result = self.forward(
            path=test_file,
            old_string="missing",
            new_string="found"
        )
        assert not result["success"], "Test 4: Should fail when string not found"
        assert "not found" in result["message"], "Test 4: Should report not found"
        print("✓ Test 4 passed: String not found detection")

        print("\n✅ All tests passed!")
        return True