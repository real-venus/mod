#!/usr/bin/env python3
"""Simple example: Add two numbers using MCP"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp.client import MCPClient


class Calculator:
    """Simple calculator with add function"""
    
    def add(self, a: int, b: int) -> int:
        """Add two numbers together"""
        return a + b


async def main():
    # Start server with Calculator class
    server_cmd = [
        sys.executable, "-m", "mcp.server",
        "--name", "calculator",
        "--target", "examples.add_numbers:Calculator"
    ]
    
    async with MCPClient(server_cmd=server_cmd) as client:
        # Initialize
        await client.initialize()
        print("✓ Calculator MCP server initialized")
        
        # List available tools
        tools = await client.list_tools()
        print(f"\nAvailable tools: {[t['name'] for t in tools]}")
        
        # Add two numbers
        result = await client.call("add", a=5, b=3)
        print(f"\n5 + 3 = {result[0]['text']}")
        
        # Add more numbers
        result = await client.call("add", a=100, b=250)
        print(f"100 + 250 = {result[0]['text']}")


if __name__ == "__main__":
    print("="*50)
    print("MCP Calculator Example - Adding Numbers")
    print("="*50)
    asyncio.run(main())
    print("\n✓ Example completed successfully!")