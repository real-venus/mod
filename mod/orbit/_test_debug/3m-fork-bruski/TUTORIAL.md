# 3m-fork-bruski Tutorial

## What is 3m-fork-bruski?

3m-fork-bruski is a Uniswap GraphQL scraper module for fetching and analyzing on-chain data. Forked from 3m.

## Installation

```bash
cd /Users/broski/mod/mod/orbit/3m-fork-bruski

pip install -r requirements.txt
```

## Core Features

### Basic Usage

```python
from 3m-fork-bruski.mod import Mod

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
from 3m-fork-bruski.mod import Mod

class MyMod(Mod):
    def custom_method(self, data):
        return self.forward(data, 2)
```

## Project Structure

```
3m-fork-bruski/
├── 3m-fork-bruski/
│   └── mod.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── TUTORIAL.md
└── README.md
```
