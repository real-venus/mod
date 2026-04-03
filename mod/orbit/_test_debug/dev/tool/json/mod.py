"""
JSON Tool

Parse, validate, and manipulate JSON data.
"""

import json
from typing import Dict, Any, Optional


class Tool:
    """JSON parsing and manipulation"""

    description = """
    Work with JSON data:
    - Parse JSON strings
    - Validate JSON
    - Pretty-print JSON
    - Extract values with JSON paths
    - Fix malformed JSON using AI
    """

    def __init__(self, **kwargs):
        """Initialize JSON tool."""
        pass

    def forward(
        self,
        action: str = "parse",
        data: Optional[str] = None,
        obj: Optional[Any] = None,
        path: Optional[str] = None,
        indent: int = 2,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Work with JSON data.

        Args:
            action: Action to perform ("parse", "stringify", "validate", "extract", "fix")
            data: JSON string (for parse, validate, fix)
            obj: Python object (for stringify)
            path: JSON path for extraction (e.g., "data.users[0].name")
            indent: Indentation for pretty-printing
            **kwargs: Additional arguments

        Returns:
            Dictionary with results:
            {
                "success": bool,
                "message": str,
                "result": Any,
                "valid": bool (for validate)
            }
        """
        try:
            if action == "parse":
                if not data:
                    return {
                        "success": False,
                        "message": "No JSON data provided",
                        "result": None
                    }

                try:
                    result = json.loads(data)
                    return {
                        "success": True,
                        "message": "JSON parsed successfully",
                        "result": result
                    }
                except json.JSONDecodeError as e:
                    return {
                        "success": False,
                        "message": f"JSON parse error: {str(e)}",
                        "result": None,
                        "error": str(e)
                    }

            elif action == "stringify":
                if obj is None:
                    return {
                        "success": False,
                        "message": "No object provided",
                        "result": None
                    }

                try:
                    result = json.dumps(obj, indent=indent, ensure_ascii=False)
                    return {
                        "success": True,
                        "message": "Object serialized to JSON",
                        "result": result
                    }
                except (TypeError, ValueError) as e:
                    return {
                        "success": False,
                        "message": f"Serialization error: {str(e)}",
                        "result": None
                    }

            elif action == "validate":
                if not data:
                    return {
                        "success": False,
                        "message": "No JSON data provided",
                        "valid": False
                    }

                try:
                    json.loads(data)
                    return {
                        "success": True,
                        "message": "JSON is valid",
                        "valid": True
                    }
                except json.JSONDecodeError as e:
                    return {
                        "success": True,
                        "message": f"Invalid JSON: {str(e)}",
                        "valid": False,
                        "error": str(e)
                    }

            elif action == "extract":
                if not data or not path:
                    return {
                        "success": False,
                        "message": "Both data and path required for extraction",
                        "result": None
                    }

                try:
                    obj = json.loads(data) if isinstance(data, str) else data

                    # Simple path extraction (e.g., "data.users[0].name")
                    parts = path.replace('[', '.').replace(']', '').split('.')
                    result = obj
                    for part in parts:
                        if part.isdigit():
                            result = result[int(part)]
                        elif part:
                            result = result[part]

                    return {
                        "success": True,
                        "message": f"Extracted value at path: {path}",
                        "result": result
                    }
                except (KeyError, IndexError, TypeError) as e:
                    return {
                        "success": False,
                        "message": f"Path not found: {str(e)}",
                        "result": None
                    }

            elif action == "fix":
                if not data:
                    return {
                        "success": False,
                        "message": "No JSON data provided",
                        "result": None
                    }

                # Try to fix common JSON issues
                fixed_data = data.strip()

                # Fix single quotes
                fixed_data = fixed_data.replace("'", '"')

                # Fix trailing commas
                import re
                fixed_data = re.sub(r',(\s*[}\]])', r'\1', fixed_data)

                try:
                    result = json.loads(fixed_data)
                    return {
                        "success": True,
                        "message": "JSON fixed and parsed",
                        "result": result,
                        "fixed": fixed_data
                    }
                except json.JSONDecodeError:
                    # Use AI to fix if available
                    try:
                        import mod as m
                        prompt = f"Fix this malformed JSON and return only the valid JSON:\n{data}"
                        fixed = m.ask(prompt)
                        result = json.loads(fixed)
                        return {
                            "success": True,
                            "message": "JSON fixed using AI",
                            "result": result,
                            "fixed": fixed
                        }
                    except:
                        return {
                            "success": False,
                            "message": "Could not fix JSON",
                            "result": None
                        }

            else:
                return {
                    "success": False,
                    "message": f"Unknown action: {action}",
                    "result": None
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "result": None
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the JSON tool"""
        # Test parse
        result1 = self.forward("parse", data='{"name": "test", "value": 123}')
        assert result1["success"], "Should parse JSON"
        assert result1["result"]["name"] == "test", "Should extract values"

        # Test stringify
        result2 = self.forward("stringify", obj={"test": True})
        assert result2["success"], "Should stringify object"

        # Test validate
        result3 = self.forward("validate", data='{"valid": true}')
        assert result3["valid"], "Should validate correct JSON"

        return {
            "success": True,
            "message": "JSON tool tests passed",
            "test_results": [result1, result2, result3]
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
