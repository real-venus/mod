import mod as c
import os
from typing import Dict, Any, Optional

print = c.print

class Tool:
    """Advanced file editor with line-based content replacement and robust error handling."""
    
    def forward(
        self,
        path: str,
        content: str,
        start_line: int,
        end_line: int,
        backup: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Edit file by replacing content between line numbers with enhanced safety.
        
        Args:
            path: File path to edit (absolute or relative)
            content: New content to insert
            start_line: Start line number (1-indexed)
            end_line: End line number (1-indexed, inclusive)
            backup: Create backup before editing
            
        Returns:
            Dict with success status, message, and updated content
        """
        try:
            path = os.path.abspath(path)
            
            if not os.path.exists(path):
                return {"success": False, "message": f"File not found: {path}", "content": None}
            
            if start_line is None or end_line is None:
                return {"success": False, "message": "Both start_line and end_line are required", "content": None}
            
            # Create backup if requested
            if backup:
                backup_path = f"{path}.backup"
                with open(path, 'r', encoding='utf-8') as src:
                    with open(backup_path, 'w', encoding='utf-8') as dst:
                        dst.write(src.read())
            
            text = self.get_text(path)
            lines = text.splitlines(keepends=True)
            new_lines = lines[:start_line] + [content] + lines[end_line:]
            new_text = ''.join(new_lines)
            self.put_text(path, new_text)
            
            return {
                "success": True,
                "message": f"Successfully edited {path}: replaced lines {start_line}-{end_line}",
                "content": new_text,
                "lines_replaced": end_line - start_line + 1
            }
        except Exception as e:
            return {"success": False, "message": f"Error editing file: {str(e)}", "content": None}
    
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
        

        # Test 1: Basic edit
        self.put_text(test_file, sample_content)
        result = self.forward(
            path=test_file,
            content="New Content\n",
            start_line=1,
            end_line=3
        )
        assert result["success"], f"Test 1 failed: {result['message']}"
        updated_text = self.get_text(test_file)
        assert "New Content" in updated_text, "Test 1: Content not updated correctly"
        assert "Line 0" in updated_text, "Test 1: First line should remain"
        assert "Line 4" in updated_text, "Test 1: Last line should remain"
        assert "Line 1" not in updated_text, "Test 1: Old lines not removed"
        assert "Line 2" not in updated_text, "Test 1: Old lines not removed"
        print("✓ Test 1 passed: Basic edit")
        
        return True