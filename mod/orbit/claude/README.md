# Claude Code Mod

A powerful Python interface for programmatically interacting with Claude Code, enabling automated code analysis, generation, debugging, and refactoring without manual prompts.

## Overview

The Claude Code Mod provides a clean, pythonic API to harness the power of Claude Code in your automated workflows, CI/CD pipelines, and development tools. Execute complex code operations programmatically with AI assistance.

## Features

- **Auto-Installation**: Automatically installs Claude CLI via Homebrew if not found
- **Auto-Authentication**: Automatically detects and uses API keys from environment or config files
- **Programmatic Access**: Execute Claude Code queries from Python without user prompts
- **Multiple Operations**: Analyze, generate, refactor, debug code, and run custom tasks
- **Flexible Configuration**: Control model selection, output format, and permissions
- **Batch Processing**: Process multiple queries efficiently
- **Type-Safe**: Full type hints for better IDE support and code clarity

## Installation

### Prerequisites

1. **Claude Code CLI** (Auto-installed if missing):
   - The module will automatically install Claude CLI via Homebrew if not found
   - Manual installation: `brew install anthropics/claude/claude`

2. **Python dependencies**:
```bash
pip install -r requirements.txt
```

3. **API Key** (Optional but recommended):
   - Set environment variable: `export ANTHROPIC_API_KEY=your_key_here`
   - Or create file: `~/.anthropic/api_key` with your key
   - Or pass directly to `Mod(api_key="your_key")`
   - The module will automatically detect and use the API key to avoid authentication prompts

### Verify Installation

Run the test suite:
```bash
python test_simple.py

# For live execution test
python test_simple.py --live

# Test auto-installation and API key detection
python3 test_auto_install.py
```

### Detailed Setup

For comprehensive setup instructions including API key configuration, troubleshooting, and security best practices, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

## Quick Start

### Basic Usage

```python
from claudecode.mod import Mod

# Initialize the interface (Claude CLI will be auto-installed if missing)
mod = Mod(default_path="/path/to/your/project")

# With explicit API key (optional)
mod = Mod(default_path="/path/to/your/project", api_key="your_api_key_here")

# Run a simple query
result = mod.forward(
    query="Analyze the main.py file and suggest improvements",
    model="sonnet"
)
print(result)
```

### Convenience Function

```python
from claudecode.mod import run_claude

# Quick one-liner
result = run_claude(
    "Fix the bug in main.py",
    path="/path/to/project"
)
```

## Core Methods

### 1. `forward()` - Execute Raw Queries

The main method for executing arbitrary Claude Code queries:

```python
result = mod.forward(
    query="Your prompt here",
    path="/path/to/project",
    model="sonnet",  # Options: sonnet, opus, haiku
    output_format="json",  # Options: json, text, stream-json
    bypass_permissions=True,
    additional_options={
        "verbose": True,
        "max-tokens": 4000
    }
)
```

### 2. `analyze_code()` - Code Analysis

Analyze code for quality, performance, security, or custom aspects:

```python
# General analysis
result = mod.analyze_code(path="/path/to/project")

# Focused analysis
result = mod.analyze_code(
    path="/path/to/project",
    focus="security"  # or "performance", "architecture", etc.
)
```

### 3. `generate_code()` - Code Generation

Generate new code based on descriptions:

```python
result = mod.generate_code(
    description="Create a FastAPI endpoint for user authentication",
    path="/path/to/project",
    file_path="app/api/auth.py"
)
```

### 4. `refactor()` - Code Refactoring

Refactor existing code with specific instructions:

```python
result = mod.refactor(
    path="/path/to/project",
    instructions="Extract repeated logic into utility functions",
    target_files=["src/utils.py", "src/helpers.py"]
)
```

### 5. `debug()` - Issue Debugging

Get AI assistance with debugging:

```python
result = mod.debug(
    path="/path/to/project",
    issue_description="Function returns None instead of user object",
    file_path="app/models/user.py"
)
```

### 6. `run_task()` - General Task Execution

Run any custom task with Claude Code:

```python
result = mod.run_task(
    task="Add comprehensive error handling to all API endpoints",
    path="/path/to/project",
    agent_type="general-purpose"
)
```

### 7. `batch_process()` - Batch Operations

Process multiple queries efficiently:

```python
queries = [
    "Check for security vulnerabilities",
    "Optimize database queries",
    "Add type hints to functions"
]

results = mod.batch_process(
    queries=queries,
    path="/path/to/project",
    model="sonnet"
)

for result in results:
    if result["success"]:
        print(f"✓ {result['query']}")
    else:
        print(f"✗ {result['query']}: {result['error']}")
```

## Use Cases

### 1. Automated Code Review

```python
from claudecode.mod import Mod

def review_pull_request(pr_path):
    mod = Mod(default_path=pr_path)

    # Check for issues
    security = mod.analyze_code(pr_path, focus="security")
    performance = mod.analyze_code(pr_path, focus="performance")
    style = mod.analyze_code(pr_path, focus="code style")

    return {
        "security": security,
        "performance": performance,
        "style": style
    }
```

### 2. CI/CD Integration

