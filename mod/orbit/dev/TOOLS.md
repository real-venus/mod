# Dev Module Tools Documentation

This document provides a complete reference for all tools available in the dev module.

## Overview

The dev module includes a comprehensive toolkit that follows the mod framework patterns. All tools are located in `dev/tool/{tool_name}/mod.py` and implement a consistent interface.

## Tool Structure

```
dev/tool/
├── mod.py                 # Tool registry
├── README.md              # Tool documentation
├── ask/                   # AI query tool
│   └── mod.py
├── bash/                  # Shell command execution
│   └── mod.py
├── edit/                  # File editing
│   └── mod.py
├── execute/               # Python code execution
│   └── mod.py
├── glob/                  # File pattern matching
│   └── mod.py
├── grep/                  # Content search
│   └── mod.py
├── http/                  # HTTP requests
│   └── mod.py
├── json/                  # JSON manipulation
│   └── mod.py
├── read/                  # File reading
│   └── mod.py
├── task/                  # Agent launcher
│   └── mod.py
├── websearch/             # Web search
│   └── mod.py
└── write/                 # File writing
    └── mod.py
```

## Quick Start

```python
import mod as m

# List all available tools
registry = m.mod('dev.tool')()
tools = registry.forward(action="list")
print(tools['tools'])

# Use a tool
bash = m.mod('dev.tool.bash')()
result = bash.forward("ls -la")
print(result['stdout'])
```

## Tool Categories

### 1. File Operations

#### Read Tool (`dev.tool.read`)
Read files with support for line ranges, encodings, and binary detection.

```python
read = m.mod('dev.tool.read')()
result = read.forward("README.md", offset=0, limit=50)
```

**Parameters:**
- `file_path` (str): Path to file
- `offset` (int, optional): Starting line number
- `limit` (int, optional): Number of lines to read
- `encoding` (str, optional): File encoding
- `show_line_numbers` (bool): Show line numbers

**Returns:**
- `success` (bool): Operation status
- `content` (str): File contents
- `lines` (int): Number of lines read
- `total_lines` (int): Total lines in file
- `size` (int): File size in bytes

#### Write Tool (`dev.tool.write`)
Write content to files with backup support.

```python
write = m.mod('dev.tool.write')()
result = write.forward("test.txt", "Hello, World!", backup=True)
```

**Parameters:**
- `file_path` (str): Path to file
- `content` (str): Content to write
- `encoding` (str, optional): File encoding
- `create_dirs` (bool): Create parent directories
- `backup` (bool): Create backup before overwriting

**Returns:**
- `success` (bool): Operation status
- `bytes_written` (int): Bytes written
- `lines_written` (int): Lines written
- `backup_path` (str, optional): Backup file path

#### Edit Tool (`dev.tool.edit`)
Edit files by replacing text with backup.

```python
edit = m.mod('dev.tool.edit')()
result = edit.forward("file.py", "old_text", "new_text", replace_all=True)
```

**Parameters:**
- `file_path` (str): Path to file
- `old_string` (str): Text to replace
- `new_string` (str): Replacement text
- `replace_all` (bool): Replace all occurrences
- `backup` (bool): Create backup

**Returns:**
- `success` (bool): Operation status
- `replacements` (int): Number of replacements made
- `backup_path` (str, optional): Backup file path

### 2. Search Tools

#### Grep Tool (`dev.tool.grep`)
Search for regex patterns in files.

```python
grep = m.mod('dev.tool.grep')()
result = grep.forward(
    pattern="def .*\\(",
    path=".",
    file_pattern="*.py",
    context=2
)
```

**Parameters:**
- `pattern` (str): Regex pattern
- `path` (str): Directory or file to search
- `recursive` (bool): Search recursively
- `ignore_case` (bool): Case-insensitive search
- `file_pattern` (str, optional): File glob filter
- `context` (int): Context lines to show
- `max_results` (int): Maximum matches

**Returns:**
- `success` (bool): Operation status
- `matches` (list): List of match objects
- `files_searched` (int): Number of files searched
- `total_matches` (int): Total matches found

#### Glob Tool (`dev.tool.glob`)
Find files using glob patterns.

```python
glob = m.mod('dev.tool.glob')()
result = glob.forward("**/*.py", path=".", sort_by="mtime")
```

