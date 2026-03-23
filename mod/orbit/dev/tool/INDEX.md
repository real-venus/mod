# Dev Tools Index

Quick navigation and reference for all dev tools.

## 📑 Table of Contents

1. [Tools by Category](#tools-by-category)
2. [Tools by Use Case](#tools-by-use-case)
3. [Quick Examples](#quick-examples)
4. [File Reference](#file-reference)

## Tools by Category

### 📁 File Operations
| Tool | Import | One-liner |
|------|--------|-----------|
| read | `m.mod('dev.tool.read')()` | Read files: `read.forward("file.txt")` |
| write | `m.mod('dev.tool.write')()` | Write files: `write.forward("file.txt", "content")` |
| edit | `m.mod('dev.tool.edit')()` | Edit files: `edit.forward("file.txt", "old", "new")` |

### 🔍 Search
| Tool | Import | One-liner |
|------|--------|-----------|
| grep | `m.mod('dev.tool.grep')()` | Search: `grep.forward("pattern", path=".")` |
| glob | `m.mod('dev.tool.glob')()` | Find files: `glob.forward("**/*.py")` |

### ⚙️ Execution
| Tool | Import | One-liner |
|------|--------|-----------|
| bash | `m.mod('dev.tool.bash')()` | Run command: `bash.forward("ls -la")` |
| execute | `m.mod('dev.tool.execute')()` | Run Python: `execute.forward("2 + 2")` |

### 🌐 Network
| Tool | Import | One-liner |
|------|--------|-----------|
| http | `m.mod('dev.tool.http')()` | HTTP: `http.forward("https://api.example.com")` |
| websearch | `m.mod('dev.tool.websearch')()` | Search: `websearch.forward("Python")` |

### 📊 Data
| Tool | Import | One-liner |
|------|--------|-----------|
| json | `m.mod('dev.tool.json')()` | Parse: `json.forward("parse", data='{"a":1}')` |

### 🤖 AI
| Tool | Import | One-liner |
|------|--------|-----------|
| ask | `m.mod('dev.tool.ask')()` | Ask AI: `ask.forward("What is Python?")` |
| task | `m.mod('dev.tool.task')()` | Run agent: `task.forward("Find bugs", "explore")` |

## Tools by Use Case

### 🔎 "I need to find..."

**Find files by name pattern:**
```python
glob = m.mod('dev.tool.glob')()
result = glob.forward("**/*.py")  # All Python files
```

**Find code/text in files:**
```python
grep = m.mod('dev.tool.grep')()
result = grep.forward("TODO", path=".", file_pattern="*.py")
```

**Find files modified recently:**
```python
glob = m.mod('dev.tool.glob')()
result = glob.forward("**/*", sort_by="mtime", max_results=10)
```

### 📝 "I need to read/write..."

**Read a file:**
```python
read = m.mod('dev.tool.read')()
result = read.forward("config.json")
```

**Read specific lines:**
```python
result = read.forward("large_file.txt", offset=100, limit=50)
```

**Write a new file:**
```python
write = m.mod('dev.tool.write')()
result = write.forward("output.txt", "Hello, World!")
```

**Edit existing file:**
```python
edit = m.mod('dev.tool.edit')()
result = edit.forward("app.py", "old_name", "new_name", replace_all=True)
```

### 🖥️ "I need to execute..."

**Run shell command:**
```python
bash = m.mod('dev.tool.bash')()
result = bash.forward("npm install", cwd="./project")
```

**Run Python code:**
```python
execute = m.mod('dev.tool.execute')()
result = execute.forward("""
import json
data = {"test": True}
json.dumps(data)
""")
```

### 🌍 "I need to fetch..."

**Make API call:**
```python
http = m.mod('dev.tool.http')()
result = http.forward(
    "https://api.github.com/users/octocat",
    headers={"Accept": "application/json"}
)
```

**Search the web:**
```python
websearch = m.mod('dev.tool.websearch')()
result = websearch.forward("Python async tutorial")
```

### 📊 "I need to work with JSON..."

**Parse JSON:**
```python
json_tool = m.mod('dev.tool.json')()
result = json_tool.forward("parse", data='{"key": "value"}')
```

**Validate JSON:**
```python
result = json_tool.forward("validate", data='{"valid": true}')
```

**Fix broken JSON:**
```python
result = json_tool.forward("fix", data="{'broken': json,}")
```

### 🤖 "I need AI help..."

**Ask a question:**
```python
ask = m.mod('dev.tool.ask')()
result = ask.forward("Explain Python decorators")
```

**Run complex task:**
```python
task = m.mod('dev.tool.task')()
result = task.forward(
    "Find all authentication code in this project",
    agent_type="explore"
)
```

## Quick Examples

### Example 1: Find and Read Files
```python
import mod as m

# Find Python files
glob = m.mod('dev.tool.glob')()
files = glob.forward("**/*.py", max_results=5)

# Read each file
read = m.mod('dev.tool.read')()
for file in files['matches']:
    content = read.forward(file['path'])
    print(f"{file['name']}: {content['lines']} lines")
```

### Example 2: Search and Replace
```python
import mod as m

# Find files with old function name
grep = m.mod('dev.tool.grep')()
matches = grep.forward("old_function", path=".", file_pattern="*.py")

# Replace in each file
edit = m.mod('dev.tool.edit')()
for match in matches['matches']:
    result = edit.forward(
        match['file'],
        "old_function",
        "new_function",
        replace_all=True
    )
    print(f"Updated {match['file']}: {result['replacements']} changes")
```

### Example 3: API to File
```python
import mod as m

# Fetch data from API
http = m.mod('dev.tool.http')()
response = http.forward("https://api.github.com/users/octocat")

# Parse and prettify JSON
json_tool = m.mod('dev.tool.json')()
pretty = json_tool.forward("stringify", obj=response['json'], indent=2)

# Save to file
write = m.mod('dev.tool.write')()
write.forward("user_data.json", pretty['result'])
```

### Example 4: Web Research
```python
import mod as m

# Search web
websearch = m.mod('dev.tool.websearch')()
results = websearch.forward("Python best practices", max_results=3)

# Ask AI about results
ask = m.mod('dev.tool.ask')()
summary = ask.forward(f"""
Summarize these search results:
{results['results']}
""")

print(summary['response'])
```

### Example 5: Code Analysis
```python
import mod as m

# Find all function definitions
grep = m.mod('dev.tool.grep')()
functions = grep.forward(
    pattern="^def .*\\(",
    path=".",
    file_pattern="*.py"
)

# Execute analysis
execute = m.mod('dev.tool.execute')()
result = execute.forward(f"""
total = {functions['total_matches']}
files = {functions['files_searched']}
avg = total / files if files > 0 else 0
print(f"Found {{total}} functions in {{files}} files")
print(f"Average: {{avg:.1f}} functions per file")
avg
""")
```

## File Reference

### Documentation
- **README.md** - Tool usage guide with detailed examples
- **TOOLS.md** - Complete API reference for all tools
- **MANIFEST.md** - Quick reference summary
- **INDEX.md** - This file

### Tool Implementations
- **mod.py** - Tool registry and discovery
- **ask/mod.py** - AI query tool (123 lines)
- **bash/mod.py** - Shell execution tool (134 lines)
- **edit/mod.py** - File editing tool (145 lines)
- **execute/mod.py** - Python execution tool (156 lines)
- **glob/mod.py** - File pattern tool (167 lines)
- **grep/mod.py** - Content search tool (178 lines)
- **http/mod.py** - HTTP request tool (145 lines)
- **json/mod.py** - JSON manipulation tool (234 lines)
- **read/mod.py** - File reading tool (189 lines)
- **task/mod.py** - Agent launcher tool (134 lines)
- **websearch/mod.py** - Web search tool (167 lines)
- **write/mod.py** - File writing tool (134 lines)

**Total:** ~2,100 lines of production-ready tool code

## Tool Registry Usage

List all tools:
```python
registry = m.mod('dev.tool')()
tools = registry.forward(action="list")
print(tools['tools'])
```

Get tool schema:
```python
schema = registry.forward(action="schema", tool="bash")
print(schema['schema']['parameters'])
```

Get help:
```python
help_info = registry.forward(action="help", tool="grep")
```

## Testing

Test individual tool:
```python
tool = m.mod('dev.tool.bash')()
result = tool.test()
```

Test all tools:
```bash
for tool_file in tool/*/mod.py; do
    python "$tool_file"
done
```

## Patterns

All tools follow these patterns:

**1. Import and create:**
```python
import mod as m
tool = m.mod('dev.tool.TOOLNAME')()
```

**2. Execute:**
```python
result = tool.forward(**params)
```

**3. Check result:**
```python
if result['success']:
    # Use result data
else:
    print(result['message'])
```

## Next Steps

1. **Learn basics**: Read [README.md](README.md)
2. **Explore API**: See [TOOLS.md](TOOLS.md)
3. **Try examples**: Run code from this index
4. **Create tools**: Follow patterns in existing tools
5. **Use with agents**: Integrate with `m.mod('agent')()`

## Support

- **Issues**: Report at GitHub repository
- **Questions**: Use the `ask` tool!
- **Examples**: See documentation files

---

Last Updated: 2026-03-22
Version: 1.0.0
