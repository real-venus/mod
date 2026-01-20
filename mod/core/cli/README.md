# 🚀 Commune CLI Module

> A pythonic command-line interface that makes interacting with Commune feel natural and intuitive.

## ✨ Overview

The Commune CLI breaks away from traditional argparse-based tools, offering a Python-like experience directly from your terminal. Test functions, interact with modules, and build faster—all with an elegant, minimalist syntax.

## 🎯 Basic Usage

Two simple patterns to rule them all:

```bash
# Pattern 1: Default module is "mod"
m {function_name} *args **kwargs

# Pattern 2: Specify module and function
m {module_name}/{function_name} *args **kwargs
```

### 💡 Quick Examples

```bash
# List files in current directory
m ls ./

# Explicit module specification
m module/ls ./

# Get module source code
m module/code
```

## 📦 Module Naming Conventions

Commune uses clean, simplified naming:

- `mod/module.py` → `mod`
- `storage/module.py` → `storage`
- `storage/storage/module.py` → `storage`

**Rule:** The root module is closest to the `mod/` repository.

## 🛠️ Common Operations

### Creating a New Module

```bash
# Create a new module called 'agi'
m new_module agi

# Python equivalent:
# import mod as m
# m.new_module("agi")
```

This creates your module in the `modules` directory, ready to go.

### Getting Module Configuration

```bash
# Fetch module config
m agi/config

# Python equivalent:
# import mod as m
# m.mod("agi").config()
```

**Note:** If no config/YAML exists, keyword arguments become the config.

### Getting Module Code

```bash
# View module source
m agi/code

# Python equivalent:
# import mod as m
# m.mod("agi").code()
```

### Serving a Module

```bash
# Launch module as a service
m serve module
```

### Calling Module Functions

```bash
# Basic function call
m call module/ask hey
# Equivalent: m.call('module/ask', 'hey')
# Or: m.connect('mod').ask('hey')

# With parameters
m call module/ask hey stream=1
# Equivalent: m.call('module/ask', 'hey', stream=1)
```

## ⚡ Shortcuts & Pro Tips

- **`c`** (no args) → Navigate to Commune repository
- **`m module/`** → Calls the module's `forward` function
- **`m module/forward`** → Explicitly calls `forward`
- **`m module/add a=1 b=1`** ≡ **`m module/add 1 1`**
- **`m ai what is the point of love`** → Query the AI module

## ⚠️ Current Limitations

- Lists and dictionaries require special syntax in CLI arguments
- Only positional arguments are fully supported
- Single function call per command

## 🐍 Python Equivalent

Every CLI command has a Python counterpart:

```python
import mod as m

# List files
m.ls('./')

# Call module function
m.call('module/ask', 'hey', stream=1)

# Connect and interact
module = m.connect('mod')
module.ask('hey', stream=1)
```

## 🎨 Philosophy

> "Simplicity is the ultimate sophistication." — Leonardo da Vinci

Commune CLI embodies this principle: powerful functionality through elegant simplicity. No complex flags, no verbose syntax—just pure, intuitive interaction.

---

**Built with ❤️ by the Commune community**