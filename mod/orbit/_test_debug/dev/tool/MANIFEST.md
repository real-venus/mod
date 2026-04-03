# Dev Tools Manifest

Complete listing of all tools in the dev module toolkit.

## Installation

Tools are automatically available when the dev module is installed:

```bash
pip install mod
```

## Tools Summary (12 Tools)

| # | Tool | Type | Description |
|---|------|------|-------------|
| 1 | **ask** | AI | Query AI models with conversation history |
| 2 | **bash** | Execution | Execute shell commands with timeout control |
| 3 | **edit** | File | Edit files by replacing text with backup |
| 4 | **execute** | Execution | Run Python code with state persistence |
| 5 | **glob** | Search | Find files using glob patterns |
| 6 | **grep** | Search | Search for regex patterns in files |
| 7 | **http** | Network | Make HTTP requests (GET, POST, etc.) |
| 8 | **json** | Data | Parse, validate, manipulate JSON |
| 9 | **read** | File | Read files with line range support |
| 10 | **task** | AI | Launch specialized agents for tasks |
| 11 | **websearch** | Network | Search the web via DuckDuckGo |
| 12 | **write** | File | Write content to files with backup |

## Quick Reference

### File Operations
```python
import mod as m

# Read file
read = m.mod('dev.tool.read')()
result = read.forward("file.txt", offset=0, limit=100)

# Write file
write = m.mod('dev.tool.write')()
result = write.forward("file.txt", "content", backup=True)

# Edit file
edit = m.mod('dev.tool.edit')()
result = edit.forward("file.txt", "old", "new", replace_all=True)
```

### Search Operations
```python
# Find files
glob = m.mod('dev.tool.glob')()
result = glob.forward("**/*.py", sort_by="mtime")

# Search content
grep = m.mod('dev.tool.grep')()
result = grep.forward("pattern", path=".", file_pattern="*.py", context=2)
```

### Execution
```python
# Run bash command
bash = m.mod('dev.tool.bash')()
result = bash.forward("ls -la", cwd="/tmp", timeout=10)

# Execute Python
execute = m.mod('dev.tool.execute')()
result = execute.forward("x = 10; x * 2")
```

### Network
```python
# HTTP request
http = m.mod('dev.tool.http')()
result = http.forward("https://api.github.com", method="GET")

# Web search
websearch = m.mod('dev.tool.websearch')()
result = websearch.forward("Python programming", max_results=5)
```

### Data
```python
# JSON operations
json_tool = m.mod('dev.tool.json')()
result = json_tool.forward("parse", data='{"key": "value"}')
result = json_tool.forward("stringify", obj={"key": "value"})
result = json_tool.forward("validate", data='{"valid": true}')
```

### AI
```python
# Ask AI
ask = m.mod('dev.tool.ask')()
result = ask.forward("What is Python?")

# Launch agent task
task = m.mod('dev.tool.task')()
result = task.forward("Find auth code", agent_type="explore")
```

## Tool Registry

The tool registry provides discovery and introspection:

```python
registry = m.mod('dev.tool')()

# List all tools
tools = registry.forward(action="list")
print(tools['tools'])
# ['ask', 'bash', 'edit', 'execute', 'glob', 'grep', 'http', 'json', 'read', 'task', 'websearch', 'write']

# Get tool schema
schema = registry.forward(action="schema", tool="bash")
print(schema['schema']['parameters'])

# Get help
help_info = registry.forward(action="help", tool="grep")
```

## Response Format

All tools follow the same response pattern:

```python
{
    "success": bool,         # Always present - indicates if operation succeeded
    "message": str,          # Always present - human-readable status
    # ... tool-specific fields
}
```

**Example:**
```python
{
    "success": True,
    "message": "Command executed successfully",
    "stdout": "file1.txt\nfile2.txt\n",
    "stderr": "",
    "returncode": 0,
    "cwd": "/tmp"
}
```

## Tool Categories

### 📁 File Tools (3)
- **read**: Read files with encoding support
- **write**: Write files with backup
- **edit**: Edit files with replacement

### 🔍 Search Tools (2)
- **grep**: Regex pattern search in files
- **glob**: File pattern matching

### ⚙️ Execution Tools (2)
- **bash**: Shell command execution
- **execute**: Python code execution

### 🌐 Network Tools (2)
- **http**: HTTP requests
- **websearch**: Web search

### 📊 Data Tools (1)
- **json**: JSON manipulation

### 🤖 AI Tools (2)
- **ask**: AI model queries
- **task**: Agent task launcher

## Usage in Agents

Tools are designed to work with the agent framework:

```python
import mod as m

# Create agent with tools
agent = m.mod('agent')()

# Agent uses tools automatically
result = agent.forward(
    query="Find all Python files and count functions",
    tools=['glob', 'grep', 'bash']
)
```

The agent framework will:
1. Generate tool schemas
2. Include schemas in agent prompts
3. Parse tool calls from agent output
4. Execute tools and return results
5. Continue agent loop with results

## Testing

Every tool includes tests:

```bash
# Test all tools
for tool in tool/*/mod.py; do
    echo "Testing $(dirname $tool)..."
    python $tool
done

# Test single tool
python tool/bash/mod.py
```

Or from Python:

```python
import mod as m

# Test a tool
bash = m.mod('dev.tool.bash')()
result = bash.test()
print(result['message'])  # "Bash tool tests passed"
```

## Documentation

- **README.md**: Tool usage guide with examples
- **TOOLS.md**: Complete API reference
- **MANIFEST.md**: This file - quick reference

## Architecture

```
dev/
├── dev.py              # Main dev module
├── README.md           # Module documentation
├── TOOLS.md           # Complete tool reference
└── tool/              # Tool collection
    ├── mod.py         # Tool registry
    ├── README.md      # Tool guide
    ├── MANIFEST.md    # This file
    ├── ask/
    │   └── mod.py
    ├── bash/
    │   └── mod.py
    ├── edit/
    │   └── mod.py
    ├── execute/
    │   └── mod.py
    ├── glob/
    │   └── mod.py
    ├── grep/
    │   └── mod.py
    ├── http/
    │   └── mod.py
    ├── json/
    │   └── mod.py
    ├── read/
    │   └── mod.py
    ├── task/
    │   └── mod.py
    ├── websearch/
    │   └── mod.py
    └── write/
        └── mod.py
```

## Pattern Compliance

All tools follow the mod framework patterns:

✅ Anchor file: `mod.py` in tool directory
✅ Class name: `Tool`
✅ Main method: `forward(**kwargs) -> Dict[str, Any]`
✅ Test method: `test() -> Dict[str, Any]`
✅ Description: Class attribute with docstring
✅ Return format: `{success: bool, message: str, ...}`

## Version

Tools Version: 1.0.0
Compatible with: mod framework v1.0+
Last Updated: 2026-03-22

## License

MIT License

---

For detailed documentation, see [TOOLS.md](TOOLS.md)
For usage examples, see [README.md](README.md)
