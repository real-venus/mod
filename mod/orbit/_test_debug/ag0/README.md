# ag0

A minimal Python module template within the Mod framework ecosystem.

## Overview

`ag0` is a foundational module demonstrating the basic structure for Mod framework modules. It serves as a starting point for building custom functionality within the modular Mod ecosystem.

## Features

- Clean, minimal module structure
- Compatible with Mod framework loading patterns (`m.mod('ag0')()`)
- Docker-ready for containerized deployment
- Easy to extend and customize

## Installation

```bash
# Via Mod framework
m.mod('ag0')()

# Or navigate directly
cd /Users/broski/mod/mod/orbit/ag0

# Install dependencies (if any)
pip install -r requirements.txt
```

## Usage

### Within Mod Framework

```python
import mod.core.mod as m

# Load and instantiate the module
ag0 = m.mod('ag0')()

# Use the forward method
result = ag0.forward(5, 10)
print(result)  # Output: 15
```

### Standalone

```python
from ag0.mod import Mod

# Create instance
mod = Mod()

# Call methods
result = mod.forward(a=3, b=7)
print(result)  # Output: 10
```

## Project Structure

```
ag0/
├── ag0/
│   └── mod.py              # Core module implementation
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Container orchestration
├── requirements.txt        # Python dependencies
├── README.md               # This file
└── TUTORIAL.md             # Extended examples
```

## Module API

### `Mod` class

The main module class following Mod framework conventions.

#### `forward(a=1, b=2) -> int`

Adds two numbers and returns the result.

**Parameters:**
- `a` (int): First number (default: 1)
- `b` (int): Second number (default: 2)

**Returns:**
- `int`: Sum of a and b

## Docker Deployment

```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d

# Stop
docker-compose down
```

## Extending the Module

Modify `ag0/mod.py` to add your custom functionality:

```python
class Mod:
    description = """
    Your custom module description
    """

    def forward(self, a=1, b=2) -> int:
        """Your core logic here"""
        return a + b

    def your_custom_method(self, data):
        """Add new methods as needed"""
        # Your implementation
        pass
```

## Mod Framework Integration

This module follows Mod framework patterns:

- **Anchor file**: `mod.py` in module directory
- **Class name**: `Mod` (framework convention)
- **Description**: Class attribute for module metadata
- **Loading**: Via `m.mod('ag0')()` or `m.fn('ag0/method')()`

## Development

```bash
# Run tests (if available)
pytest

# Format code
black ag0/

# Type checking
mypy ag0/
```

## Contributing

1. Fork the module
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Open source under permissive licensing.

---

**Part of the [Mod Framework](https://github.com/modframework) ecosystem** 🚀