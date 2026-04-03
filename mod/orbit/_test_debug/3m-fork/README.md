# 3m-fork

Uniswap GraphQL scraper module.

## Quick Start

```bash
cd /Users/broski/mod/mod/orbit/3m-fork

pip install -r requirements.txt
```

```python
from 3m-fork.mod import Mod

mod = Mod()
result = mod.forward(5, 10)
```

## Project Structure

```
3m-fork/
├── 3m-fork/
│   └── mod.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── TUTORIAL.md
└── README.md
```

## Docker

```bash
docker-compose up --build
docker-compose up -d
docker-compose down
```
