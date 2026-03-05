# Claude Code Mod

<div align="center">

### 🤖 Automate your development workflow with AI-powered code operations

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/license-Mod-green.svg)](LICENSE)
[![Type Safe](https://img.shields.io/badge/type-safe-brightgreen.svg)](https://github.com/python/mypy)

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [API Docs](#api-reference) • [Examples](#real-world-use-cases)

</div>

---

A Python interface for programmatically interacting with **Claude Code**. Automate code analysis, generation, refactoring, and debugging without manual intervention.

```python
from claude import Mod

mod = Mod()
mod.analyze_code(focus="security")  # AI-powered security audit
mod.refactor(instructions="Extract helpers into utils.py")  # Automated refactoring
mod.debug(issue="NoneType error in user.py:42")  # Intelligent debugging
```

## Table of Contents

- [At a Glance](#at-a-glance)
- [Why Claude Code Mod?](#why-claude-code-mod)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Real-World Use Cases](#real-world-use-cases)
- [Configuration](#configuration)
- [Docker Deployment](#-docker-deployment)
- [Error Handling](#️-error-handling)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [Development](#️-development)

## At a Glance

```python
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your_key

from claude import Mod
mod = Mod()

# Security audit
mod.analyze_code(focus="security")

# Auto-refactor
mod.refactor("Extract helpers into utils/")

# Debug production errors
mod.debug("NoneType error on line 127")

# Batch CI checks
mod.batch_process([
    "Check for SQL injection",
    "Verify type hints",
    "Optimize imports"
])
```

## Why Claude Code Mod?

- **🔄 Automation-First** - Built for CI/CD pipelines, pre-commit hooks, and scheduled jobs
- **🎯 Zero-Config** - Auto-installs CLI, detects API keys, works out of the box
- **🚀 Production-Ready** - Type-safe API, robust error handling, comprehensive logging
- **⚡ Flexible** - From quick syntax checks to complex architectural refactoring
- **🔌 Extensible** - Integrate AI into any Python workflow or application

## Features

✅ **Auto-Installation** - Claude CLI installed via Homebrew if missing
✅ **Auto-Authentication** - API key detection from env vars, config files, or interactive prompt
✅ **Smart Operations** - Analyze, generate, refactor, debug with specialized methods
✅ **Model Selection** - Choose between Haiku (fast), Sonnet (balanced), or Opus (powerful)
✅ **Batch Processing** - Execute multiple operations efficiently
✅ **Type-Safe API** - Full type hints for excellent IDE support
✅ **Docker Support** - Containerized deployment ready
✅ **Comprehensive Logging** - Track operations with configurable log levels

## Installation

### Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# (Optional) Set your API key
export ANTHROPIC_API_KEY=your_key_here

# That's it! Claude CLI installs automatically on first use
```

The module handles everything else:
- ✅ Auto-installs Claude CLI via Homebrew
- ✅ Auto-detects API keys from environment or `~/.anthropic/api_key`
- ✅ Interactive prompt if API key not found

### API Key Configuration

**Option 1: Environment Variable** (Recommended for CI/CD)
```bash
export ANTHROPIC_API_KEY=your_key_here
```

**Option 2: Config File** (Recommended for local development)
```bash
mkdir -p ~/.anthropic
echo "your_key_here" > ~/.anthropic/api_key
chmod 600 ~/.anthropic/api_key
```

**Option 3: Code** (For dynamic keys)
```python
mod = Mod(api_key="your_key_here")
```

### Verify Installation

```bash
# Run tests
python tests/test_simple.py

# Live execution test (requires API key)
python tests/test_simple.py --live
```

📖 **Need more details?** See [SETUP_GUIDE.md](SETUP_GUIDE.md) for comprehensive setup instructions.

## Quick Start

### 30-Second Example

```python
from claude import Mod

# Initialize (auto-installs CLI, detects API key)
mod = Mod(default_path="/path/to/your/project")

# Analyze your codebase
result = mod.analyze_code(focus="security")
print(result)

# Generate new code
mod.generate_code(
    description="Create a FastAPI health check endpoint",
    file_path="api/health.py"
)

# Refactor existing code
mod.refactor(
    instructions="Extract database logic into repository pattern",
    target_files=["models.py", "views.py"]
)

# Debug issues
mod.debug(
    issue_description="User authentication fails with 500 error",
    file_path="auth/handlers.py"
)
```

### One-Liner for Quick Tasks

```python
from claude import run_claude

# Execute any task quickly
result = run_claude("Add type hints to all functions", path="/path/to/project")
```

## API Reference

### Core Methods

#### 🔍 `analyze_code()` - Code Analysis

Analyze code for quality, performance, security, or custom aspects.

```python
# General analysis
mod.analyze_code(path="/path/to/project")

# Focused analysis
mod.analyze_code(
    path="/path/to/project",
    focus="security"  # "performance", "architecture", "best practices"
)
```

**Use cases**: Security audits, performance reviews, code quality checks, architectural analysis

---

#### ✨ `generate_code()` - Code Generation

Generate new code from natural language descriptions.

```python
mod.generate_code(
    description="Create a FastAPI endpoint for user authentication with JWT",
    path="/path/to/project",
    file_path="app/api/auth.py"
)
```

**Use cases**: Boilerplate generation, API endpoints, database models, test files

---

#### 🔧 `refactor()` - Code Refactoring

Refactor existing code with AI assistance.

```python
mod.refactor(
    path="/path/to/project",
    instructions="Extract repeated validation logic into decorators",
    target_files=["api/handlers.py", "api/validators.py"]
)
```

**Use cases**: Code cleanup, pattern application, modernization, optimization

---

#### 🐛 `debug()` - Issue Debugging

Get intelligent debugging assistance.

```python
mod.debug(
    path="/path/to/project",
    issue_description="AuthenticationError: invalid signature on line 127",
    file_path="auth/jwt.py"
)
```

**Use cases**: Bug investigation, error analysis, stack trace interpretation

---

#### 🚀 `run_task()` - Custom Tasks

Execute any custom development task.

```python
mod.run_task(
    task="Add comprehensive docstrings to all public functions",
    path="/path/to/project",
    agent_type="general-purpose"  # "Bash", "Explore"
)
```

**Use cases**: Documentation, testing, migrations, custom workflows

---

#### 📦 `batch_process()` - Batch Operations

Process multiple operations efficiently.

```python
tasks = [
    "Check for SQL injection vulnerabilities",
    "Optimize N+1 query patterns",
    "Add rate limiting to API endpoints"
]

results = mod.batch_process(tasks, path="/path/to/project", model="haiku")

for r in results:
    print(f"{'✓' if r['success'] else '✗'} {r['query']}")
```

**Use cases**: CI/CD checks, comprehensive audits, bulk operations

---

#### ⚡ `forward()` - Raw Query Execution

Low-level method for custom Claude Code queries.

```python
mod.forward(
    query="Analyze API rate limiting and suggest improvements",
    path="/path/to/project",
    model="sonnet",  # "haiku", "opus"
    output_format="json",  # "text", "stream-json"
    bypass_permissions=True
)
```

**Use cases**: Advanced custom workflows, experimental operations

## Real-World Use Cases

### 🔐 Automated Security Audits

```python
from claude import Mod

def security_audit(repo_path):
    """Comprehensive security analysis for pull requests"""
    mod = Mod(default_path=repo_path)

    checks = [
        "Check for SQL injection vulnerabilities",
        "Identify hardcoded secrets or API keys",
        "Review authentication and authorization logic",
        "Check for XSS vulnerabilities in templates",
        "Analyze CORS and CSP configurations"
    ]

    results = mod.batch_process(checks, model="sonnet")

    # Generate security report
    critical_issues = [r for r in results if "critical" in r.get("output", "").lower()]
    return {
        "total_checks": len(results),
        "critical_issues": len(critical_issues),
        "details": results
    }
```

### 🔄 CI/CD Pre-Commit Hooks

```python
def pre_commit_validation(repo_path):
    """Run automated checks before commit"""
    mod = Mod(default_path=repo_path)

    # Fast checks with Haiku
    checks = [
        "Verify all functions have docstrings",
        "Check for unused imports",
        "Ensure type hints on public functions",
        "Check for TODO/FIXME comments"
    ]

    results = mod.batch_process(checks, model="haiku")

    # Fail commit if issues found
    failures = [r for r in results if not r.get("success")]
    if failures:
        print("❌ Pre-commit checks failed:")
        for f in failures:
            print(f"  - {f['query']}: {f.get('error')}")
        sys.exit(1)

    print("✅ All pre-commit checks passed")
```

### 📈 Automated Code Modernization

```python
def modernize_legacy_code(project_path):
    """Incrementally modernize legacy codebase"""
    mod = Mod(default_path=project_path)

    migrations = [
        ("Phase 1", "Convert string formatting to f-strings"),
        ("Phase 2", "Add type hints to all functions"),
        ("Phase 3", "Replace % formatting with f-strings"),
        ("Phase 4", "Migrate to context managers for file operations"),
        ("Phase 5", "Update to async/await where applicable")
    ]

    for phase, task in migrations:
        print(f"Starting {phase}: {task}")
        result = mod.refactor(instructions=task)

        if result.get("success"):
            print(f"✓ {phase} completed")
        else:
            print(f"✗ {phase} failed: {result.get('error')}")
            break
```

### 🧪 Test Generation Automation

```python
def generate_missing_tests(project_path):
    """Automatically generate unit tests for uncovered code"""
    mod = Mod(default_path=project_path)

    result = mod.run_task(
        task="""
        1. Identify all functions/classes without test coverage
        2. Generate comprehensive unit tests with pytest
        3. Include edge cases and error scenarios
        4. Add docstrings to test functions
        """,
        path=project_path
    )

    return result
```

### 📝 Documentation Automation

```python
def generate_api_docs(source_path):
    """Generate comprehensive API documentation"""
    mod = Mod(default_path=source_path)

    tasks = [
        mod.run_task("Generate OpenAPI/Swagger spec from FastAPI app"),
        mod.run_task("Create README with usage examples"),
        mod.run_task("Generate docstrings for all public APIs"),
        mod.run_task("Create architecture diagram in Mermaid")
    ]

    print("✓ Documentation generated successfully")
```

### 🚨 Production Error Analysis

```python
def analyze_production_error(error_log, codebase_path):
    """Intelligent analysis of production errors"""
    mod = Mod(default_path=codebase_path)

    result = mod.debug(
        issue_description=f"""
        Production error occurred:
        {error_log}

        Please:
        1. Identify the root cause
        2. Suggest fixes with code examples
        3. Recommend preventive measures
        4. Check for similar issues elsewhere
        """,
        file_path=extract_file_from_traceback(error_log)
    )

    return result
```

## Configuration

### 🎯 Model Selection

Choose the right model for your task:

| Model | Best For | Speed | Cost | Use When |
|-------|----------|-------|------|----------|
| **haiku** | Simple tasks, CI checks | ⚡⚡⚡ | $ | Syntax checks, linting, quick validations |
| **sonnet** | General development | ⚡⚡ | $$ | Code review, refactoring, most tasks (default) |
| **opus** | Complex architecture | ⚡ | $$$ | Major refactors, architectural design, complex bugs |

```python
# Fast CI checks
mod.batch_process(checks, model="haiku")

# Balanced code review
mod.analyze_code(focus="security", model="sonnet")

# Complex refactoring
mod.refactor("Migrate to microservices architecture", model="opus")
```

### 📊 Output Formats

```python
# Structured JSON (default, best for automation)
result = mod.forward(query="...", output_format="json")

# Plain text (best for human review)
result = mod.forward(query="...", output_format="text")

# Streaming (best for real-time feedback)
result = mod.forward(query="...", output_format="stream-json")
```

### 🔐 Permission Management

```python
# Automation mode (default, no prompts)
mod = Mod(bypass_permissions=True)

# Interactive mode (requires approval)
mod = Mod(bypass_permissions=False)
```

### 📝 Logging Configuration

```python
from claude import Mod

# Set log level
Mod.set_log_level("DEBUG")  # Show all logs
Mod.set_log_level("INFO")   # Default
Mod.set_log_level("WARNING")  # Only warnings/errors
Mod.set_log_level("ERROR")  # Only errors
```

## 🐳 Docker Deployment

Run Claude Code Mod in a containerized environment:

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f base

# Stop service
docker-compose down
```

**Container Configuration:**
- **Image**: Python 3.11 + Claude CLI
- **Network**: `modnet`
- **Port**: 50119
- **Restart**: Automatic
- **Volumes**: Persistent code storage

**Environment Variables:**
```yaml
# docker-compose.yml
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

## 📚 Complete API Reference

### `Mod` Class

Main interface for all Claude Code operations.

```python
from claude import Mod

mod = Mod(
    default_path: Optional[str] = None,  # Working directory (default: cwd)
    api_key: Optional[str] = None        # API key (default: auto-detect)
)
```

### Method Signatures

```python
# Analysis
mod.analyze_code(
    path: str = None,
    focus: str = None,
    model: str = "sonnet"
) -> dict

# Generation
mod.generate_code(
    description: str,
    path: str = None,
    file_path: str = None,
    model: str = "sonnet"
) -> dict

# Refactoring
mod.refactor(
    instructions: str,
    path: str = None,
    target_files: List[str] = None,
    model: str = "sonnet"
) -> dict

# Debugging
mod.debug(
    issue_description: str,
    path: str = None,
    file_path: str = None,
    model: str = "sonnet"
) -> dict

# Custom tasks
mod.run_task(
    task: str,
    path: str = None,
    agent_type: str = "general-purpose",
    model: str = "sonnet"
) -> dict

# Batch processing
mod.batch_process(
    queries: List[str],
    path: str = None,
    model: str = "sonnet"
) -> List[dict]

# Raw execution
mod.forward(
    query: str,
    path: str = None,
    model: str = "sonnet",
    output_format: str = "json",
    bypass_permissions: bool = True,
    additional_options: dict = None
) -> dict
```

## ⚠️ Error Handling

### Exception Handling

```python
from claude import Mod
import logging

try:
    mod = Mod(default_path="/path/to/project")
    result = mod.analyze_code(focus="security")

except FileNotFoundError:
    # Path doesn't exist
    print("Project path not found")

except PermissionError:
    # Insufficient permissions
    print("Permission denied - check file permissions")

except RuntimeError as e:
    # Claude Code execution error
    print(f"Claude Code error: {e}")
    logging.error(f"Full error: {e}")

except Exception as e:
    # Unexpected errors
    print(f"Unexpected error: {e}")
    logging.exception("Full traceback:")
```

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `Claude CLI not found` | Missing installation | Auto-installs on first run |
| `API key not configured` | Missing authentication | Set `ANTHROPIC_API_KEY` env var |
| `Permission denied` | File access issues | Check file permissions or use sudo |
| `Timeout after 300s` | Long-running operation | Increase timeout or split task |
| `Invalid model` | Wrong model name | Use "haiku", "sonnet", or "opus" |

## 💡 Best Practices

### Performance Optimization

```python
# ✅ Good: Use Haiku for simple checks
mod.batch_process(simple_checks, model="haiku")

# ❌ Avoid: Using Opus for simple tasks
mod.batch_process(simple_checks, model="opus")  # Slower and more expensive
```

### Batch Processing

```python
# ✅ Good: Batch independent operations
tasks = ["Check security", "Add docstrings", "Optimize imports"]
results = mod.batch_process(tasks)

# ❌ Avoid: Sequential individual calls
for task in tasks:
    mod.run_task(task)  # Slower than batching
```

### Error Handling

```python
# ✅ Good: Always handle errors
try:
    result = mod.analyze_code()
except RuntimeError as e:
    logger.error(f"Analysis failed: {e}")
    send_alert_to_team()

# ❌ Avoid: Uncaught exceptions in production
result = mod.analyze_code()  # Could crash your app
```

### Model Selection Strategy

```python
# ✅ Good: Match model to task complexity
mod.run_task("Add type hints", model="haiku")        # Simple
mod.refactor("Extract services", model="sonnet")     # Medium
mod.refactor("Redesign architecture", model="opus")  # Complex

# ❌ Avoid: One-size-fits-all approach
mod.run_task("Add type hints", model="opus")  # Overkill
```

### Focused Analysis

```python
# ✅ Good: Use specific focus for targeted analysis
mod.analyze_code(focus="security")
mod.analyze_code(focus="performance")

# ❌ Avoid: Generic analysis for specific needs
mod.analyze_code()  # Might miss specific security issues
```

### Path Management

```python
# ✅ Good: Explicit paths
mod = Mod(default_path="/absolute/path/to/project")
mod.analyze_code(path="/absolute/path/to/module")

# ❌ Avoid: Relying on current directory
mod = Mod()  # Might not be the project you expect
```

## 🔧 Troubleshooting

### Installation Issues

<details>
<summary><b>Claude CLI not found</b></summary>

Auto-installation should handle this. If it fails:

```bash
# Install manually
brew install anthropics/claude/claude

# Verify installation
claude --version
```

If Homebrew is missing, install it first: https://brew.sh
</details>

<details>
<summary><b>Homebrew permission errors</b></summary>

```bash
# Fix Homebrew permissions
sudo chown -R $(whoami) /usr/local/Homebrew
```
</details>

### Authentication Issues

<details>
<summary><b>API key not found</b></summary>

Set your API key using any method:

```bash
# Option 1: Environment variable
export ANTHROPIC_API_KEY=your_key_here

# Option 2: Config file
mkdir -p ~/.anthropic
echo "your_key_here" > ~/.anthropic/api_key
chmod 600 ~/.anthropic/api_key

# Option 3: In code
mod = Mod(api_key="your_key_here")
```
</details>

<details>
<summary><b>Invalid API key error</b></summary>

1. Verify your key at https://console.anthropic.com/
2. Check for extra spaces or newlines
3. Ensure key has `ANTHROPIC_API_KEY` format
</details>

### Runtime Issues

<details>
<summary><b>Operation timeout (300s)</b></summary>

Break down into smaller tasks or increase timeout:

```python
# Increase timeout
result = mod.forward(query="...", timeout=600)

# Or split into smaller tasks
mod.refactor("Phase 1: Extract helpers")
mod.refactor("Phase 2: Extract validators")
```
</details>

<details>
<summary><b>Permission denied errors</b></summary>

```bash
# Check file permissions
ls -la /path/to/project

# Fix permissions if needed
chmod -R u+rw /path/to/project

# Or run with elevated permissions
sudo python your_script.py
```
</details>

<details>
<summary><b>Import errors</b></summary>

```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Verify Python version (requires 3.11+)
python --version
```
</details>

### Getting Help

Still stuck? Here's how to get help:

1. **Check logs**: Enable debug logging with `Mod.set_log_level("DEBUG")`
2. **Run tests**: `python tests/test_simple.py` to verify setup
3. **Review setup guide**: See [SETUP_GUIDE.md](SETUP_GUIDE.md)
4. **Check Claude Code docs**: https://docs.anthropic.com/claude-code

## 🛠️ Development

### Project Structure

```
claude/
├── claude/
│   ├── __init__.py         # Package initialization
│   └── claude.py          # Main implementation
├── tests/
│   └── test_simple.py     # Test suite
├── docker-compose.yml     # Container orchestration
├── Dockerfile            # Container image
├── requirements.txt      # Python dependencies
├── package.json         # Node metadata
├── SETUP_GUIDE.md      # Detailed setup instructions
└── README.md          # This file
```

### Running Tests

```bash
# Basic tests (mocked)
python tests/test_simple.py

# Live tests (requires API key)
python tests/test_simple.py --live

# Test auto-installation
python tests/test_auto_install.py
```

### Contributing

This module is part of the **Mod framework** ecosystem. Contributions welcome!

**To contribute:**
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Follow existing code style (type hints, docstrings)
5. Submit a pull request

**Code style:**
- Type hints on all functions
- Docstrings with examples
- Error handling with meaningful messages
- Logging for debugging

## 🔗 Related Resources

- 📖 [SETUP_GUIDE.md](SETUP_GUIDE.md) - Comprehensive setup guide
- 🌐 [Claude Code Docs](https://docs.anthropic.com/claude-code) - Official documentation
- 🏗️ [Mod Framework](https://github.com/your-org/mod) - Parent framework

## 📄 License

Part of the Mod ecosystem.

---

<div align="center">

**Built for developers who automate**

⚡ Fast • 🎯 Focused • 🔧 Flexible

[Get Started](#installation) • [Examples](#real-world-use-cases) • [API Reference](#-complete-api-reference)

</div>
