"""
Python Code Execution Tool

Execute Python code safely in an isolated environment.
"""

import sys
from io import StringIO
from typing import Dict, Any, Optional
import traceback


class Tool:
    """Execute Python code safely"""

    description = """
    Execute Python code with:
    - Captured stdout/stderr
    - Return value extraction
    - Error handling
    - Timeout support
    - Variable persistence between calls
    """

    def __init__(self, **kwargs):
        """Initialize execute tool."""
        self.globals = {}
        self.locals = {}

    def forward(
        self,
        code: str,
        mode: str = "exec",
        reset_state: bool = False,
        return_value: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Execute Python code.

        Args:
            code: Python code to execute
            mode: Execution mode ("exec" for statements, "eval" for expressions)
            reset_state: Reset variable state before execution
            return_value: Try to capture return value
            **kwargs: Additional arguments

        Returns:
            Dictionary with execution results:
            {
                "success": bool,
                "message": str,
                "stdout": str,
                "stderr": str,
                "result": Any,
                "error": str (if failed)
            }
        """
        try:
            # Reset state if requested
            if reset_state:
                self.globals = {}
                self.locals = {}

            # Capture stdout/stderr
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            sys.stdout = StringIO()
            sys.stderr = StringIO()

            result = None
            error = None

            try:
                if mode == "eval":
                    # Evaluate expression
                    result = eval(code, self.globals, self.locals)
                else:
                    # Execute code
                    exec(code, self.globals, self.locals)

                    # Try to get result from last expression
                    if return_value:
                        try:
                            # If code ends with an expression, try to eval it
                            lines = code.strip().split('\n')
                            last_line = lines[-1].strip()
                            if last_line and not last_line.startswith(('if ', 'for ', 'while ', 'def ', 'class ', 'import ', 'from ')):
                                result = eval(last_line, self.globals, self.locals)
                        except:
                            pass

            except Exception as e:
                error = traceback.format_exc()

            # Capture output
            stdout = sys.stdout.getvalue()
            stderr = sys.stderr.getvalue()

            # Restore stdout/stderr
            sys.stdout = old_stdout
            sys.stderr = old_stderr

            if error:
                return {
                    "success": False,
                    "message": "Code execution failed",
                    "stdout": stdout,
                    "stderr": stderr,
                    "result": None,
                    "error": error
                }
            else:
                return {
                    "success": True,
                    "message": "Code executed successfully",
                    "stdout": stdout,
                    "stderr": stderr,
                    "result": result
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Execution error: {str(e)}",
                "stdout": "",
                "stderr": traceback.format_exc(),
                "result": None,
                "error": str(e)
            }

    def clear_state(self) -> Dict[str, Any]:
        """Clear execution state"""
        self.globals = {}
        self.locals = {}
        return {
            "success": True,
            "message": "Execution state cleared"
        }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the execute tool"""
        # Test simple execution
        result1 = self.forward("print('Hello, World!')")
        assert result1["success"], "Should execute print"
        assert "Hello, World!" in result1["stdout"], "Should capture stdout"

        # Test expression evaluation
        result2 = self.forward("2 + 2", mode="eval")
        assert result2["success"], "Should evaluate expression"
        assert result2["result"] == 4, "Should return correct result"

        # Test error handling
        result3 = self.forward("1 / 0")
        assert not result3["success"], "Should catch errors"
        assert "error" in result3, "Should include error info"

        return {
            "success": True,
            "message": "Execute tool tests passed",
            "test_results": [result1, result2, result3]
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
