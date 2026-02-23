# 🚀 Orbit Base

> A powerful, modular foundation for building AI-powered automation agents.

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🎯 What is Orbit Base?

Orbit Base is a lightweight yet powerful framework for creating autonomous coding agents. It provides the essential building blocks for file manipulation, command execution, and intelligent task orchestration.

## ✨ Features

- **🔧 File Operations** - Create, read, update, and manage files programmatically
- **💻 Command Execution** - Run shell commands with full output capture
- **🐳 Docker Ready** - Containerized deployment out of the box
- **🧩 Modular Design** - Easily extend with custom tools
- **⚡ Lightweight** - Minimal dependencies, maximum performance

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Docker (optional)

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
# Build and run with docker-compose
docker-compose up --build

# Or build manually
docker build -t orbit-base .
docker run -it orbit-base
```

## 📖 Usage

```python
from base import Agent

# Initialize the agent
agent = Agent()

# Execute a task
result = agent.run("create a hello world script")
```

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `create_file` | Create new files with specified content |
| `cmd` | Execute shell commands |

## 📁 Project Structure

```
orbit/base/
├── base/              # Core module
├── requirements.txt   # Python dependencies
├── Dockerfile         # Container definition
├── docker-compose.yml # Multi-container setup
├── TUTORIAL.md        # Detailed tutorial
└── README.md          # You are here
```

## 📚 Documentation

For detailed usage and examples, check out the [Tutorial](TUTORIAL.md).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<p align="center">Built with ❤️ by the Orbit Team</p>