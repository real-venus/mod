# Orbit Base

🚀 A modular agent framework for building intelligent automation systems.

## Overview

Orbit Base provides the foundational infrastructure for creating, deploying, and managing AI-powered agents that can execute tasks, interact with tools, and achieve complex goals.

## Features

- **Tool Integration** - Seamlessly integrate custom tools (file operations, shell commands, etc.)
- **Multi-Step Execution** - Agents can plan and execute multi-step workflows
- **Docker Support** - Containerized deployment for consistent environments
- **Extensible Architecture** - Easy to add new capabilities and tools

## Quick Start

### Prerequisites

- Python 3.8+
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd orbit/base

# Install dependencies
pip install -r requirements.txt
```

### Using Docker

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## Project Structure

```
orbit/base/
├── README.md           # This file
├── TUTORIAL.md         # Detailed tutorial
├── requirements.txt    # Python dependencies
├── Dockerfile          # Container definition
├── docker-compose.yml  # Multi-container orchestration
└── base/               # Core module
```

## Usage

```python
from base import Agent

# Initialize agent with tools
agent = Agent(tools=['create_file', 'cmd'])

# Execute a query
result = agent.run(query='your task here')
```

## Available Tools

| Tool | Description |
|------|-------------|
| `create_file` | Create files with specified content |
| `cmd` | Execute shell commands |

## Documentation

See [TUTORIAL.md](./TUTORIAL.md) for comprehensive guides and examples.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - See LICENSE for details.

---

*Built with ❤️ by the Orbit team*
