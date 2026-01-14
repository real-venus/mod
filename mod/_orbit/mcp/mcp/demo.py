#!/usr/bin/env python3
"""\nMCP Demo Module - Example implementation showing how to use the MCP system\n\nThis module demonstrates:\n- Creating a simple MCP-compatible class\n- Registering tools and methods\n- Using the client/server architecture\n- Best practices for MCP development\n"""

from typing import Dict, Any, List
import json


class Demo:
    """\n    Demo class showcasing MCP functionality.\n    \n    This class can be used as a template for building your own MCP modules.\n    All public methods automatically become available as MCP tools.\n    """
    
    def __init__(self):
        self.state = {}
        self.counter = 0
    
    def add(self, a: int, b: int) -> int:
        """\n        Add two numbers together.\n        \n        Args:\n            a: First number\n            b: Second number\n            \n        Returns:\n            Sum of a and b\n            \n        Example:\n            >>> demo.add(5, 3)\n            8\n        """
        return a + b
    
    def multiply(self, a: int, b: int) -> int:
        """\n        Multiply two numbers.\n        \n        Args:\n            a: First number\n            b: Second number\n            \n        Returns:\n            Product of a and b\n            \n        Example:\n            >>> demo.multiply(4, 7)\n            28\n        """
        return a * b
    
    def greet(self, name: str = "World") -> str:
        """\n        Generate a greeting message.\n        \n        Args:\n            name: Name to greet (default: World)\n            \n        Returns:\n            Greeting string\n            \n        Example:\n            >>> demo.greet("Alice")\n            'Hello, Alice!'\n        """
        return f"Hello, {name}!"
    
    def set_state(self, key: str, value: Any) -> Dict[str, Any]:
        """\n        Set a state value.\n        \n        Args:\n            key: State key\n            value: Value to store\n            \n        Returns:\n            Updated state dictionary\n            \n        Example:\n            >>> demo.set_state("user", "bob")\n            {'user': 'bob'}\n        """
        self.state[key] = value
        return self.state
    
    def get_state(self, key: str = None) -> Any:
        """\n        Get state value(s).\n        \n        Args:\n            key: Specific key to retrieve (optional, returns all if None)\n            \n        Returns:\n            State value or entire state dict\n            \n        Example:\n            >>> demo.get_state("user")\n            'bob'\n        """
        if key is None:
            return self.state
        return self.state.get(key)
    
    def increment(self) -> int:
        """\n        Increment internal counter.\n        \n        Returns:\n            New counter value\n            \n        Example:\n            >>> demo.increment()\n            1\n        """
        self.counter += 1
        return self.counter
    
    def process_list(self, items: List[int]) -> Dict[str, Any]:
        """\n        Process a list of numbers and return statistics.\n        \n        Args:\n            items: List of integers\n            \n        Returns:\n            Dictionary with sum, average, min, max\n            \n        Example:\n            >>> demo.process_list([1, 2, 3, 4, 5])\n            {'sum': 15, 'avg': 3.0, 'min': 1, 'max': 5, 'count': 5}\n        """
        if not items:
            return {'sum': 0, 'avg': 0, 'min': 0, 'max': 0, 'count': 0}
        
        return {
            'sum': sum(items),
            'avg': sum(items) / len(items),
            'min': min(items),
            'max': max(items),
            'count': len(items)
        }


if __name__ == "__main__":
    # Example usage
    print("=" * 60)
    print("MCP Demo Module - Example Usage")
    print("=" * 60)
    
    demo = Demo()
    
    print("\n1. Basic arithmetic:")
    print(f"   add(10, 5) = {demo.add(10, 5)}")
    print(f"   multiply(4, 7) = {demo.multiply(4, 7)}")
    
    print("\n2. Greeting:")
    print(f"   greet('Leonardo') = {demo.greet('Leonardo')}")
    
    print("\n3. State management:")
    demo.set_state("project", "MCP")
    demo.set_state("version", "1.0")
    print(f"   State: {demo.get_state()}")
    
    print("\n4. Counter:")
    for i in range(3):
        print(f"   increment() = {demo.increment()}")
    
    print("\n5. List processing:")
    result = demo.process_list([10, 20, 30, 40, 50])
    print(f"   Stats: {json.dumps(result, indent=2)}")
    
    print("\n" + "=" * 60)
    print("To use with MCP server:")
    print("  python -m mcp.server --name demo --target 'mcp.demo:Demo'")
    print("\nTo call from client:")
    print("  python -m mcp.client call --tool add --args '{\"a\":5,\"b\":3}'")
    print("=" * 60)
