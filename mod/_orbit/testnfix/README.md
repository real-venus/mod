# Base Module 🚀

A foundational Python module providing core functionality and utilities for building elegant, modular systems with simplicity and power.

## ✨ Features

- **Clean Architecture** - Modular design following SOLID principles
- **Mathematical Utilities** - Core computation functions (multiply, etc.)
- **Crypto Integration** - Real-time cryptocurrency price fetching via CoinGecko API
- **Extensible Patterns** - Built for customization and growth
- **Production Ready** - Battle-tested, error-handled, and optimized
- **Type-Safe** - Full type hints for better IDE support

## 🚀 Quick Start

```python
from base.mod import BaseMod

# Initialize the module
mod = BaseMod()

# Perform calculations
result = mod.multiply(5, 10)
print(result)  # Output: 50

# Fetch cryptocurrency prices
price = mod.get_bittenso_price()
print(price)  # Output: $0.00123 (example)
```

## 📦 Installation

```bash
# Clone the repository
git clone <repository>
cd base

# Install dependencies
pip install requests

# Install in development mode
pip install -e .
```

## 📁 Project Structure

```
base/
├── base/
│   └── mod.py          # Core BaseMod implementation
├── README.md           # This file
├── TUTORIAL.md         # Comprehensive tutorial and examples
└── tests/              # Test suite
```

## 💡 Core Functionality

### Mathematical Operations

```python
mod = BaseMod()
area = mod.multiply(15, 20)  # Returns: 300
```

### Cryptocurrency Price Fetching

```python
mod = BaseMod()
price = mod.get_bittenso_price()  # Returns: "$0.00123"
```

## 📚 Documentation

For detailed tutorials, API reference, and advanced examples, see [TUTORIAL.md](TUTORIAL.md)

## 🛠️ Development

Built with simplicity and elegance in mind, following Leonardo da Vinci's principle:

> *"Simplicity is the ultimate sophistication."*

### Running Tests

```bash
pytest tests/
```

### Extending BaseMod

```python
from base.mod import BaseMod

class MyCustomMod(BaseMod):
    def divide(self, a: int, b: int) -> float:
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b

custom = MyCustomMod()
result = custom.divide(100, 4)  # Returns: 25.0
```

### Contributing

Contributions are welcome! Please:
- Keep it simple, keep it clean
- Follow existing code style and SOLID principles
- Add tests for new features
- Update documentation
- Handle errors gracefully

## 🎯 Use Cases

- **Foundation Layer** - Build modular systems on top of BaseMod
- **Price Monitoring** - Track cryptocurrency prices in real-time
- **Mathematical Utilities** - Core computation functions
- **API Integration** - Template for external service integration

## 🔧 Requirements

- Python 3.7+
- requests library

## 📄 License

MIT License - feel free to use in your projects.

## 🚀 What's Next?

1. Read the [TUTORIAL.md](TUTORIAL.md) for in-depth examples
2. Explore the source code in `base/mod.py`
3. Extend with your own custom methods
4. Build amazing modular systems!

---

*Crafted with precision, purpose, and passion.* ⚡

**Simple. Elegant. Powerful.**