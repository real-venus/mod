# 3m-fork-bruski

Uniswap GraphQL scraper module. Forked from 3m.

## Quick Start

```bash
cd /Users/broski/mod/mod/orbit/3m-fork-bruski

pip install -r requirements.txt
```

```python
from 3m-fork-bruski.mod import Mod

mod = Mod()
result = mod.forward(5, 10)
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

## Docker

```bash
docker-compose up --build
docker-compose up -d
docker-compose down
```
