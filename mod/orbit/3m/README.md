# 3m

Uniswap GraphQL scraper module.

## Quick Start

```bash
cd /Users/broski/mod/mod/orbit/3m

pip install -r requirements.txt
```

```python
from 3m.mod import Mod

mod = Mod()
result = mod.forward(5, 10)
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

## Docker

```bash
docker-compose up --build
docker-compose up -d
docker-compose down
```
