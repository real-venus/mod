# 3m Tutorial

## What is 3m?

3m is a Uniswap GraphQL scraper module for fetching and analyzing on-chain data.

## Installation

```bash
cd /Users/broski/mod/mod/orbit/3m

pip install -r requirements.txt
```

## Core Features

### Basic Usage

```python
from 3m.mod import Mod

mod = Mod()
result = mod.forward(5, 10)
print(result)  # Output: 15
```

## API Reference

### Class: `Mod`

#### Methods

##### `forward(a: int = 1, b: int = 2) -> int`

Forward method.

**Parameters:**
- `a` (int): First number
- `b` (int): Second number

**Returns:**
- `int`: Sum of a and b

## Extending

```python
from 3m.mod import Mod

class MyMod(Mod):
    def custom_method(self, data):
        return self.forward(data, 2)
```

## Project Structure

```
3m/
├── 3m/
│   └── mod.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── TUTORIAL.md
└── README.md
```