**Parameters:**
- `pattern` (str): Glob pattern (e.g., "*.py", "**/*.js")
- `path` (str): Base directory
- `recursive` (bool): Enable recursive search
- `files_only` (bool): Only return files
- `dirs_only` (bool): Only return directories
- `sort_by` (str): Sort by "name", "size", or "mtime"
- `max_results` (int): Maximum results

**Returns:**
- `success` (bool): Operation status
- `matches` (list): List of matched files with metadata
- `total` (int): Total matches found

### 3. Execution Tools

#### Bash Tool (`dev.tool.bash`)
Execute shell commands with timeout and environment control.

```python
bash = m.mod('dev.tool.bash')()
result = bash.forward("ls -la", cwd="/tmp", timeout=10)
```

**Parameters:**
- `command` (str): Command to execute
- `cwd` (str, optional): Working directory
- `timeout` (int, optional): Timeout in seconds
- `env` (dict, optional): Environment variables
- `shell` (bool): Execute through shell

**Returns:**
- `success` (bool): Operation status (returncode == 0)
- `stdout` (str): Standard output
- `stderr` (str): Standard error
- `returncode` (int): Exit code
- `cwd` (str): Working directory used

#### Execute Tool (`dev.tool.execute`)
Run Python code with state persistence.

```python
execute = m.mod('dev.tool.execute')()
result = execute.forward("x = 10; print(x); x * 2")
```

**Parameters:**
- `code` (str): Python code to execute
- `mode` (str): "exec" or "eval"
- `reset_state` (bool): Reset variable state
- `return_value` (bool): Capture return value

**Returns:**
- `success` (bool): Operation status
- `stdout` (str): Captured output
- `stderr` (str): Error output
- `result` (any): Return value (if available)
- `error` (str, optional): Error traceback

### 4. Network Tools

#### HTTP Tool (`dev.tool.http`)
Make HTTP requests with full method support.

```python
http = m.mod('dev.tool.http')()
result = http.forward(
    "https://api.github.com/users/octocat",
    method="GET",
    headers={"Accept": "application/json"}
)
```

**Parameters:**
- `url` (str): Request URL
- `method` (str): HTTP method (GET, POST, PUT, DELETE, etc.)
- `headers` (dict, optional): Request headers
- `params` (dict, optional): URL parameters
- `data` (dict, optional): Form data
- `json` (dict, optional): JSON body
- `timeout` (int, optional): Request timeout
- `auth` (tuple, optional): (username, password)

**Returns:**
- `success` (bool): Operation status (response.ok)
- `status_code` (int): HTTP status code
- `headers` (dict): Response headers
- `body` (str): Response body
- `json` (dict, optional): Parsed JSON response

#### WebSearch Tool (`dev.tool.websearch`)
Search the web using DuckDuckGo.

```python
websearch = m.mod('dev.tool.websearch')()
result = websearch.forward("Python programming", max_results=5)
```

**Parameters:**
- `query` (str): Search query
- `max_results` (int, optional): Maximum results to return

**Returns:**
- `success` (bool): Operation status
- `query` (str): Search query used
- `results` (list): List of search results with title, snippet, url

### 5. Data Tools

#### JSON Tool (`dev.tool.json`)
Parse, validate, and manipulate JSON.

```python
json_tool = m.mod('dev.tool.json')()

# Parse JSON
result = json_tool.forward("parse", data='{"key": "value"}')

# Stringify object
result = json_tool.forward("stringify", obj={"key": "value"}, indent=2)

# Validate JSON
result = json_tool.forward("validate", data='{"valid": true}')

# Extract value by path
result = json_tool.forward("extract", data='{"user": {"name": "John"}}', path="user.name")

# Fix malformed JSON
result = json_tool.forward("fix", data="{'bad': json,}")
```

**Actions:**
- `parse`: Parse JSON string to object
- `stringify`: Convert object to JSON
- `validate`: Check JSON validity
- `extract`: Extract value by JSON path
- `fix`: Attempt to fix malformed JSON

### 6. AI Tools

#### Ask Tool (`dev.tool.ask`)
Query AI models with conversation history.

