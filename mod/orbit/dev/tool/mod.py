"""
Tool Registry

Central registry for all dev tools. Provides tool discovery and schema generation.
"""

from typing import Dict, Any, List, Optional
import importlib
import inspect
from pathlib import Path


class Tool:
    """Tool registry and discovery"""

    description = """
    Central tool registry for the dev module.
    Provides tool listing, schema generation, and tool invocation.
    """

    def __init__(self, **kwargs):
        """Initialize tool registry."""
        self.tools_dir = Path(__file__).parent
        self._cache = {}

    def list_tools(self) -> List[str]:
        """
        List all available tools.

        Returns:
            List of tool names
        """
        tools = []
        for item in self.tools_dir.iterdir():
            if item.is_dir() and not item.name.startswith('_'):
                mod_file = item / 'mod.py'
                if mod_file.exists():
                    tools.append(item.name)
        return sorted(tools)

    def get_tool(self, name: str) -> Any:
        """
        Get a tool class by name.

        Args:
            name: Tool name

        Returns:
            Tool class
        """
        if name in self._cache:
            return self._cache[name]

        try:
            # Import tool module
            module_path = f"dev.tool.{name}.mod"
            module = importlib.import_module(module_path)

            # Get Tool class
            if hasattr(module, 'Tool'):
                tool_class = module.Tool
                self._cache[name] = tool_class
                return tool_class
            else:
                raise AttributeError(f"Tool class not found in {module_path}")

        except ImportError as e:
            raise ImportError(f"Could not import tool '{name}': {e}")

    def get_schema(self, name: str, method: str = 'forward') -> Dict[str, Any]:
        """
        Get schema for a tool's method.

        Args:
            name: Tool name
            method: Method name (default: 'forward')

        Returns:
            Schema dictionary with parameters and return type
        """
        tool_class = self.get_tool(name)

        if not hasattr(tool_class, method):
            return {
                "error": f"Method '{method}' not found in tool '{name}'"
            }

        method_obj = getattr(tool_class, method)
        sig = inspect.signature(method_obj)

        params = {}
        for param_name, param in sig.parameters.items():
            if param_name in ['self', 'kwargs']:
                continue

            param_info = {
                "type": str(param.annotation) if param.annotation != inspect.Parameter.empty else "Any",
                "required": param.default == inspect.Parameter.empty,
            }

            if param.default != inspect.Parameter.empty:
                param_info["default"] = param.default

            params[param_name] = param_info

        return {
            "tool": name,
            "method": method,
            "description": tool_class.description if hasattr(tool_class, 'description') else method_obj.__doc__ or "",
            "parameters": params,
            "returns": str(sig.return_annotation) if sig.return_annotation != inspect.Signature.empty else "Any"
        }

    def forward(
        self,
        action: str = "list",
        tool: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Main tool registry interface.

        Args:
            action: Action to perform ("list", "schema", "help")
            tool: Tool name (for schema/help actions)
            **kwargs: Additional arguments

        Returns:
            Dictionary with results
        """
        try:
            if action == "list":
                tools = self.list_tools()
                return {
                    "success": True,
                    "message": f"Found {len(tools)} tools",
                    "tools": tools
                }

            elif action == "schema":
                if not tool:
                    return {
                        "success": False,
                        "message": "Tool name required for schema action"
                    }

                schema = self.get_schema(tool)
                return {
                    "success": True,
                    "message": f"Schema for tool '{tool}'",
                    "schema": schema
                }

            elif action == "help":
                if not tool:
                    # General help
                    tools = self.list_tools()
                    return {
                        "success": True,
                        "message": "Available dev tools",
                        "tools": tools,
                        "usage": "Use action='schema' with tool='name' to get tool details"
                    }
                else:
                    # Tool-specific help
                    schema = self.get_schema(tool)
                    return {
                        "success": True,
                        "message": f"Help for tool '{tool}'",
                        "schema": schema
                    }

            else:
                return {
                    "success": False,
                    "message": f"Unknown action: {action}. Use 'list', 'schema', or 'help'"
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error in tool registry: {str(e)}"
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the tool registry"""
        # Test listing tools
        result = self.forward(action="list")
        assert result["success"], "Should list tools successfully"
        assert len(result["tools"]) > 0, "Should find tools"

        return {
            "success": True,
            "message": "Tool registry tests passed",
            "test_results": result
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
