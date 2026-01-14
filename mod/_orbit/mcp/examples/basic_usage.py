#!/usr/bin/env python3
"""\nBasic MCP Usage Examples\n\nDemonstrates fundamental MCP concepts and usage patterns.\n"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp.demo import Demo
from mcp.client import MCPClient, call
from mcp.mcp import MCP


def example_1_direct_usage():
    """Example 1: Direct usage of Demo class"""
    print("\n" + "="*60)
    print("Example 1: Direct Usage")
    print("="*60)
    
    demo = Demo()
    
    # Basic operations
    print(f"\nAdd: 10 + 5 = {demo.add(10, 5)}")
    print(f"Multiply: 4 * 7 = {demo.multiply(4, 7)}")
    print(f"Greet: {demo.greet('World')}")
    
    # State management
    demo.set_state("user", "alice")
    demo.set_state("count", 42)
    print(f"\nState: {demo.get_state()}")
    
    # List processing
    numbers = [1, 2, 3, 4, 5]
    stats = demo.process_list(numbers)
    print(f"\nStats for {numbers}:")
    for key, value in stats.items():
        print(f"  {key}: {value}")


def example_2_sync_client():
    """Example 2: Using synchronous client"""
    print("\n" + "="*60)
    print("Example 2: Synchronous Client")
    print("="*60)
    
    # Simple call
    result = call("add", {"a": 15, "b": 25})
    print(f"\nRemote add(15, 25) = {result}")
    
    # Call with greeting
    greeting = call("greet", {"name": "Bob"})
    print(f"Remote greet: {greeting}")


async def example_3_async_client():
    """Example 3: Using async client"""
    print("\n" + "="*60)
    print("Example 3: Async Client")
    print("="*60)
    
    async with MCPClient() as client:
        # Initialize
        await client.initialize()
        print("\nClient initialized")
        
        # List available tools
        tools = await client.list_tools()
        print(f"\nAvailable tools ({len(tools)}):")
        for tool in tools:
            print(f"  - {tool['name']}: {tool['description'][:50]}...")
        
        # Call multiple tools
        print("\nCalling tools:")
        result1 = await client.call("add", a=100, b=200)
        print(f"  add(100, 200) = {result1[0]['text']}")
        
        result2 = await client.call("multiply", a=12, b=8)
        print(f"  multiply(12, 8) = {result2[0]['text']}")
        
        result3 = await client.call("greet", name="Charlie")
        print(f"  greet('Charlie') = {result3[0]['text']}")


class CustomAgent(MCP):
    """Custom agent extending MCP base class"""
    
    def __init__(self):
        super().__init__(goal="Demonstrate MCP capabilities")
        
        # Register custom tools
        self.register_tool(
            "square",
            lambda x: x ** 2,
            metadata={"description": "Square a number"}
        )
        
        self.register_tool(
            "cube",
            lambda x: x ** 3,
            metadata={"description": "Cube a number"}
        )
    
    def process(self, data: list) -> dict:
        """Process a list of numbers"""
        return {
            "original": data,
            "squared": [x**2 for x in data],
            "cubed": [x**3 for x in data],
            "sum": sum(data)
        }


def example_4_custom_agent():
    """Example 4: Custom agent with MCP base"""
    print("\n" + "="*60)
    print("Example 4: Custom Agent")
    print("="*60)
    
    agent = CustomAgent()
    
    # List tools
    print(f"\nRegistered tools: {agent.list_tools()}")
    
    # Use registered tools
    square_tool = agent.get_tool("square")
    result = square_tool['func'](5)
    print(f"\nSquare of 5: {result}")
    
    # Use act method
    action_result = agent.act("process", {"data": [1, 2, 3, 4, 5]})
    print(f"\nAction result:")
    print(f"  Output: {action_result['output']}")
    
    # Check history
    print(f"\nAgent history: {len(agent.history)} entries")


def example_5_error_handling():
    """Example 5: Error handling"""
    print("\n" + "="*60)
    print("Example 5: Error Handling")
    print("="*60)
    
    demo = Demo()
    
    # Valid call
    try:
        result = demo.add(10, 20)
        print(f"\nValid call: add(10, 20) = {result}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Invalid method
    try:
        agent = MCP()
        agent.call("nonexistent_method")
    except AttributeError as e:
        print(f"\nExpected error for invalid method: {e}")
    
    # Type error
    try:
        demo.add("not", "numbers")
    except TypeError as e:
        print(f"\nExpected error for wrong types: {e}")


def main():
    """Run all examples"""
    print("\n" + "#"*60)
    print("#" + " "*58 + "#")
    print("#" + "  MCP Basic Usage Examples".center(58) + "#")
    print("#" + " "*58 + "#")
    print("#"*60)
    
    # Run synchronous examples
    example_1_direct_usage()
    example_2_sync_client()
    example_4_custom_agent()
    example_5_error_handling()
    
    # Run async example
    print("\nRunning async example...")
    asyncio.run(example_3_async_client())
    
    print("\n" + "#"*60)
    print("All examples completed successfully!")
    print("#"*60 + "\n")


if __name__ == "__main__":
    main()