```python
ask = m.mod('dev.tool.ask')()

# Simple question
result = ask.forward("What is Python?")
print(result['response'])

# With conversation history
result = ask.forward("Tell me more", include_history=True)

# Custom model
result = ask.forward("Explain async", model="anthropic/claude-3-opus")

# Clear history
ask.clear_history()
```

**Parameters:**
- `query` (str): Question or prompt
- `model` (str, optional): Model identifier
- `temperature` (float): Sampling temperature (0-1)
- `max_tokens` (int): Maximum response tokens
- `system` (str, optional): System prompt
- `include_history` (bool): Include conversation history

**Returns:**
- `success` (bool): Operation status
- `query` (str): Original query
- `response` (str): AI response
- `model` (str): Model used

#### Task Tool (`dev.tool.task`)
Launch specialized agents for complex tasks.

```python
task = m.mod('dev.tool.task')()

# Launch exploration agent
result = task.forward(
    "Find all Python files with authentication code",
    agent_type="explore",
    model="sonnet"
)

# Launch planning agent
result = task.forward(
    "Plan implementation of user registration",
    agent_type="plan"
)
```

**Parameters:**
- `prompt` (str): Task description
- `agent_type` (str): "general", "explore", "plan", "bash"
- `description` (str, optional): Short description
- `model` (str): "sonnet", "opus", "haiku"
- `max_turns` (int): Maximum agent turns
- `run_in_background` (bool): Run in background

**Returns:**
- `success` (bool): Operation status
- `agent_type` (str): Agent type used
- `prompt` (str): Original prompt
- `result` (str): Agent output
- `task_id` (str, optional): Background task ID

## Tool Registry

The tool registry (`dev.tool.mod`) provides centralized tool discovery and schema generation.

```python
registry = m.mod('dev.tool')()

# List all tools
tools = registry.forward(action="list")
# Returns: {"success": True, "tools": ["ask", "bash", "edit", ...]}

# Get tool schema
schema = registry.forward(action="schema", tool="bash")
# Returns schema with parameters and types

# Get help
help_info = registry.forward(action="help", tool="grep")
```

## Common Patterns

### Error Handling

All tools return a consistent response format:

```python
{
    "success": bool,      # True if operation succeeded
    "message": str,       # Human-readable status message
    # ... tool-specific fields
}
```

Always check `success` before using results:

```python
result = tool.forward(...)
if result["success"]:
    # Use result
    print(result["data"])
else:
    # Handle error
    print(f"Error: {result['message']}")
```

### Chaining Tools

Tools are designed to be chainable:

```python
# Find Python files
glob = m.mod('dev.tool.glob')()
files = glob.forward("**/*.py")

# Search each file
grep = m.mod('dev.tool.grep')()
for file_info in files['matches']:
    matches = grep.forward("def ", path=file_info['path'])
    if matches['total_matches'] > 0:
        print(f"Found functions in {file_info['name']}")
```

### Using with Agents

Tools integrate seamlessly with the agent framework:

```python
import mod as m

# Create agent
agent = m.mod('agent')()

# Agent can discover and use tools dynamically
result = agent.forward(
    query="Find all TODO comments in Python files",
    tools=['glob', 'grep']  # Make these tools available
)
```

## Testing

All tools include a `test()` method for validation:

```python
# Test a tool
tool = m.mod('dev.tool.bash')()
result = tool.test()
print(result['message'])
```

Run tests from command line:

```bash
cd tool/bash
python mod.py  # Runs test() method
```

## Performance Tips

1. **Use specific paths**: Avoid searching entire filesystem
2. **Limit results**: Use `max_results` parameter to cap output
3. **Cache tool instances**: Reuse tool objects instead of recreating
4. **Background execution**: Use `run_in_background` for long tasks
5. **File filtering**: Use `file_pattern` in grep to reduce search scope

## Security Considerations

1. **Bash tool**: Commands run with user privileges - sanitize input
2. **Execute tool**: Python code runs in same process - validate code
3. **HTTP tool**: Validate URLs and handle credentials securely
4. **File tools**: Check paths to prevent directory traversal

## Contributing New Tools

See the [README.md](README.md) for instructions on creating new tools.

Each tool should:
1. Implement `Tool` class with `forward()` method
2. Return consistent `{success, message, ...}` format
3. Include `description` class attribute
4. Provide `test()` method
5. Handle errors gracefully

## License

MIT License
