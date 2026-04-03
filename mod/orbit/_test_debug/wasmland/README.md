# 🛸 Orbit Base

<div align="center">

```
   ⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⣤⣶⣶⣶⣶⣤⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀
   ⠀⠀⠀⠀⢀⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣤⡀⠀⠀⠀⠀
   ⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⠀⠀⠀
   ⠀⢀⣾⣿⡿⠿⠛⠛⠛⠉⠉⠉⠉⠛⠛⠛⠿⠿⣿⣿⣿⣿⣿⣷⡀⠀
   ⠀⣾⣿⣿⣇⠀⣀⣀⣠⣤⣤⣤⣤⣤⣀⣀⠀⠀⠀⠈⠙⠻⣿⣿⣷⠀
   ⢠⣿⣿⣿⣿⡿⠿⠟⠛⠛⠛⠛⠛⠛⠻⠿⢿⣿⣶⣤⣀⣠⣿⣿⣿⡄
   ⢸⣿⣿⣿⣿⣇⣀⣀⣤⣤⣤⣤⣤⣄⣀⣀⠀⠀⠉⠛⢿⣿⣿⣿⣿⡇
   ⠘⣿⣿⣿⣿⣿⠿⠿⠛⠛⠛⠛⠛⠛⠿⠿⣿⣶⣦⣤⣾⣿⣿⣿⣿⠃
   ⠀⢿⣿⣿⣿⣿⣤⣤⣤⣤⣶⣶⣦⣤⣤⣄⡀⠈⠙⣿⣿⣿⣿⣿⡿⠀
   ⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣾⣿⣿⣿⣿⡿⠁⠀
   ⠀⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀⠀
   ⠀⠀⠀⠀⠈⠛⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⠁⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⠀⠀⠈⠙⠛⠛⠿⠿⠿⠿⠛⠛⠋⠁⠀⠀⠀⠀⠀⠀⠀
```

### **Two Tools. Infinite Possibilities.**

*The minimalist AI agent framework that proves less is more.*

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](https://www.docker.com/)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Quick Start**](#-quick-start) · [**Philosophy**](#-philosophy) · [**Examples**](#-examples) · [**Tutorial**](TUTORIAL.md)

</div>

---

## 🎯 What is Orbit Base?

Orbit Base is an AI agent framework built on a radical premise: **an AI with just two tools—file creation and command execution—can accomplish anything a developer can.**

```python
from base import Agent

agent = Agent()
agent.run("Create a Flask API with user authentication")
# That's it. The agent figures out the rest.
```

---

## 💡 Philosophy

> *"Simplicity is the ultimate sophistication."* — Leonardo da Vinci

| Traditional Frameworks | Orbit Base |
|------------------------|------------|
| 🔧 50+ specialized tools | ✨ **2 universal tools** |
| 📚 Weeks to learn | ⚡ **Minutes to master** |
| 🔗 Complex chains & graphs | 🎯 **Direct execution** |
| 🔒 Framework lock-in | 🔓 **Pure Python** |

**The insight:** Every developer action reduces to two primitives—**writing files** and **running commands**.

---

## ⚡ Quick Start

```bash
git clone <repo-url> && cd orbit/base
pip install -r requirements.txt
python -c "from base import Agent; Agent().run('create hello.py that prints hello world')"
```

**Docker:**
```bash
docker-compose up --build
```

---

## 🔧 The Two Tools

### 📄 `create_file`
```python
create_file(file_path="app/main.py", content="print('Hello!')", overwrite=True)
```

### ⚡ `cmd`
```python
cmd("python main.py")        # Execute
cmd("pip install flask")    # Install
cmd("git init")              # Version control
```

---

## 🎯 Examples

```python
agent.run("Create a web scraper for HN headlines")
agent.run("Set up a FastAPI project with Docker")
agent.run("Refactor utils.py to async functions")
agent.run("Build a backup script with timestamps")
```

---

## 🏗️ Structure

```
orbit/base/
├── base/              # Core: agent.py + tools.py
├── Dockerfile         # Container config
├── docker-compose.yml
├── requirements.txt
└── TUTORIAL.md        # Deep dive
```

---

## 🤝 Contributing

```bash
git checkout -b feature/awesome
# Make changes, test, document
git push origin feature/awesome
```

---

## 📜 License

MIT — Do whatever you want. See [LICENSE](LICENSE).

---

<div align="center">

**Built for builders who ship.**

<sub>Made with 🔥 by developers who hate complexity</sub>

</div>