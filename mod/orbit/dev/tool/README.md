# Dev Tools 🛠️

Comprehensive toolkit for AI-powered development agents.

## Available Tools

### Core Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| **bash** | Execute shell commands | Timeout, working dir, env vars |
| **read** | Read files | Line ranges, encodings, binary detection |
| **write** | Write files | Backup, directory creation |
| **edit** | Edit files | String replacement, backup |

### Search Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| **grep** | Search file contents | Regex, context lines, file filtering |
| **glob** | Find files by pattern | Recursive search, sorting |

### Data Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| **json** | JSON manipulation | Parse, validate, extract, fix |
| **http** | Make HTTP requests | All methods, auth, JSON support |

### AI Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| **ask** | Query AI models | Conversation history, multiple models |
| **task** | Launch specialized agents | Explore, Plan, Bash, General |
| **websearch** | Search the web | DuckDuckGo integration |

### Execution Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| **execute** | Run Python code | State persistence, output capture |

## Usage

### Using Tools in Agents

```python
import mod as m

# Load a tool
bash = m.mod('dev.tool.bash')()

# Execute tool
result = bash.forward("ls -la")
print(result['stdout'])
```

### Tool Pattern

All tools follow this pattern:

```python
class Tool:
    description = """Tool description"""

    def forward(self, **kwargs) -> Dict[str, Any]:
        """
        Main execution method.

        Returns:
            {
                "success": bool,
                "message": str,
                # ... tool-specific fields
            }
        """
        pass
```

### Schema Generation

```python
# Get tool registry
registry = m.mod('dev.tool')()

# List all tools
tools = registry.forward(action="list")
print(tools['tools'])

# Get tool schema
schema = registry.forward(action="schema", tool="bash")
print(schema['schema'])
```

## Tool Examples

### Bash Tool

```python
bash = m.mod('dev.tool.bash')()

# Simple command
result = bash.forward("echo 'Hello'")
print(result['stdout'])  # "Hello\n"

# With working directory
result = bash.forward("ls", cwd="/tmp")

# With environment variables
result = bash.forward("echo $MY_VAR", env={"MY_VAR": "test"})
```

### Read Tool

```python
read = m.mod('dev.tool.read')()

# Read entire file
result = read.forward("README.md")
print(result['content'])

# Read specific lines
result = read.forward("README.md", offset=10, limit=20)
print(f"Lines: {result['lines']}")

# Different encoding
result = read.forward("file.txt", encoding="latin-1")
```

### Grep Tool

```python
grep = m.mod('dev.tool.grep')()

# Search for pattern
result = grep.forward(
    pattern="def .*\\(",
    path=".",
    file_pattern="*.py",
    context=2
)

for match in result['matches']:
    print(f"{match['file']}:{match['line_number']}: {match['line']}")
```

### HTTP Tool

```python
http = m.mod('dev.tool.http')()

# GET request
result = http.forward("https://api.github.com/users/octocat")
print(result['json'])

# POST with JSON
result = http.forward(
    "https://api.example.com/data",
    method="POST",
    json={"key": "value"},
    headers={"Authorization": "Bearer token"}
)
```

### Ask Tool

```python
ask = m.mod('dev.tool.ask')()

# Ask a question
result = ask.forward("What is Python?")
print(result['response'])

# With conversation history
result = ask.forward("Tell me more", include_history=True)

# Clear history
ask.clear_history()
```

### Execute Tool

```python
execute = m.mod('dev.tool.execute')()

# Execute code
result = execute.forward("""
x = 10
y = 20
print(f"Sum: {x + y}")
x + y
""")
print(result['stdout'])  # "Sum: 30\n"
print(result['result'])  # 30

# Eval expression
result = execute.forward("2 ** 10", mode="eval")
print(result['result'])  # 1024
```

### WebSearch Tool

```python
websearch = m.mod('dev.tool.websearch')()

# Search
result = websearch.forward("Python programming")

for item in result['results']:
    print(f"{item['title']}: {item['url']}")
```

## Creating New Tools

To create a new tool:

1. Create directory: `tool/mytool/`
2. Create `mod.py` with `Tool` class
3. Implement `forward()` method
4. Optionally add `test()` method

Example:

```python
# tool/mytool/mod.py

class Tool:
    description = """My custom tool"""

    def forward(self, param: str, **kwargs) -> Dict[str, Any]:
        """Execute tool"""
        try:
            # Implementation
            result = do_something(param)

            return {
                "success": True,
                "message": "Operation completed",
                "result": result
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error: {str(e)}"
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the tool"""
        result = self.forward("test")
        assert result["success"], "Should succeed"
        return {
            "success": True,
            "message": "Tests passed"
        }
```

## Testing Tools

All tools include a `test()` method:

```python
tool = m.mod('dev.tool.bash')()
result = tool.test()
print(result['message'])
```

Or run from command line:

```bash
python tool/bash/mod.py
```

## Integration with Agents

Tools are designed to work seamlessly with the agent framework:

```python
import mod as m

# Create agent with tools
agent = m.mod('agent')()

# Agent can use tools via their forward() method
result = agent.forward(
    query="List all Python files in the current directory",
    tools=['bash', 'glob', 'grep']
)
```

## License

MIT License
