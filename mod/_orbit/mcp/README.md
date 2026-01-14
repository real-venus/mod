# MCP (Module Control Protocol)

> "Simplicity is the ultimate sophistication" - Leonardo da Vinci

A minimal, elegant Python framework for building modular, communicating systems inspired by the commune architecture.

## 🚀 Features

- **Simple Architecture**: Clean, intuitive design following da Vinci's principles
- **Client/Server Model**: JSON-RPC over stdio for seamless communication
- **Auto-Discovery**: Public methods automatically become callable tools
- **Type Safety**: Full type hints and schema validation
- **Async Support**: Built-in async/await support
- **Extensible**: Easy to extend with custom modules and tools

## 📦 Installation

```bash
cd /root/mod/mod/_mods/mcp
pip install -e .
```

## 🎯 Quick Start

### 1. Create a Module

```python
# my_module.py
class Calculator:
    def add(self, a: int, b: int) -> int:
        """Add two numbers"""
        return a + b
    
    def multiply(self, a: int, b: int) -> int:
        """Multiply two numbers"""
        return a * b
```

### 2. Start the Server

```bash
# Using the demo module
python -m mcp.server --name demo

# Using your custom module
python -m mcp.server --name calculator --target "my_module:Calculator"
```

### 3. Use the Client

```bash
# List available tools
python -m mcp.client list

# Call a tool
python -m mcp.client call --tool add --args '{"a":10,"b":5}'
```

### 4. Programmatic Usage

```python
from mcp.client import call

# Simple function call
result = call("add", {"a": 10, "b": 5})
print(result)  # "15"

# With custom server
result = call(
    "greet", 
    {"name": "Alice"},
    server_cmd=["python", "-m", "mcp.server", "--name", "demo"]
)
print(result)  # "Hello, Alice!"
```

## 📚 Examples

### Example 1: Basic Demo

```python
from mcp.demo import Demo

demo = Demo()

# Arithmetic
print(demo.add(5, 3))  # 8
print(demo.multiply(4, 7))  # 28

# State management
demo.set_state("user", "bob")
print(demo.get_state("user"))  # "bob"

# List processing
stats = demo.process_list([1, 2, 3, 4, 5])
print(stats)  # {'sum': 15, 'avg': 3.0, 'min': 1, 'max': 5, 'count': 5}
```

### Example 2: Using MCP Base Class

```python
from mcp.mcp import MCP

class MyAgent(MCP):
    def __init__(self):
        super().__init__(goal="Process data efficiently")
        
        # Register custom tools
        self.register_tool(
            "analyze",
            self.analyze_data,
            metadata={"description": "Analyze input data"}
        )
    
    def analyze_data(self, data: list) -> dict:
        return {
            "count": len(data),
            "sum": sum(data),
            "avg": sum(data) / len(data) if data else 0
        }

# Use the agent
agent = MyAgent()
result = agent.act("analyze", {"data": [10, 20, 30]})
print(result)
```

### Example 3: Async Client

```python
import asyncio
from mcp.client import MCPClient

async def main():
    async with MCPClient() as client:
        await client.initialize()
        
        # List tools
        tools = await client.list_tools()
        print(f"Available tools: {[t['name'] for t in tools]}")
        
        # Call tools
        result = await client.call("add", a=10, b=5)
        print(f"Result: {result}")

asyncio.run(main())
```

### Example 4: Custom Server with Multiple Tools

```python
class DataProcessor:
    """Process and transform data"""
    
    def clean(self, text: str) -> str:
        """Remove extra whitespace"""
        return " ".join(text.split())
    
    def uppercase(self, text: str) -> str:
        """Convert to uppercase"""
        return text.upper()
    
    def count_words(self, text: str) -> int:
        """Count words in text"""
        return len(text.split())
    
    def reverse(self, text: str) -> str:
        """Reverse text"""
        return text[::-1]

# Run server
# python -m mcp.server --name processor --target "data_processor:DataProcessor"
```

## 🛠️ Advanced Usage

### Using Utilities

```python
from mcp.utils import (
    retry,
    cache_result,
    measure_time,
    Registry,
    StateManager
)

# Retry decorator
@retry(max_attempts=3, delay=1.0)
def unstable_operation():
    # Will retry up to 3 times
    pass

# Cache results
@cache_result(ttl=300)
def expensive_computation(x):
    return x ** 2

# Measure execution time
@measure_time
def slow_function():
    import time
    time.sleep(1)

# Registry for managing modules
registry = Registry()
registry.register("calculator", Calculator())
registry.register("processor", DataProcessor())

# State management
state = StateManager(persist_path="state.json")
state.set("counter", 0)
state.update({"user": "alice", "session": "123"})
```

## 🏗️ Architecture

```
mcp/
├── mcp.py          # Base MCP class
├── server.py       # JSON-RPC server over stdio
├── client.py       # Client for calling server tools
├── demo.py         # Example implementation
└── utils.py        # Utility functions and helpers
```

## 🔧 Configuration

### Server Options

```bash
python -m mcp.server \
  --name my_server \
  --target "module.path:ClassName"
```

### Client Options

```bash
# List tools
python -m mcp.client list

# Call tool
python -m mcp.client call \
  --tool function_name \
  --args '{"param1": "value1"}' \
  --server-cmd '["python", "-m", "mcp.server", "--name", "demo"]'
```

## 📖 API Reference

### MCP Base Class

- `__init__(config, goal)` - Initialize module
- `register_tool(name, func, metadata)` - Register a callable tool
- `call(method, *args, **kwargs)` - Call a method
- `think(context)` - Process context and generate thoughts
- `act(action, params)` - Execute an action
- `list_tools()` - List all registered tools

### Client

- `MCPClient(server_cmd)` - Create client instance
- `initialize()` - Initialize connection
- `list_tools()` - Get available tools
- `call(name, **kwargs)` - Call a tool

### Server

- `MCPClassServer(name, target)` - Create server instance
- `run()` - Start server loop

## 🎨 Best Practices

1. **Keep it Simple**: Follow da Vinci's principle - simplicity is sophistication
2. **Type Hints**: Always use type hints for better schema generation
3. **Documentation**: Write clear docstrings for all public methods
4. **Error Handling**: Use try/except and provide meaningful error messages
5. **Async When Needed**: Use async for I/O-bound operations
6. **State Management**: Use StateManager for persistent state
7. **Tool Registration**: Register tools with descriptive metadata

## 🧪 Testing

```python
# Test the demo module
python -m mcp.demo

# Test MCP base
python -m mcp.mcp

# Run server and test with client
# Terminal 1:
python -m mcp.server --name demo

# Terminal 2:
python -m mcp.client list
python -m mcp.client call --tool add --args '{"a":5,"b":3}'
```

## 🤝 Contributing

Contributions welcome! Follow these principles:
- Keep code simple and readable
- Add tests for new features
- Update documentation
- Follow existing code style

## 📄 License

MIT License - Build freely, build beautifully.

## 🌟 Credits

Inspired by:
- Leonardo da Vinci's philosophy of simplicity
- The commune architecture
- Model Context Protocol (MCP)

---

**"Make it work, make it right, make it fast."** - Kent Beck