```python
def pre_commit_checks(repo_path):
    mod = Mod(default_path=repo_path)

    checks = [
        "Check for security vulnerabilities",
        "Verify all functions have docstrings",
        "Check for unused imports",
        "Ensure consistent code formatting"
    ]

    results = mod.batch_process(checks, repo_path, model="haiku")

    # Fail CI if critical issues found
    for result in results:
        if not result["success"]:
            raise Exception(f"Check failed: {result['query']}")
```

### 3. Automated Refactoring

```python
def modernize_codebase(project_path):
    mod = Mod(default_path=project_path)

    tasks = [
        "Convert all string formatting to f-strings",
        "Add type hints to all functions",
        "Replace old-style classes with modern syntax"
    ]

    for task in tasks:
        result = mod.refactor(project_path, task)
        print(f"Completed: {task}")
```

### 4. Documentation Generation

```python
def generate_docs(source_path):
    mod = Mod(default_path=source_path)

    result = mod.run_task(
        task="Generate comprehensive API documentation from the source code",
        path=source_path
    )

    return result
```

## Configuration

### Model Selection

Choose the appropriate model based on your needs:

- **haiku**: Fast, cost-effective for simple tasks
- **sonnet**: Balanced performance and capability (default)
- **opus**: Most capable for complex tasks

```python
# Fast analysis
result = mod.forward(query="Quick syntax check", model="haiku")

# Complex refactoring
result = mod.forward(query="Restructure architecture", model="opus")
```

### Output Formats

Control how results are returned:

- `json`: Structured data (default)
- `text`: Plain text response
- `stream-json`: Streaming JSON for real-time updates

### Permission Management

By default, permissions are bypassed for automation. Control this behavior:

```python
# Bypass permissions (default for automation)
result = mod.forward(query="...", bypass_permissions=True)

# Require permission prompts (interactive mode)
result = mod.forward(query="...", bypass_permissions=False)
```

## Docker Deployment

The module includes Docker support for containerized deployments:

### Build and Run

```bash
# Build the image
docker-compose build

# Start the service
docker-compose up -d

# Check logs
docker-compose logs -f base
```

### Docker Configuration

The `docker-compose.yml` configures:
- Container name: `base`
- Network: `modnet`
- Port: 50119
- Auto-restart: unless-stopped
- Volume mounts for code persistence

## API Reference

### Class: `Mod`

Main interface class for Claude Code operations.

#### Constructor

```python
Mod(default_path: Optional[str] = None, api_key: Optional[str] = None)
```

**Parameters:**
- `default_path`: Default working directory (defaults to current directory)
- `api_key`: Anthropic API key (optional, will auto-detect from environment/config if not provided)

#### Methods

See [Core Methods](#core-methods) section for detailed method documentation.

## Error Handling

The module provides clear error messages and exceptions:

```python
try:
    result = mod.forward(query="...", path="/invalid/path")
except RuntimeError as e:
    print(f"Claude Code error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Best Practices

1. **Use Specific Models**: Choose `haiku` for simple tasks, `opus` for complex ones
2. **Set Timeouts**: Operations timeout after 5 minutes by default
3. **Handle Errors**: Always wrap calls in try-except blocks for production use
4. **Batch When Possible**: Use `batch_process()` for multiple independent queries
5. **Specify Paths**: Always provide explicit paths rather than relying on defaults
6. **Focus Analyses**: Use the `focus` parameter for targeted code analysis

## Troubleshooting

### Claude CLI Not Found

The module will automatically attempt to install Claude CLI via Homebrew if it's not found. If auto-installation fails:

**Manual Installation:**
```bash
brew install anthropics/claude/claude
```

**If Homebrew is not installed:**
Visit https://brew.sh to install Homebrew first.

### Authentication Issues

If you encounter authentication prompts or errors, provide your API key:

**Method 1: Environment Variable**
```bash
export ANTHROPIC_API_KEY=your_key_here
```

**Method 2: Config File**
```bash
mkdir -p ~/.anthropic
echo "your_key_here" > ~/.anthropic/api_key
chmod 600 ~/.anthropic/api_key
```

**Method 3: Direct Parameter**
```python
mod = Mod(api_key="your_key_here")
```

### Permission Denied

**Error:** Permission errors when executing

**Solution:**
Ensure `bypass_permissions=True` or run with appropriate permissions.

### Timeout Errors

**Error:** Operation times out after 5 minutes

**Solution:**
Break down complex queries into smaller tasks or increase timeout:
```python
result = mod.forward(query="...", timeout=600)  # 10 minutes
```

## Development

### Project Structure

```
claudecode/
├── claudecode/
│   ├── __init__.py
│   └── mod.py           # Main module implementation
├── docker-compose.yml   # Docker configuration
├── Dockerfile          # Container definition
├── requirements.txt    # Python dependencies
├── test_simple.py      # Test suite
├── TUTORIAL.md        # Extended tutorial (legacy)
└── README.md          # This file
```

### Running Tests

```bash
# Basic functionality test
python test_simple.py

# Live execution test (requires API access)
python test_simple.py --live
```

## Contributing

This is a modular system designed for extensibility. To add new functionality:

1. Extend the `Mod` class with new methods
2. Follow the existing pattern for method signatures
3. Add comprehensive docstrings
4. Update tests and documentation

## License

Part of the Mod ecosystem.

## Related Documentation

- [TUTORIAL.md](TUTORIAL.md) - Legacy BaseMod tutorial
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)

---

*Built with precision for automated AI-powered development workflows.*
